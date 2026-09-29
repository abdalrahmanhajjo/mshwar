"""Guide plan step 3: booking a tour.

The rules worth protecting: the total is only ever the guide's published prices (adults,
children, extras); a host still cannot charge; an instant tour is confirmed at once and a
request lapses after the guide's own reply window; a cancellation records who and whether
it was late; and a booking moves to another time only when the other side accepts.
"""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_schedules import _live_tour, _open_slots, _rules, _schedule, _today
from tests.test_guide_tours import _approved_guide, _client, _register


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "traveller": _client(), "anon": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _settings(guide: AsyncClient, tour_id: str, **body: Any) -> dict[str, Any]:
    response = await guide.put(f"/api/v1/guides/me/tours/{tour_id}/booking-settings", json=body)
    assert response.status_code == 200, response.text
    return dict(response.json())


async def _book(client: AsyncClient, tour_slug: str, key: str | None = None, **body: Any) -> Any:
    return await client.post(
        f"/api/v1/guides/tours/{tour_slug}/book",
        json=body,
        headers={"Idempotency-Key": key or f"book-{uuid4().hex}"},
    )


async def _ready(clients: dict[str, AsyncClient], title: str, days: int = 10, start: str = "10:00") -> dict[str, Any]:
    guide = clients["guide"]
    profile = await _approved_guide(clients)
    await _rules(guide)
    tour = await _live_tour(guide, profile, title)
    await _schedule(guide, tour["id"], _today() + timedelta(days=days), start)
    return {"profile": profile, "tour": tour}


@pytest.mark.asyncio
async def test_an_instant_booking_is_confirmed_with_the_published_prices(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, "Byblos old souk walk")
    tour, profile = ready["tour"], ready["profile"]
    terms = await _settings(
        guide,
        tour["id"],
        instant_booking=True,
        policy="strict",
        child_price_minor=1500,
        child_age_max=11,
        addons=[
            {"name": "Pickup from Jbeil bus stop", "price_minor": 1000, "unit": "booking"},
            {"name": "Sweets tasting", "price_minor": 500, "unit": "person"},
        ],
    )
    assert terms["instant_booking"] is True and terms["free_cancel_hours"] == 168
    pickup, tasting = terms["addons"]

    page = await clients["anon"].get(f"/api/v1/guides/tours/{tour['slug']}")
    assert page.status_code == 200, page.text
    assert page.json()["guide"]["slug"] == profile["slug"]
    assert page.json()["booking"]["policy"] == "strict"
    assert [row["name"] for row in page.json()["booking"]["addons"]] == [pickup["name"], tasting["name"]]
    assert (await clients["anon"].get("/api/v1/guides/tours/no-such-tour")).status_code == 404

    day = _today() + timedelta(days=10)
    month = await clients["anon"].get(
        f"/api/v1/guides/tours/{tour['slug']}/availability", params={"month": day.strftime("%Y-%m")}
    )
    assert month.status_code == 200, month.text
    [listed_day] = [row for row in month.json()["days"] if row["date"] == day.isoformat()]
    assert listed_day["from_minor"] == 2500
    [start] = listed_day["starts"]

    await _register(traveller, "traveller", verify=True)
    booked = await _book(
        traveller,
        tour["slug"],
        key="instant-booking-0001",
        slot_id=start["id"],
        adults=2,
        children=1,
        language="en",
        addons=[pickup["id"], tasting["id"]],
        note="One of us is vegetarian",
    )
    assert booked.status_code == 200, booked.text
    booking = booked.json()
    assert booking["status"] == "confirmed", "an instant tour is confirmed at once"
    assert re.fullmatch(r"MSH-[A-HJ-NP-Z2-9]{6}", booking["code"])
    # 2 adults x 25 + 1 child x 15 + pickup 10 + tasting 5 x 3 people.
    assert booking["total_minor"] == 2 * 2500 + 1500 + 1000 + 500 * 3
    assert booking["addons_minor"] == 1000 + 500 * 3
    assert booking["paid_on_the_day"] is True
    assert booking["policy"] == "strict"
    starts = datetime.fromisoformat(booking["starts_at"])
    assert datetime.fromisoformat(booking["free_cancel_until"]) == starts - timedelta(hours=168)

    again = await _book(
        traveller,
        tour["slug"],
        key="instant-booking-0001",
        slot_id=start["id"],
        adults=2,
        children=1,
        language="en",
        addons=[pickup["id"], tasting["id"]],
        note="One of us is vegetarian",
    )
    assert again.json()["id"] == booking["id"], "a retried booking is the same booking"

    mine = await traveller.get(f"/api/v1/guides/bookings/{booking['id']}")
    assert mine.status_code == 200 and mine.json()["code"] == booking["code"]
    seen = await guide.get(f"/api/v1/guides/me/bookings/{booking['id']}")
    assert seen.status_code == 200
    assert seen.json()["note"] == "One of us is vegetarian"
    assert [row["name"] for row in seen.json()["addons"]] == ["Pickup from Jbeil bus stop", "Sweets tasting"]
    assert (await clients["anon"].get(f"/api/v1/guides/bookings/{booking['id']}")).status_code == 401

    async with TestingSessionLocal() as session:
        events = (
            await session.execute(
                text(
                    "SELECT n.event_type FROM app.notifications n JOIN app.guide_profiles g ON g.user_id = n.user_id "
                    "WHERE g.id = CAST(:g AS uuid) AND n.channel = 'in_app'"
                ),
                {"g": profile["id"]},
            )
        ).scalars()
        assert "guide.booking_confirmed" in set(events), "the guide hears about an instant booking"


