"""G3: a traveller hires a licensed guide for a planned day.

What must hold whatever the screens do: a local host is never offered and cannot
be hired, a guide's counter-proposal is a diff against the version it answers and
may not touch a stop the traveller locked, accepting it writes a new version the
engagement then follows, and phone numbers only cross once both sides said yes.
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

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_tours import _client, _register

BEIRUT = ZoneInfo("Asia/Beirut")


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "host": _client(), "admin": _client(), "traveller": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _approve(guide: AsyncClient, admin: AsyncClient, tier: str, regions: list[str]) -> dict[str, Any]:
    await _register(guide, f"{tier}-hire")
    applied = await guide.put(
        "/api/v1/guides/me",
        json={"tier": tier, "display_name": f"{tier.title()} Guide", "languages": ["ar", "en"], "regions": regions},
    )
    profile = applied.json()
    for kind in profile["required_documents"]:
        body: dict[str, Any] = {"kind": kind, "document_key": f"private/{kind}-{uuid4().hex[:8]}.pdf"}
        if kind == "licence":
            body["expires_on"] = (date.today() + timedelta(days=365)).isoformat()
        await guide.put("/api/v1/guides/me/documents", json=body)
    await guide.put("/api/v1/guides/me/agreement", json={"version": "2026-09-22"})
    await guide.post("/api/v1/guides/me/submit")
    if not admin.cookies:
        admin_user = await _register(admin, "admin")
        async with TestingSessionLocal() as session:
            await session.execute(text("SELECT app.grant_platform_admin(:u, NULL, 'ops')"), {"u": admin_user["id"]})
            await session.commit()
    case = await admin.get(f"/api/v1/admin/guides/{profile['id']}")
    for document in case.json()["documents"]:
        await admin.post(f"/api/v1/admin/guides/documents/{document['id']}", json={"decision": "verified"})
    approved = await admin.post(f"/api/v1/admin/guides/{profile['id']}", json={"decision": "approved"})
    assert approved.status_code == 200, approved.text
    return dict(approved.json())


async def _plan(traveller_id: str, *, days_ahead: int = 10, lock_first: bool = False) -> dict[str, Any]:
    """A two-stop Byblos day owned by the traveller, written straight into the planner tables."""
    day = (datetime.now(BEIRUT) + timedelta(days=days_ahead)).replace(hour=9, minute=0, second=0, microsecond=0)
    async with TestingSessionLocal() as session:
        stops = (
            await session.execute(
                text(
                    "SELECT e.id, e.slug FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id "
                    "JOIN app.destinations d ON d.id = v.destination_id "
                    "WHERE e.status = 'published' AND d.slug = 'byblos' ORDER BY e.slug LIMIT 2"
                )
            )
        ).all()
        trip = (
            await session.execute(
                text("INSERT INTO app.trips (owner_id, title) VALUES (:u, 'Byblos day') RETURNING id"),
                {"u": traveller_id},
            )
        ).scalar_one()
        version = (
            await session.execute(
                text(
                    "INSERT INTO app.trip_versions (trip_id, version, created_by, origin, window_start, return_by, "
                    "start_location, party_size, budget_minor, currency) VALUES (:t, 1, :u, 'manual', :start, :end, "
                    "ST_SetSRID(ST_MakePoint(35.64, 34.12), 4326)::geography, 4, 40000, 'USD') RETURNING id"
                ),
                {"t": trip, "u": traveller_id, "start": day, "end": day + timedelta(hours=9)},
            )
        ).scalar_one()
        ids = []
        for position, (experience_id, _slug) in enumerate(stops, start=1):
            starts = day + timedelta(hours=2 * (position - 1))
            ids.append(
                (
                    await session.execute(
                        text(
                            "INSERT INTO app.trip_stops (version_id, experience_id, position, starts_at, ends_at, "
                            "estimated_minor, price_kind, locked, snapshot) VALUES (:v, :e, :p, :s, :f, 0, 'estimate', "
                            ":locked, '{}') RETURNING id"
                        ),
                        {
                            "v": version,
                            "e": experience_id,
                            "p": position,
                            "s": starts,
                            "f": starts + timedelta(minutes=90),
                            "locked": lock_first and position == 1,
                        },
                    )
                ).scalar_one()
            )
        await session.commit()
    return {"trip_id": str(trip), "version_id": str(version), "stop_ids": [str(i) for i in ids], "day": day}


@pytest.mark.asyncio
async def test_a_traveller_hires_a_guide_who_answers_with_changes(clients: dict[str, AsyncClient]) -> None:
    guide, host, admin, traveller = clients["guide"], clients["host"], clients["admin"], clients["traveller"]
    licensed = await _approve(guide, admin, "licensed", ["byblos"])
    await _approve(host, admin, "host", ["byblos"])

    no_rate = await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 12000, "max_group": 8})
    assert no_rate.status_code == 200, no_rate.text
    assert no_rate.json()["hireable"] is True
    refused = await host.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 5000})
    assert refused.status_code == 422, "a local host has no day rate"

    me = await _register(traveller, "hirer", verify=True)
    plan = await _plan(me["id"], lock_first=True)

    matched = await traveller.get("/api/v1/guides/match", params={"version_id": plan["version_id"]})
    assert matched.status_code == 200, matched.text
    slugs = [row["slug"] for row in matched.json()]
    assert licensed["slug"] in slugs
    assert all(row["tier"] == "licensed" for row in matched.json()), "a local host is never offered"

    host_slug = (await host.get("/api/v1/guides/me")).json()["slug"]
    sneaky = await traveller.post(
        "/api/v1/guides/engagements", json={"version_id": plan["version_id"], "guide_slug": host_slug}
    )
    assert sneaky.status_code == 403, "and cannot be hired by asking directly"

    asked = await traveller.post(
        "/api/v1/guides/engagements",
        json={
            "version_id": plan["version_id"],
            "guide_slug": licensed["slug"],
            "message": "Two of us are slow walkers",
            "party_notes": {"dietary": "one vegetarian", "children": "a 9-year-old"},
            "contact_phone": "+961 3 000 000",
        },
    )
    assert asked.status_code == 200, asked.text
    engagement = asked.json()
    assert engagement["state"] == "requested"
    assert engagement["rate_minor"] == 12000
    assert engagement["contact"] is None, "no phone numbers before both sides say yes"

    twice = await traveller.post(
        "/api/v1/guides/engagements", json={"version_id": plan["version_id"], "guide_slug": licensed["slug"]}
    )
    assert twice.status_code in {409, 422}

    inbox = await guide.get("/api/v1/guides/me/engagements", params={"state": "requested"})
    assert [row["id"] for row in inbox.json()] == [engagement["id"]]
    seen = inbox.json()[0]
    assert seen["viewer_role"] == "guide"
    assert seen["party_notes"]["dietary"] == "one vegetarian"
    assert "phone" not in str(seen["contact"])

    first, second = plan["stop_ids"]
    stops = engagement["itinerary"]["stops"]
    locked_moved = await guide.post(
        f"/api/v1/guides/me/engagements/{engagement['id']}/proposal",
        json={
            "stops": [
                {
                    "stop_id": first,
                    "starts_at": _shift(stops[0]["starts_at"], 30),
                    "ends_at": _shift(stops[0]["ends_at"], 30),
                },
                {"stop_id": second, "starts_at": stops[1]["starts_at"], "ends_at": stops[1]["ends_at"]},
            ]
        },
    )
    assert locked_moved.status_code == 422
    assert "locked stop cannot be changed" in locked_moved.text

    dropped_locked = await guide.post(
        f"/api/v1/guides/me/engagements/{engagement['id']}/proposal",
        json={"stops": [{"stop_id": second, "starts_at": stops[1]["starts_at"], "ends_at": stops[1]["ends_at"]}]},
    )
    assert dropped_locked.status_code == 422
    assert "locked stop cannot be removed" in dropped_locked.text

    async with TestingSessionLocal() as session:
        extra = (
            await session.execute(
                text(
                    "SELECT e.slug FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id "
                    "JOIN app.destinations d ON d.id = v.destination_id WHERE e.status = 'published' "
                    "AND d.slug = 'byblos' ORDER BY e.slug OFFSET 2 LIMIT 1"
                )
            )
        ).scalar_one()
    proposed = await guide.post(
        f"/api/v1/guides/me/engagements/{engagement['id']}/proposal",
        json={
            "stops": [
                {"stop_id": first, "starts_at": stops[0]["starts_at"], "ends_at": stops[0]["ends_at"]},
                {
                    "slug": extra,
                    "starts_at": _shift(stops[0]["ends_at"], 15),
                    "ends_at": _shift(stops[0]["ends_at"], 75),
                },
                {
                    "stop_id": second,
                    "starts_at": _shift(stops[1]["starts_at"], 60),
                    "ends_at": _shift(stops[1]["ends_at"], 60),
                },
            ],
            "note": "The harbour is quieter after the souk",
        },
    )
    assert proposed.status_code == 200, proposed.text
    diff = proposed.json()["proposal"]["diff"]
    assert [row["slug"] for row in diff["added"]] == [extra]
    assert [row["stop_id"] for row in diff["retimed"]] == [second]
    assert [row["stop_id"] for row in diff["moved"]] == [second]
    assert diff["removed"] == []

    accepted = await traveller.post(
        f"/api/v1/guides/engagements/{engagement['id']}/decision", json={"decision": "accept_changes"}
    )
    assert accepted.status_code == 200, accepted.text
    body = accepted.json()
    assert body["state"] == "confirmed"
    assert body["itinerary"]["version"] == 2, "accepting writes a new version of the plan"
    assert [stop["slug"] for stop in body["itinerary"]["stops"]][1] == extra
    assert body["itinerary"]["stops"][0]["locked"] is True, "the lock travels with the stop"
    assert body["contact"] == {"phone": ""}, "the guide's phone (none on file) is now shared"

    guide_view = await guide.get(f"/api/v1/guides/engagements/{engagement['id']}")
    assert guide_view.json()["contact"] == {"phone": "+961 3 000 000"}

    versions = await traveller.get(f"/api/v1/planner/trips/{plan['trip_id']}/versions")
    assert versions.status_code == 200
    assert len(versions.json()) == 2

    # One hired day at a time: the same guide is no longer offered for that date.
    other = await _plan(me["id"])
    again = await traveller.get("/api/v1/guides/match", params={"version_id": other["version_id"]})
    assert licensed["slug"] not in [row["slug"] for row in again.json()]


def _shift(value: str, minutes: int) -> str:
    return (datetime.fromisoformat(value) + timedelta(minutes=minutes)).isoformat()


@pytest.mark.asyncio
async def test_accept_then_confirm_and_either_side_can_cancel(clients: dict[str, AsyncClient]) -> None:
    guide, admin, traveller = clients["guide"], clients["admin"], clients["traveller"]
    licensed = await _approve(guide, admin, "licensed", ["mount-lebanon"])
    await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 9000})
    me = await _register(traveller, "planner", verify=True)
    plan = await _plan(me["id"])

    asked = (
        await traveller.post(
            "/api/v1/guides/engagements", json={"version_id": plan["version_id"], "guide_slug": licensed["slug"]}
        )
    ).json()
    early = await traveller.post(f"/api/v1/guides/engagements/{asked['id']}/decision", json={"decision": "confirm"})
    assert early.status_code == 422, "nothing to confirm until the guide says yes"

    yes = await guide.post(f"/api/v1/guides/me/engagements/{asked['id']}/answer", json={"answer": "accept"})
    assert yes.json()["state"] == "accepted"
    confirmed = await traveller.post(f"/api/v1/guides/engagements/{asked['id']}/decision", json={"decision": "confirm"})
    assert confirmed.json()["state"] == "confirmed"

    silent = await guide.post(f"/api/v1/guides/engagements/{asked['id']}/cancel", json={"reason": ""})
    assert silent.status_code == 422, "a guide who cancels says why"
    cancelled = await guide.post(
        f"/api/v1/guides/engagements/{asked['id']}/cancel", json={"reason": "Family emergency"}
    )
    assert cancelled.json()["state"] == "cancelled"

    async with TestingSessionLocal() as session:
        events = (
            (
                await session.execute(
                    text("SELECT event_type FROM app.outbox WHERE aggregate_id = :id ORDER BY created_at"),
                    {"id": asked["id"]},
                )
            )
            .scalars()
            .all()
        )
    assert "engagement.requested" in events and "engagement.cancelled_by_guide" in events


@pytest.mark.asyncio
async def test_a_lapsed_licence_takes_a_guide_off_the_planner(clients: dict[str, AsyncClient]) -> None:
    guide, admin, traveller = clients["guide"], clients["admin"], clients["traveller"]
    licensed = await _approve(guide, admin, "licensed", ["byblos"])
    await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 9000})
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE app.guide_credentials SET expires_on = current_date - 1 "
                "WHERE guide_profile_id = :g AND kind = 'licence'"
            ),
            {"g": licensed["id"]},
        )
        await session.commit()
    me = await _register(traveller, "late", verify=True)
    plan = await _plan(me["id"])
    matched = await traveller.get("/api/v1/guides/match", params={"version_id": plan["version_id"]})
    assert licensed["slug"] not in [row["slug"] for row in matched.json()]
    direct = await traveller.post(
        "/api/v1/guides/engagements", json={"version_id": plan["version_id"], "guide_slug": licensed["slug"]}
    )
    assert direct.status_code in {403, 422}


@pytest.mark.asyncio
async def test_a_stranger_cannot_read_or_answer_an_engagement(clients: dict[str, AsyncClient]) -> None:
    guide, admin, traveller, stranger = clients["guide"], clients["admin"], clients["traveller"], clients["host"]
    licensed = await _approve(guide, admin, "licensed", ["byblos"])
    await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 9000})
    me = await _register(traveller, "owner", verify=True)
    plan = await _plan(me["id"])
    asked = (
        await traveller.post(
            "/api/v1/guides/engagements", json={"version_id": plan["version_id"], "guide_slug": licensed["slug"]}
        )
    ).json()

    await _register(stranger, "nosy")
    assert (await stranger.get(f"/api/v1/guides/engagements/{asked['id']}")).status_code == 404
    assert (await stranger.get("/api/v1/guides/match", params={"version_id": plan["version_id"]})).status_code == 404
    answer = await stranger.post(f"/api/v1/guides/me/engagements/{asked['id']}/answer", json={"answer": "accept"})
    assert answer.status_code == 404
