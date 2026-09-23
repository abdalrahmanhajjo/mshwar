"""G5: running the day - the day sheet, start and complete, two-sided reviews.

What must hold: a day sheet belongs to its guide only, phones appear only for
confirmed travellers, a tour cannot be finished before it ends, completing it
completes the bookings, and neither side sees the other's review until both are
written.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_engagements import _approve, _plan
from tests.test_guide_tours import _client, _photo, _register, _tour


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "maya": _client(), "omar": _client(), "stranger": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _tour_that_ran(clients: dict[str, AsyncClient], *, ended: bool = True) -> dict[str, Any]:
    """A published tour with a start in the past (or running now) and two travellers booked."""
    guide = clients["guide"]
    profile = await _approve(guide, clients["admin"], "licensed", ["beirut"])
    tour = (
        await guide.put(
            "/api/v1/guides/me/tours", json=_tour(meeting={"name": "By the fountain", "lat": 33.89, "lng": 35.5})
        )
    ).json()
    await _photo(guide, profile["organization_id"], tour["id"])
    await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/publish")
    maya = await _register(clients["maya"], "maya", verify=True)
    omar = await _register(clients["omar"], "omar", verify=True)
    offset = timedelta(hours=-3) if ended else timedelta(minutes=-30)
    async with TestingSessionLocal() as session:
        slot = (
            await session.execute(
                text(
                    "INSERT INTO app.slots (experience_id, starts_at, ends_at, capacity, reserved, authoritative, "
                    "source, observed_at, status) VALUES (:e, now() + :off, "
                    "now() + :off + interval '2 hours', 8, 4, false, 'test', now(), 'open') RETURNING id"
                ),
                {"e": tour["id"], "off": offset},
            )
        ).scalar_one()
        for traveller, status in ((maya, "confirmed"), (omar, "pending")):
            await session.execute(
                text(
                    "INSERT INTO app.bookings (customer_id, organization_id, experience_id, slot_id, party_size, status, "
                    "mode, hold_until, inventory_reserved, currency, total_minor, payment_required, price_snapshot, "
                    "policy_snapshot, request_key, request_hash, traveller_note) VALUES (:c, :o, :e, :s, 2, :status, 'request', now() + interval '1 day', true, "
                    "'USD', 5000, false, '{}', '{}', :key, :hash, 'One of us uses a cane')"
                ),
                {
                    "c": traveller["id"],
                    "o": profile["organization_id"],
                    "e": tour["id"],
                    "s": slot,
                    "status": status,
                    "key": f"day-{uuid4().hex}",
                    "hash": uuid4().hex,
                },
            )
        await session.execute(
            text(
                "INSERT INTO app.user_private (user_id, phone) VALUES (:u, '+961 70 111 222') "
                "ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone"
            ),
            {"u": maya["id"]},
        )
        await session.execute(
            text(
                "INSERT INTO app.user_private (user_id, phone) VALUES (:u, '+961 70 333 444') "
                "ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone"
            ),
            {"u": omar["id"]},
        )
        await session.commit()
    return {"profile": profile, "tour": tour, "slot_id": str(slot), "maya": maya, "omar": omar}


@pytest.mark.asyncio
async def test_a_tour_day_runs_and_both_sides_review(clients: dict[str, AsyncClient]) -> None:
    guide, maya = clients["guide"], clients["maya"]
    ran = await _tour_that_ran(clients)
    day = ran["slot_id"]

    sheet = await guide.get(f"/api/v1/guides/me/days/{day}")
    assert sheet.status_code == 200, sheet.text
    body = sheet.json()
    assert body["kind"] == "tour"
    assert body["meeting"]["name"] == "By the fountain"
    roster = {row["name"]: row for row in body["roster"]}
    assert roster["Maya"]["phone"] == "+961 70 111 222"
    assert roster["Omar"]["phone"] is None, "no phone before the booking is confirmed"
    assert roster["Maya"]["note"] == "One of us uses a cane"
    assert body["people"] == 2

    assert (await clients["stranger"].get(f"/api/v1/guides/me/days/{day}")).status_code in {401, 404}

    started = await guide.post(f"/api/v1/guides/me/days/{day}/start")
    assert started.status_code == 200, started.text
    assert started.json()["run"]["state"] == "started"
    completed = await guide.post(f"/api/v1/guides/me/days/{day}/complete")
    assert completed.status_code == 200, completed.text
    run_id = completed.json()["run"]["id"]
    assert completed.json()["run"]["state"] == "completed"
    assert {row["name"]: row["status"] for row in completed.json()["roster"]}["Maya"] == "completed"

    inbox = (await guide.get("/api/v1/guides/reviews/inbox")).json()
    assert [row["traveller_name"] for row in inbox["to_review_as_guide"]] == ["Maya"], "only who actually came"
    theirs = (await maya.get("/api/v1/guides/reviews/inbox")).json()
    assert [row["guide_slug"] for row in theirs["to_review_as_traveller"]] == [ran["profile"]["slug"]]

    first = await maya.post("/api/v1/guides/reviews", json={"run_id": run_id, "rating": 5, "body": "Knew every alley"})
    assert first.status_code == 200, first.text
    assert first.json()["released"] is False, "held until the guide writes theirs"
    public = await clients["stranger"].get(f"/api/v1/guides/{ran['profile']['slug']}/reviews")
    assert public.json()["count"] == 0

    twice = await maya.post("/api/v1/guides/reviews", json={"run_id": run_id, "rating": 1})
    assert twice.status_code == 422
    uninvited = await clients["omar"].post("/api/v1/guides/reviews", json={"run_id": run_id, "rating": 1})
    assert uninvited.status_code == 404, "a pending booking did not take part"

    second = await guide.post(
        "/api/v1/guides/reviews",
        json={"run_id": run_id, "traveller_id": ran["maya"]["id"], "rating": 5, "body": "On time, curious"},
    )
    assert second.status_code == 200, second.text
    assert second.json()["released"] is True, "both halves are in, so both are released"

    public = (await clients["stranger"].get(f"/api/v1/guides/{ran['profile']['slug']}/reviews")).json()
    assert public["count"] == 1 and float(public["average"]) == 5.0
    assert public["recent"][0]["body"] == "Knew every alley"
    mine = (await maya.get("/api/v1/guides/reviews/inbox")).json()
    assert mine["about_me_as_traveller"][0]["body"] == "On time, curious"


@pytest.mark.asyncio
async def test_a_tour_cannot_be_finished_before_it_ends(clients: dict[str, AsyncClient]) -> None:
    guide = clients["guide"]
    ran = await _tour_that_ran(clients, ended=False)
    early = await guide.post(f"/api/v1/guides/me/days/{ran['slot_id']}/complete")
    assert early.status_code == 422
    assert "once it has ended" in early.text
    started = await guide.post(f"/api/v1/guides/me/days/{ran['slot_id']}/start")
    assert started.status_code == 200
    again = await guide.post(f"/api/v1/guides/me/days/{ran['slot_id']}/start")
    assert again.status_code == 422

    days = (await guide.get("/api/v1/guides/me/days")).json()
    assert any(row["id"] == ran["slot_id"] and row["state"] == "started" for row in days)


@pytest.mark.asyncio
async def test_a_hired_day_has_a_sheet_with_the_group_notes(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["maya"]
    licensed = await _approve(guide, clients["admin"], "licensed", ["byblos"])
    await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 10000})
    me = await _register(traveller, "hirer", verify=True)
    plan = await _plan(me["id"])
    asked = (
        await traveller.post(
            "/api/v1/guides/engagements",
            json={
                "version_id": plan["version_id"],
                "guide_slug": licensed["slug"],
                "party_notes": {"dietary": "no pork", "accessibility": "no long stairs"},
                "contact_phone": "+961 3 555 555",
            },
        )
    ).json()
    early = await guide.get(f"/api/v1/guides/me/days/{asked['id']}")
    assert early.status_code == 404, "no day sheet until the day is agreed"
    await guide.post(f"/api/v1/guides/me/engagements/{asked['id']}/answer", json={"answer": "accept"})
    await traveller.post(f"/api/v1/guides/engagements/{asked['id']}/decision", json={"decision": "confirm"})

    sheet = (await guide.get(f"/api/v1/guides/me/days/{asked['id']}")).json()
    assert sheet["kind"] == "hire"
    assert len(sheet["stops"]) == 2
    [group] = sheet["roster"]
    assert group["notes"]["dietary"] == "no pork"
    assert group["notes"]["accessibility"] == "no long stairs"
    assert group["phone"] == "+961 3 555 555"
    assert group["collect_minor"] == 10000

    too_early = await guide.post(f"/api/v1/guides/me/days/{asked['id']}/start")
    assert too_early.status_code == 422, "a day ten days out cannot start today"

    # The day arrives: move the plan's stops to this morning.
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE app.trip_stops SET starts_at = now() - interval '6 hours' + position * interval '2 hours', "
                "ends_at = now() - interval '6 hours' + position * interval '2 hours' + interval '90 minutes' "
                "WHERE version_id = :v"
            ),
            {"v": plan["version_id"]},
        )
        await session.commit()
    done = await guide.post(f"/api/v1/guides/me/days/{asked['id']}/complete")
    assert done.status_code == 200, done.text
    state = (await traveller.get(f"/api/v1/guides/engagements/{asked['id']}")).json()["state"]
    assert state == "completed"
    owed = (await traveller.get("/api/v1/guides/reviews/inbox")).json()["to_review_as_traveller"]
    assert owed and owed[0]["guide_slug"] == licensed["slug"]