@pytest.mark.asyncio
async def test_a_request_lapses_after_the_guides_reply_window(clients: dict[str, AsyncClient]) -> None:
    guide, traveller, anon = clients["guide"], clients["traveller"], clients["anon"]
    ready = await _ready(clients, "Batroun sunset walk")
    tour = ready["tour"]
    await _settings(guide, tour["id"], request_ttl_hours=12)
    [slot] = await _open_slots(traveller, ready["profile"]["slug"], tour["slug"])
    user = await _register(traveller, "traveller", verify=True)
    booked = await _book(traveller, tour["slug"], slot_id=slot["id"], adults=1)
    assert booked.status_code == 200, booked.text
    booking = booked.json()
    assert booking["status"] == "pending"
    due = datetime.fromisoformat(booking["response_due_at"])
    assert timedelta(hours=11) < due - datetime.now(due.tzinfo) <= timedelta(hours=12)

    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.bookings SET hold_until = now() - interval '1 minute' WHERE id = CAST(:b AS uuid)"),
            {"b": booking["id"]},
        )
        await session.commit()
    expired = await anon.post("/api/v1/checkout/ops/expire-holds", headers={"X-Job-Token": settings.job_token})
    assert expired.status_code == 200, expired.text
    assert (await traveller.get(f"/api/v1/guides/bookings/{booking['id']}")).json()["status"] == "expired"
    async with TestingSessionLocal() as session:
        titles = (
            await session.execute(
                text(
                    "SELECT title FROM app.notifications WHERE user_id = CAST(:u AS uuid) "
                    "AND event_type = 'booking.expired' AND channel = 'in_app'"
                ),
                {"u": user["id"]},
            )
        ).scalars()
        assert list(titles) == ["Your request was not answered in time"]


@pytest.mark.asyncio
async def test_a_host_cannot_charge_for_children_or_extras(clients: dict[str, AsyncClient]) -> None:
    guide = clients["guide"]
    profile = await _approved_guide(clients, tier="host")
    tour = (
        await guide.put(
            "/api/v1/guides/me/tours",
            json={
                "title": "Tea in my garden in Deir el Qamar",
                "description": "An afternoon in a Chouf garden.",
                "duration_minutes": 90,
                "max_party": 6,
                "price_minor": 0,
                "languages": ["ar"],
                "meeting": {"name": "Deir el Qamar square", "lat": 33.6969, "lng": 35.5625},
            },
        )
    ).json()
    url = f"/api/v1/guides/me/tours/{tour['id']}/booking-settings"
    child = await guide.put(url, json={"child_price_minor": 500})
    assert child.status_code == 422 and "cannot charge" in child.text
    extra = await guide.put(url, json={"addons": [{"name": "Lunch", "price_minor": 800}]})
    assert extra.status_code == 422 and "cannot charge" in extra.text
    free = await guide.put(url, json={"addons": [{"name": "Garden herbs to take home", "price_minor": 0}]})
    assert free.status_code == 200, free.text
    assert profile["tier"] == "host"


@pytest.mark.asyncio
async def test_a_booking_must_fit_the_tour(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, "Qadisha valley hike")
    tour = ready["tour"]
    [slot] = await _open_slots(traveller, ready["profile"]["slug"], tour["slug"])
    await _register(traveller, "traveller", verify=True)

    too_many = await _book(traveller, tour["slug"], slot_id=slot["id"], adults=7, children=3)
    assert too_many.status_code == 422 and "groups of" in too_many.text
    language = await _book(traveller, tour["slug"], slot_id=slot["id"], adults=1, language="de")
    assert language.status_code == 422 and "language" in language.text
    extra = await _book(traveller, tour["slug"], slot_id=slot["id"], adults=1, addons=[str(uuid4())])
    assert extra.status_code == 422 and "extra" in extra.text
    own = await _book(guide, tour["slug"], slot_id=slot["id"], adults=1)
    assert own.status_code in (403, 422), "a guide cannot book their own tour"


