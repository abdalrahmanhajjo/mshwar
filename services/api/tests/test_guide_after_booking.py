"""Guide plan step 5: after booking.

The rules worth protecting: a traveller sees their own tour bookings and a valid calendar
file; "I'm here" works only around the start; each reminder is sent once; a weather warning
goes to the guide once per run; and messages keep contact details masked until the two
have a confirmed booking together, while a report hands the thread to support.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.api.v1.endpoints import guides as guides_endpoint
from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.planner.weather import Forecast
from tests.conftest import TestingSessionLocal
from tests.test_guide_schedules import _live_tour, _rules
from tests.test_guide_tours import _approved_guide, _client, _register


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "traveller": _client(), "anon": _client(), "other": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _slot(tour_id: str, starts_in: timedelta) -> str:
    """A start at an exact moment from now, which a schedule of whole minutes cannot give."""
    async with TestingSessionLocal() as session:
        slot = (
            await session.execute(
                text(
                    "INSERT INTO app.slots (experience_id, starts_at, ends_at, capacity, reserved, authoritative, "
                    "source, observed_at, status) VALUES (CAST(:e AS uuid), now() + :d, "
                    "now() + :d + interval '2 hours', 8, 0, true, 'test', now(), 'open') RETURNING id"
                ),
                {"e": tour_id, "d": starts_in},
            )
        ).scalar_one()
        await session.commit()
    return str(slot)


async def _book(client: AsyncClient, tour_slug: str, slot_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/api/v1/guides/tours/{tour_slug}/book",
        json={"slot_id": slot_id, "adults": 2},
        headers={"Idempotency-Key": f"after-{uuid4().hex}"},
    )
    assert response.status_code == 200, response.text
    return dict(response.json())


async def _events(user_id: str, event: str) -> int:
    async with TestingSessionLocal() as session:
        return int(
            (
                await session.execute(
                    text(
                        "SELECT count(*) FROM app.notifications WHERE user_id = CAST(:u AS uuid) "
                        "AND event_type = :e AND channel = 'in_app'"
                    ),
                    {"u": user_id, "e": event},
                )
            ).scalar_one()
        )


async def _ready(clients: dict[str, AsyncClient], title: str) -> dict[str, Any]:
    guide = clients["guide"]
    profile = await _approved_guide(clients)
    await _rules(guide, min_notice_hours=0, buffer_minutes=0)
    tour = await _live_tour(guide, profile, title)
    settings_ = await guide.put(
        f"/api/v1/guides/me/tours/{tour['id']}/booking-settings", json={"instant_booking": True}
    )
    assert settings_.status_code == 200
    async with TestingSessionLocal() as session:
        guide_user = (
            await session.execute(
                text("SELECT user_id FROM app.guide_profiles WHERE id = CAST(:g AS uuid)"), {"g": profile["id"]}
            )
        ).scalar_one()
    return {"profile": profile, "tour": tour, "guide_user": str(guide_user)}


@pytest.mark.asyncio
async def test_my_bookings_a_calendar_file_and_im_here(clients: dict[str, AsyncClient]) -> None:
    traveller = clients["traveller"]
    ready = await _ready(clients, "Saida sea castle")
    tour = ready["tour"]
    soon = await _slot(tour["id"], timedelta(minutes=10))
    later = await _slot(tour["id"], timedelta(days=3))
    await _register(traveller, "traveller", verify=True)
    now_booking = await _book(traveller, tour["slug"], soon)
    later_booking = await _book(traveller, tour["slug"], later)

    upcoming = (await traveller.get("/api/v1/guides/my-bookings")).json()
    assert [row["id"] for row in upcoming] == [now_booking["id"], later_booking["id"]], "soonest first"
    assert (await traveller.get("/api/v1/guides/my-bookings", params={"when": "past"})).json() == []

    ics = await traveller.get(f"/api/v1/guides/bookings/{later_booking['id']}/calendar.ics")
    assert ics.status_code == 200
    assert ics.headers["content-type"].startswith("text/calendar")
    body = ics.text
    assert body.startswith("BEGIN:VCALENDAR\r\n") and "BEGIN:VEVENT" in body and body.endswith("END:VCALENDAR\r\n")
    assert later_booking["code"] in body and "STATUS:CONFIRMED" in body
    assert all(len(line.encode()) <= 75 for line in body.split("\r\n")), "lines are folded"

    early = await traveller.post(f"/api/v1/guides/bookings/{later_booking['id']}/arrived")
    assert early.status_code == 422, "three days early is not at the meeting point"
    here = await traveller.post(f"/api/v1/guides/bookings/{now_booking['id']}/arrived")
    assert here.status_code == 200, here.text
    assert here.json()["arrived_at"] is not None
    assert here.json()["guide_phone"] is None or isinstance(here.json()["guide_phone"], str)
    assert here.json()["meeting_lat"] is not None
    assert await _events(ready["guide_user"], "guide.traveller_arrived") == 1

    stranger = clients["other"]
    await _register(stranger, "stranger")
    assert (await stranger.get(f"/api/v1/guides/bookings/{now_booking['id']}/calendar.ics")).status_code == 404


@pytest.mark.asyncio
async def test_each_reminder_is_sent_once(clients: dict[str, AsyncClient]) -> None:
    traveller, anon = clients["traveller"], clients["anon"]
    ready = await _ready(clients, "Anjar ruins at noon")
    tour = ready["tour"]
    user = await _register(traveller, "traveller", verify=True)
    await _book(traveller, tour["slug"], await _slot(tour["id"], timedelta(minutes=90)))
    await _book(traveller, tour["slug"], await _slot(tour["id"], timedelta(hours=20)))

    job = {"X-Job-Token": settings.job_token}
    first = await anon.post("/api/v1/guides/ops/reminders", headers=job)
    assert first.status_code == 200, first.text
    assert await _events(user["id"], "guide.tour_soon") == 1
    assert await _events(user["id"], "guide.tour_tomorrow") == 1
    assert await _events(ready["guide_user"], "guide.manifest") == 1

    again = await anon.post("/api/v1/guides/ops/reminders", headers=job)
    assert again.status_code == 200
    assert await _events(user["id"], "guide.tour_soon") == 1, "never twice"
    assert await _events(user["id"], "guide.tour_tomorrow") == 1
    assert await _events(ready["guide_user"], "guide.manifest") == 1


@pytest.mark.asyncio
async def test_a_rainy_forecast_warns_the_guide_once(
    clients: dict[str, AsyncClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    traveller, anon = clients["traveller"], clients["anon"]
    ready = await _ready(clients, "Chouf cedar walk")
    tour = ready["tour"]
    await _register(traveller, "traveller", verify=True)
    await _book(traveller, tour["slug"], await _slot(tour["id"], timedelta(hours=48)))

    class Rainy:
        def forecast(self, lat: float, lng: float, day: date) -> Forecast:
            return Forecast(
                available=True,
                provider="test",
                source="test",
                forecast_date=day,
                lat=lat,
                lng=lng,
                fetched_at=datetime.now(),
                precip_mm=14.0,
                temp_max_c=19.0,
                wind_kmh=20.0,
            )

    monkeypatch.setattr(guides_endpoint, "WeatherService", Rainy)
    job = {"X-Job-Token": settings.job_token}
    warned = await anon.post("/api/v1/guides/ops/weather-alerts", headers=job)
    assert warned.status_code == 200, warned.text
    assert warned.json()["warned"] >= 1
    assert await _events(ready["guide_user"], "guide.weather_alert") == 1
    await anon.post("/api/v1/guides/ops/weather-alerts", headers=job)
    assert await _events(ready["guide_user"], "guide.weather_alert") == 1, "once per run"


@pytest.mark.asyncio
async def test_messages_mask_contact_details_until_a_confirmed_booking(clients: dict[str, AsyncClient]) -> None:
    guide, traveller, other = clients["guide"], clients["traveller"], clients["other"]
    ready = await _ready(clients, "Tripoli souks by the clock tower")
    await _register(traveller, "traveller", verify=True)

    started = await traveller.post(
        "/api/v1/guides/conversations",
        json={
            "guide_slug": ready["profile"]["slug"],
            "body": "Hi! Can we do Sunday? Call me on +961 70 123 456 or maya@example.com",
        },
    )
    assert started.status_code == 200, started.text
    thread = started.json()
    assert thread["contact_open"] is False
    [message] = thread["messages"]
    assert message["masked"] is True
    assert "+961" not in message["body"] and "example.com" not in message["body"]
    assert "[shared after booking]" in message["body"] and "Sunday" in message["body"]

    inbox = (await guide.get("/api/v1/guides/conversations")).json()
    mine = next(row for row in inbox if row["id"] == thread["id"])
    assert mine["role"] == "guide" and mine["unread"] == 1
    opened = (await guide.get(f"/api/v1/guides/conversations/{thread['id']}")).json()
    assert opened["unread"] == 0
    reply = await guide.post(
        f"/api/v1/guides/conversations/{thread['id']}/messages", json={"body": "Sunday at 10 works."}
    )
    assert reply.status_code == 200
    assert await _events(ready["guide_user"], "guide.new_message") == 1

    await _register(other, "stranger")
    assert (await other.get(f"/api/v1/guides/conversations/{thread['id']}")).status_code == 404

    # Once they have a confirmed booking together, details go through.
    tour = ready["tour"]
    await _book(traveller, tour["slug"], await _slot(tour["id"], timedelta(days=4)))
    open_now = await traveller.post(
        f"/api/v1/guides/conversations/{thread['id']}/messages", json={"body": "My number is +961 70 123 456"}
    )
    assert open_now.json()["contact_open"] is True
    assert open_now.json()["messages"][-1]["body"] == "My number is +961 70 123 456"

    reported = await traveller.post(
        f"/api/v1/guides/conversations/{thread['id']}/close", json={"report": True, "reason": "Rude replies"}
    )
    assert reported.status_code == 200 and reported.json()["blocked"] is True
    closed = await guide.post(f"/api/v1/guides/conversations/{thread['id']}/messages", json={"body": "Hello?"})
    assert closed.status_code == 422
    async with TestingSessionLocal() as session:
        cases = (
            await session.execute(
                text(
                    "SELECT count(*) FROM app.support_cases WHERE reason = 'guide_conduct' "
                    "AND evidence @> CAST(:e AS jsonb)"
                ),
                {"e": f'[{{"conversation_id": "{thread["id"]}"}}]'},
            )
        ).scalar_one()
    assert cases == 1, "support gets the thread"
