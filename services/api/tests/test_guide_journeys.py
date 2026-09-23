"""G6: the three guide journeys, end to end through the API.

1. A local host goes from application to a confirmed free walk with a day sheet.
2. A traveller hires a licensed guide for a planned day, the guide answers with
   changes, the day runs, and both sides review each other.
3. A guide adds a missing place, a reviewer accepts it, it is credited, and the
   guide routes a tour through it.

Each journey only uses the HTTP API, except where time has to pass (a planned
day arriving), which is simulated by moving the plan's stops.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.media_fixtures import b64, tiny_jpeg
from tests.test_guide_engagements import _plan
from tests.test_guide_tours import _client, _register

AGREEMENT = {"version": "2026-09-22"}


@pytest.fixture
async def people() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "traveller": _client(), "public": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _admin(admin: AsyncClient) -> None:
    user = await _register(admin, "ops")
    async with TestingSessionLocal() as session:
        await session.execute(text("SELECT app.grant_platform_admin(:u, NULL, 'ops')"), {"u": user["id"]})
        await session.commit()


async def _become_guide(guide: AsyncClient, admin: AsyncClient, tier: str, regions: list[str]) -> dict[str, Any]:
    """Apply, accept the agreement, attach documents, and be approved by a reviewer."""
    await _register(guide, f"{tier}-journey")
    profile = (
        await guide.put(
            "/api/v1/guides/me",
            json={"tier": tier, "display_name": "Layla Khoury", "languages": ["ar", "en", "fr"], "regions": regions},
        )
    ).json()
    assert profile["status"] == "draft"
    assert (await guide.put("/api/v1/guides/me/agreement", json=AGREEMENT)).status_code == 200
    for kind in profile["required_documents"]:
        body: dict[str, Any] = {"kind": kind, "document_key": f"private/{kind}-{uuid4().hex[:8]}.pdf"}
        if kind == "licence":
            body["expires_on"] = (date.today() + timedelta(days=400)).isoformat()
        assert (await guide.put("/api/v1/guides/me/documents", json=body)).status_code == 200
    assert (await guide.post("/api/v1/guides/me/submit")).json()["status"] == "submitted"

    case = (await admin.get(f"/api/v1/admin/guides/{profile['id']}")).json()
    for document in case["documents"]:
        await admin.post(f"/api/v1/admin/guides/documents/{document['id']}", json={"decision": "verified"})
    approved = await admin.post(f"/api/v1/admin/guides/{profile['id']}", json={"decision": "approved"})
    assert approved.status_code == 200, approved.text
    return dict(approved.json())


@pytest.mark.asyncio
async def test_journey_a_local_host_runs_a_free_walk(people: dict[str, AsyncClient]) -> None:
    guide, admin, traveller, public = people["guide"], people["admin"], people["traveller"], people["public"]
    await _admin(admin)
    host = await _become_guide(guide, admin, "host", ["beirut"])
    assert host["badge"] is False and host["hireable"] is False, "a host has no badge and is not hired"

    tour = (
        await guide.put(
            "/api/v1/guides/me/tours",
            json={
                "title": "Gemmayzeh stairs at sunset",
                "description": "An hour up and down the painted stairs, with the stories behind them.",
                "duration_minutes": 60,
                "max_party": 6,
                "price_minor": 0,
                "meeting": {"name": "Saint Nicolas stairs, bottom step", "lat": 33.8937, "lng": 35.5146},
            },
        )
    ).json()
    await guide.post(
        f"/api/v1/portal/organizations/{host['organization_id']}/files",
        json={
            "filename": "stairs.jpg",
            "content_type": "image/jpeg",
            "content_base64": b64(tiny_jpeg()),
            "purpose": "listing",
            "experience_id": tour["id"],
        },
    )
    assert (await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/publish")).json()["status"] == "published"
    await guide.put(
        "/api/v1/guides/me/availability",
        json={"pattern": [{"weekday": d, "start": "17:30"} for d in range(7)], "min_notice_hours": 2},
    )
    assert (await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/slots", params={"days": 5})).json()["created"] >= 3

    [listed] = (await public.get(f"/api/v1/guides/{host['slug']}/tours")).json()
    assert listed["price_minor"] == 0
    await _register(traveller, "walker", verify=True)
    request = (
        await traveller.post(
            f"/api/v1/guides/tours/{listed['slug']}/request",
            json={"slot_id": listed["next_slots"][0]["id"], "party_size": 2},
        )
    ).json()
    assert request["status"] == "pending" and request["payment_required"] is False

    confirmed = await guide.post(
        f"/api/v1/guides/me/requests/{request['id']}/respond", json={"status": "confirmed", "reason": "See you there"}
    )
    assert confirmed.json()["status"] == "confirmed"

    days = (await guide.get("/api/v1/guides/me/days")).json()
    [day] = [row for row in days if row["kind"] == "tour"]
    sheet = (await guide.get(f"/api/v1/guides/me/days/{day['id']}")).json()
    assert sheet["meeting"]["name"] == "Saint Nicolas stairs, bottom step"
    assert sheet["people"] == 2
    assert sheet["roster"][0]["collect_minor"] == 0


@pytest.mark.asyncio
async def test_journey_a_traveller_hires_a_guide_and_both_review(people: dict[str, AsyncClient]) -> None:
    guide, admin, traveller, public = people["guide"], people["admin"], people["traveller"], people["public"]
    await _admin(admin)
    licensed = await _become_guide(guide, admin, "licensed", ["byblos"])
    assert licensed["badge"] is True
    await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 15000, "max_group": 10})

    me = await _register(traveller, "family", verify=True)
    plan = await _plan(me["id"], days_ahead=12)
    [match] = [
        row
        for row in (await traveller.get("/api/v1/guides/match", params={"version_id": plan["version_id"]})).json()
        if row["slug"] == licensed["slug"]
    ]
    assert match["day_rate_minor"] == 15000

    asked = (
        await traveller.post(
            "/api/v1/guides/engagements",
            json={
                "version_id": plan["version_id"],
                "guide_slug": licensed["slug"],
                "party_notes": {"children": "two, aged 6 and 9"},
                "contact_phone": "+961 71 000 111",
            },
        )
    ).json()
    stops = asked["itinerary"]["stops"]
    proposal = await guide.post(
        f"/api/v1/guides/me/engagements/{asked['id']}/proposal",
        json={
            "stops": [
                {"stop_id": stops[1]["id"], "starts_at": stops[0]["starts_at"], "ends_at": stops[0]["ends_at"]},
                {"stop_id": stops[0]["id"], "starts_at": stops[1]["starts_at"], "ends_at": stops[1]["ends_at"]},
            ],
            "note": "Harbour first, before the heat",
        },
    )
    assert proposal.status_code == 200, proposal.text
    assert {row["stop_id"] for row in proposal.json()["proposal"]["diff"]["moved"]} == {stops[0]["id"], stops[1]["id"]}

    confirmed = (
        await traveller.post(f"/api/v1/guides/engagements/{asked['id']}/decision", json={"decision": "accept_changes"})
    ).json()
    assert confirmed["state"] == "confirmed"
    assert confirmed["itinerary"]["version"] == 2
    assert [stop["id"] for stop in confirmed["itinerary"]["stops"]] != [stop["id"] for stop in stops]

    sheet = (await guide.get(f"/api/v1/guides/me/days/{asked['id']}")).json()
    assert sheet["roster"][0]["phone"] == "+961 71 000 111"
    assert sheet["roster"][0]["notes"]["children"] == "two, aged 6 and 9"

    # The day arrives.
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE app.trip_stops SET starts_at = now() - interval '7 hours' + position * interval '2 hours', "
                "ends_at = now() - interval '7 hours' + position * interval '2 hours' + interval '90 minutes' "
                "WHERE version_id = :v"
            ),
            {"v": confirmed["itinerary"]["version_id"]},
        )
        await session.commit()
    assert (await guide.post(f"/api/v1/guides/me/days/{asked['id']}/start")).status_code == 200
    run_id = (await guide.post(f"/api/v1/guides/me/days/{asked['id']}/complete")).json()["run"]["id"]

    mine = await traveller.post(
        "/api/v1/guides/reviews", json={"run_id": run_id, "rating": 5, "body": "The kids loved her"}
    )
    assert mine.json()["released"] is False
    assert (await public.get(f"/api/v1/guides/{licensed['slug']}/reviews")).json()["count"] == 0
    theirs = await guide.post(
        "/api/v1/guides/reviews", json={"run_id": run_id, "traveller_id": me["id"], "rating": 5, "body": "Punctual"}
    )
    assert theirs.json()["released"] is True
    shown = (await public.get(f"/api/v1/guides/{licensed['slug']}/reviews")).json()
    assert shown["count"] == 1 and shown["recent"][0]["body"] == "The kids loved her"


@pytest.mark.asyncio
async def test_journey_a_guide_adds_a_place_and_routes_a_tour_through_it(people: dict[str, AsyncClient]) -> None:
    guide, admin, public = people["guide"], people["admin"], people["public"]
    await _admin(admin)
    licensed = await _become_guide(guide, admin, "licensed", ["batroun"])

    proposal = (
        await guide.post(
            "/api/v1/guides/me/proposals",
            json={
                "kind": "new",
                "place": {
                    "name": "Old Phoenician sea wall steps",
                    "description": "A short flight of steps down to the old sea wall, quiet in the morning.",
                    "category": "heritage",
                    "destination_slug": "batroun",
                    "lat": 34.2553,
                    "lng": 35.6581,
                    "suggested_minutes": 30,
                    "free_entry": True,
                },
                "evidence_urls": ["https://en.wikipedia.org/wiki/Batroun"],
            },
        )
    ).json()
    decided = (
        await admin.post(
            f"/api/v1/admin/proposals/{proposal['id']}", json={"decision": "accepted", "reason": "Checked"}
        )
    ).json()
    place = decided["resulting_slug"]
    credit = (await public.get(f"/api/v1/guides/places/{place}/contributors")).json()
    assert credit == [
        {
            "role": "added",
            "slug": licensed["slug"],
            "display_name": "Layla Khoury",
            "tier": "licensed",
            "at": credit[0]["at"],
        }
    ]

    tour = await guide.put(
        "/api/v1/guides/me/tours",
        json={
            "title": "Batroun before breakfast",
            "description": "The old town and the sea wall while the streets are still empty.",
            "duration_minutes": 90,
            "max_party": 8,
            "price_minor": 2000,
            "meeting": {"name": "Saydet el Bahr church", "lat": 34.2551, "lng": 35.6579, "destination_slug": "batroun"},
            "route": [place],
        },
    )
    assert tour.status_code == 200, tour.text
    assert [stop["slug"] for stop in tour.json()["route"]] == [place], "the place the guide added is a real route stop"