@pytest.mark.asyncio
async def test_cancelling_records_who_and_whether_it_was_late(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, "Tyre sea and ruins", days=3)
    tour = ready["tour"]
    await _schedule(guide, tour["id"], _today() + timedelta(days=4), "10:00")
    # Strict: free until 7 days before, so a start 3 days out is already past the deadline.
    await _settings(guide, tour["id"], instant_booking=True, policy="strict")
    first, second = await _open_slots(traveller, ready["profile"]["slug"], tour["slug"])
    await _register(traveller, "traveller", verify=True)
    one = (await _book(traveller, tour["slug"], slot_id=first["id"], adults=2)).json()
    two = (await _book(traveller, tour["slug"], slot_id=second["id"], adults=2)).json()

    short = await traveller.post(f"/api/v1/guides/bookings/{one['id']}/cancel", json={"reason": "x"})
    assert short.status_code == 422
    cancelled = await traveller.post(f"/api/v1/guides/bookings/{one['id']}/cancel", json={"reason": "Flight moved"})
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancelled_by"] == "traveller"
    assert cancelled.json()["late_cancellation"] is True
    twice = await traveller.post(f"/api/v1/guides/bookings/{one['id']}/cancel", json={"reason": "Flight moved"})
    assert twice.status_code == 422

    by_guide = await guide.post(f"/api/v1/guides/bookings/{two['id']}/cancel", json={"reason": "Storm warning"})
    assert by_guide.status_code == 200, by_guide.text
    assert by_guide.json()["cancelled_by"] == "guide"
    assert by_guide.json()["late_cancellation"] is False, "only a traveller's cancellation is ever late"
    stranger = clients["anon"]
    await _register(stranger, "stranger")
    assert (
        await stranger.post(f"/api/v1/guides/bookings/{two['id']}/cancel", json={"reason": "Not mine"})
    ).status_code == 404


@pytest.mark.asyncio
async def test_a_booking_moves_only_when_the_other_side_accepts(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, "Beirut food walk", days=8)
    tour = ready["tour"]
    await _schedule(guide, tour["id"], _today() + timedelta(days=9), "10:00")
    await _settings(guide, tour["id"], instant_booking=True)
    first, second = await _open_slots(traveller, ready["profile"]["slug"], tour["slug"])
    await _register(traveller, "traveller", verify=True)
    booking = (await _book(traveller, tour["slug"], slot_id=first["id"], adults=3)).json()

    proposed = await traveller.post(
        f"/api/v1/guides/bookings/{booking['id']}/reschedule",
        json={"slot_id": second["id"], "message": "Could we do the next day?"},
    )
    assert proposed.status_code == 200, proposed.text
    assert proposed.json()["reschedule"]["new_slot_id"] == second["id"]
    own = await traveller.post(f"/api/v1/guides/bookings/{booking['id']}/reschedule/answer", json={"accept": True})
    assert own.status_code == 422, "the other side answers"

    moved = await guide.post(f"/api/v1/guides/bookings/{booking['id']}/reschedule/answer", json={"accept": True})
    assert moved.status_code == 200, moved.text
    new = moved.json()
    assert new["id"] != booking["id"] and new["rescheduled_from"] == booking["id"]
    assert new["status"] == "confirmed" and new["adults"] == 3
    assert new["starts_at"] != booking["starts_at"]
    old = (await traveller.get(f"/api/v1/guides/bookings/{booking['id']}")).json()
    assert old["status"] == "cancelled" and old["rescheduled_to"] == new["id"]
    assert old["cancelled_by"] is None, "a move is not a cancellation by either side"

    async with TestingSessionLocal() as session:
        seats = dict(
            (
                await session.execute(
                    text("SELECT id::text, reserved FROM app.slots WHERE id IN (CAST(:a AS uuid), CAST(:b AS uuid))"),
                    {"a": first["id"], "b": second["id"]},
                )
            ).all()
        )
    assert seats == {first["id"]: 0, second["id"]: 3}, "the seats moved with the party"

    # A guide's proposal the traveller declines leaves the booking where it is.
    back = await guide.post(f"/api/v1/guides/bookings/{new['id']}/reschedule", json={"slot_id": first["id"]})
    assert back.status_code == 200, back.text
    declined = await traveller.post(f"/api/v1/guides/bookings/{new['id']}/reschedule/answer", json={"accept": False})
    assert declined.status_code == 200
    assert declined.json()["reschedule"] is None and declined.json()["starts_at"] == new["starts_at"]
