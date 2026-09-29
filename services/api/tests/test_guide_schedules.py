"""Guide plan step 2: schedules per tour and the rules that keep one guide in one place.

The rules worth protecting are the ones only the database can hold for every path:
a booking is refused when the guide is already on another run (with the buffer), on
a blocked time or past the cut-off; a private start takes one party; the daily cap
counts booked runs; a changed schedule never moves a start somebody booked; and a
shared run that misses its minimum group is cancelled with the reason.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, datetime, timedelta
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_tours import _approved_guide, _client, _photo, _register, _tour

BEIRUT = ZoneInfo("Asia/Beirut")


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "traveller": _client(), "other": _client(), "anon": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


def _today() -> date:
    return datetime.now(BEIRUT).date()


async def _rules(guide: AsyncClient, **rules: Any) -> dict[str, Any]:
    body = {"min_notice_hours": 1, "max_tours_per_day": 4, "buffer_minutes": 30, "travel_aware": False}
    body.update(rules)
    response = await guide.put("/api/v1/guides/me/availability", json=body)
    assert response.status_code == 200, response.text
    return dict(response.json())


async def _live_tour(guide: AsyncClient, profile: dict[str, Any], title: str, **overrides: Any) -> dict[str, Any]:
    created = await guide.put("/api/v1/guides/me/tours", json=_tour(title=title, **overrides))
    assert created.status_code == 200, created.text
    tour = dict(created.json())
    await _photo(guide, profile["organization_id"], tour["id"])
    published = await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/publish")
    assert published.status_code == 200, published.text
    return dict(published.json())


async def _schedule(guide: AsyncClient, tour_id: str, day: date, start: str, **extra: Any) -> dict[str, Any]:
    """One start on one day: the smallest schedule, so tests know exactly what exists."""
    body: dict[str, Any] = {
        "weekdays": [day.weekday()],
        "start_times": [start],
        "valid_from": day.isoformat(),
        "valid_to": day.isoformat(),
    }
    body.update(extra)
    response = await guide.put(f"/api/v1/guides/me/tours/{tour_id}/schedules", json=body)
    assert response.status_code == 200, response.text
    return dict(response.json())


async def _open_slots(client: AsyncClient, guide_slug: str, tour_slug: str) -> list[dict[str, Any]]:
    response = await client.get(f"/api/v1/guides/{guide_slug}/tours")
    assert response.status_code == 200, response.text
    tour = next(row for row in response.json() if row["slug"] == tour_slug)
    return list(tour["next_slots"])


async def _book(client: AsyncClient, tour_slug: str, slot_id: str, party: int = 2) -> Any:
    return await client.post(
        f"/api/v1/guides/tours/{tour_slug}/request",
        json={"slot_id": slot_id, "party_size": party},
        headers={"Idempotency-Key": f"schedule-{uuid4().hex}"},
    )


async def _slot_ids(tour_id: str) -> list[str]:
    async with TestingSessionLocal() as session:
        rows = (
            await session.execute(
                text("SELECT id FROM app.slots WHERE experience_id = CAST(:e AS uuid) ORDER BY starts_at"),
                {"e": tour_id},
            )
        ).all()
    return [str(row[0]) for row in rows]


@pytest.mark.asyncio
async def test_a_schedule_fills_120_days_and_never_moves_a_booked_start(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    profile = await _approved_guide(clients)
    await _rules(guide)
    tour = await _live_tour(guide, profile, "Mar Mikhael at dusk")

    made = await guide.put(
        f"/api/v1/guides/me/tours/{tour['id']}/schedules",
        json={"weekdays": list(range(7)), "start_times": ["15:00", "09:00"]},
    )
    assert made.status_code == 200, made.text
    schedule = made.json()
    assert schedule["start_times"] == ["09:00", "15:00"], "kept in clock order"
    assert schedule["mode"] == "shared"
    assert 2 * 119 <= schedule["created"] <= 240, "120 days of two starts, less any already past today"

    async with TestingSessionLocal() as session:
        first, last, sources = (
            await session.execute(
                text(
                    "SELECT min((starts_at AT TIME ZONE 'Asia/Beirut')::date), "
                    "max((starts_at AT TIME ZONE 'Asia/Beirut')::date), array_agg(DISTINCT source) "
                    "FROM app.slots WHERE experience_id = CAST(:e AS uuid)"
                ),
                {"e": tour["id"]},
            )
        ).one()
    assert first >= _today()
    assert last <= _today() + timedelta(days=119)
    assert sources == ["guide-schedule"]

    listed = (await guide.get(f"/api/v1/guides/me/tours/{tour['id']}/schedules")).json()
    assert [row["id"] for row in listed] == [schedule["id"]]

    await _register(traveller, "traveller", verify=True)
    slot = (await _open_slots(traveller, profile["slug"], tour["slug"]))[0]
    booked = await _book(traveller, tour["slug"], slot["id"])
    assert booked.status_code == 200, booked.text

    # A new start time replaces every empty start, and leaves the booked one alone.
    changed = await guide.put(
        f"/api/v1/guides/me/tours/{tour['id']}/schedules",
        json={"id": schedule["id"], "weekdays": list(range(7)), "start_times": ["11:00"]},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["cleared"] == schedule["created"] - 1
    assert slot["id"] in await _slot_ids(tour["id"]), "a booked start is never moved by a schedule change"

    stopped = await guide.delete(f"/api/v1/guides/me/schedules/{schedule['id']}")
    assert stopped.status_code == 200, stopped.text
    assert stopped.json()["kept_booked"] == 1
    assert await _slot_ids(tour["id"]) == [slot["id"]], "only the booked start is left"
    assert (await guide.get(f"/api/v1/guides/me/tours/{tour['id']}/schedules")).json() == []


@pytest.mark.asyncio
async def test_one_guide_is_in_one_place_with_a_buffer(clients: dict[str, AsyncClient]) -> None:
    guide, traveller, other = clients["guide"], clients["traveller"], clients["other"]
    profile = await _approved_guide(clients)
    await _rules(guide, buffer_minutes=30)
    day = _today() + timedelta(days=3)
    morning = await _live_tour(guide, profile, "Byblos old souk")  # 120 minutes: 10:00-12:00
    noon = await _live_tour(guide, profile, "Byblos harbour")
    await _schedule(guide, morning["id"], day, "10:00")
    await _schedule(guide, noon["id"], day, "12:15")

    [first] = await _open_slots(traveller, profile["slug"], morning["slug"])
    [second] = await _open_slots(traveller, profile["slug"], noon["slug"])

    await _register(traveller, "traveller", verify=True)
    assert (await _book(traveller, morning["slug"], first["id"])).status_code == 200

    assert await _open_slots(other, profile["slug"], noon["slug"]) == [], "12:15 is inside the 30-minute buffer"
    await _register(other, "other", verify=True)
    refused = await _book(other, noon["slug"], second["id"])
    assert refused.status_code == 409, refused.text
    assert "another tour" in refused.text

    # Without a buffer the guide can walk from one to the other.
    await _rules(guide, buffer_minutes=0)
    assert [row["id"] for row in await _open_slots(other, profile["slug"], noon["slug"])] == [second["id"]]
    assert (await _book(other, noon["slug"], second["id"])).status_code == 200


@pytest.mark.asyncio
async def test_a_private_start_takes_one_party(clients: dict[str, AsyncClient]) -> None:
    guide, traveller, other = clients["guide"], clients["traveller"], clients["other"]
    profile = await _approved_guide(clients)
    await _rules(guide)
    tour = await _live_tour(guide, profile, "Batroun, just us")
    await _schedule(guide, tour["id"], _today() + timedelta(days=4), "17:00", mode="private")

    [slot] = await _open_slots(traveller, profile["slug"], tour["slug"])
    assert slot["private"] is True
    await _register(traveller, "traveller", verify=True)
    assert (await _book(traveller, tour["slug"], slot["id"], party=2)).status_code == 200

    assert await _open_slots(other, profile["slug"], tour["slug"]) == [], "seats are left, but it is theirs"
    await _register(other, "other", verify=True)
    refused = await _book(other, tour["slug"], slot["id"], party=1)
    assert refused.status_code == 409, refused.text
    assert "privately" in refused.text


@pytest.mark.asyncio
async def test_blocked_time_closes_starts_but_never_strands_a_booking(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    profile = await _approved_guide(clients)
    await _rules(guide, buffer_minutes=0)
    day = _today() + timedelta(days=5)
    tour = await _live_tour(guide, profile, "Qadisha valley walk")
    other_tour = await _live_tour(guide, profile, "Bsharri afternoon")
    await _schedule(guide, tour["id"], day, "09:00")
    await _schedule(guide, other_tour["id"], day, "15:00")
    [slot] = await _open_slots(traveller, profile["slug"], tour["slug"])

    starts = datetime.combine(day, datetime.min.time(), BEIRUT) + timedelta(hours=8)
    block = await guide.post(
        "/api/v1/guides/me/blocks",
        json={"starts_at": starts.isoformat(), "ends_at": (starts + timedelta(hours=4)).isoformat(), "note": "Dentist"},
    )
    assert block.status_code == 200, block.text
    assert [row["id"] for row in (await guide.get("/api/v1/guides/me/blocks")).json()] == [block.json()["id"]]
    assert await _open_slots(traveller, profile["slug"], tour["slug"]) == []
    await _register(traveller, "traveller", verify=True)
    refused = await _book(traveller, tour["slug"], slot["id"])
    assert refused.status_code == 409 and "not available" in refused.text

    removed = await guide.delete(f"/api/v1/guides/me/blocks/{block.json()['id']}")
    assert removed.status_code == 200
    assert [row["id"] for row in await _open_slots(traveller, profile["slug"], tour["slug"])] == [slot["id"]]

    [afternoon] = await _open_slots(traveller, profile["slug"], other_tour["slug"])
    assert (await _book(traveller, other_tour["slug"], afternoon["id"])).status_code == 200
    over_booking = await guide.post(
        "/api/v1/guides/me/blocks",
        json={
            "starts_at": (starts + timedelta(hours=6)).isoformat(),
            "ends_at": (starts + timedelta(hours=9)).isoformat(),
        },
    )
    assert over_booking.status_code == 409, "a block cannot land on top of a traveller"
    backwards = await guide.post(
        "/api/v1/guides/me/blocks",
        json={"starts_at": (starts + timedelta(hours=2)).isoformat(), "ends_at": starts.isoformat()},
    )
    assert backwards.status_code == 422


@pytest.mark.asyncio
async def test_the_cut_off_closes_tomorrow_and_the_cap_counts_booked_runs(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    profile = await _approved_guide(clients)
    # Bookings for a day close at midnight the day before, so tomorrow is already closed.
    await _rules(guide, cutoff_time="00:00", max_tours_per_day=1, buffer_minutes=0)
    tour = await _live_tour(guide, profile, "Tyre sea and ruins")
    evening = await _live_tour(guide, profile, "Tyre by night")
    tomorrow = _today() + timedelta(days=1)
    later = _today() + timedelta(days=6)
    await _schedule(guide, tour["id"], tomorrow, "10:00")
    await _schedule(guide, tour["id"], later, "09:00")
    await _schedule(guide, evening["id"], later, "18:00")

    slots = await _open_slots(traveller, profile["slug"], tour["slug"])
    assert [datetime.fromisoformat(row["starts_at"]).astimezone(BEIRUT).date() for row in slots] == [later]

    [evening_slot] = await _open_slots(traveller, profile["slug"], evening["slug"])
    await _register(traveller, "traveller", verify=True)
    assert (await _book(traveller, tour["slug"], slots[0]["id"])).status_code == 200
    assert await _open_slots(traveller, profile["slug"], evening["slug"]) == [], "one run a day, and it is booked"
    capped = await _book(traveller, evening["slug"], evening_slot["id"])
    assert capped.status_code == 409 and "fully booked" in capped.text

    rules = (await guide.get("/api/v1/guides/me/availability")).json()
    assert rules["cutoff_time"] == "00:00"
    assert rules["schedules"] == 3
    # Sending only one rule keeps the others.
    kept = (await guide.put("/api/v1/guides/me/availability", json={"buffer_minutes": 45})).json()
    assert kept["cutoff_time"] == "00:00" and kept["max_tours_per_day"] == 1 and kept["buffer_minutes"] == 45


@pytest.mark.asyncio
async def test_a_run_short_of_its_minimum_group_is_cancelled_with_the_reason(clients: dict[str, AsyncClient]) -> None:
    guide, traveller, anon = clients["guide"], clients["traveller"], clients["anon"]
    profile = await _approved_guide(clients)
    await _rules(guide)
    tour = await _live_tour(guide, profile, "Baalbek temples")
    # Decided a week ahead, so a run three days out is already past its deadline.
    await _schedule(guide, tour["id"], _today() + timedelta(days=3), "10:00", min_group=3, min_group_deadline_hours=168)
    [slot] = await _open_slots(traveller, profile["slug"], tour["slug"])
    assert slot["min_group"] == 3
    await _register(traveller, "traveller", verify=True)
    booked = await _book(traveller, tour["slug"], slot["id"], party=1)
    assert booked.status_code == 200, booked.text

    checked = await anon.post("/api/v1/guides/ops/min-group-check", headers={"X-Job-Token": settings.job_token})
    assert checked.status_code == 200, checked.text
    assert checked.json()["bookings_cancelled"] >= 1

    async with TestingSessionLocal() as session:
        status, reason, slot_status = (
            await session.execute(
                text(
                    "SELECT b.status, b.reason, s.status FROM app.bookings b JOIN app.slots s ON s.id = b.slot_id "
                    "WHERE b.id = CAST(:b AS uuid)"
                ),
                {"b": booked.json()["id"]},
            )
        ).one()
    assert status == "cancelled"
    assert "minimum group of 3" in reason
    assert slot_status == "closed", "a cancelled run is not offered again"

    generated = await anon.post("/api/v1/guides/ops/generate-slots", headers={"X-Job-Token": settings.job_token})
    assert generated.status_code == 200, generated.text
    assert generated.json()["schedules"] >= 1


@pytest.mark.asyncio
async def test_a_schedule_says_what_is_wrong_with_it(clients: dict[str, AsyncClient]) -> None:
    guide = clients["guide"]
    profile = await _approved_guide(clients)
    tour = await _live_tour(guide, profile, "Beirut food walk")
    url = f"/api/v1/guides/me/tours/{tour['id']}/schedules"

    assert (await guide.put(url, json={"weekdays": [9], "start_times": ["10:00"]})).status_code == 422
    assert (await guide.put(url, json={"weekdays": [1], "start_times": ["25:00"]})).status_code == 422
    too_many = await guide.put(url, json={"weekdays": [1], "start_times": ["10:00"], "capacity": 4, "min_group": 6})
    assert too_many.status_code == 422 and "minimum group" in too_many.text
    backwards = await guide.put(
        url,
        json={"weekdays": [1], "start_times": ["10:00"], "valid_from": "2030-05-01", "valid_to": "2030-04-01"},
    )
    assert backwards.status_code == 422 and "season" in backwards.text
    private = await guide.put(url, json={"weekdays": [1], "start_times": ["10:00"], "mode": "private", "min_group": 4})
    assert private.status_code == 200 and private.json()["min_group"] == 1, "a private run has no minimum group"
    missing = await guide.delete(f"/api/v1/guides/me/schedules/{uuid4()}")
    assert missing.status_code == 404
