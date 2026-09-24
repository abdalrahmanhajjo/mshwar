"""V2: checked transport cards per destination.

A card shows only after a reviewer publishes it with a field check, and hides
itself 90 days after that check; travellers' flags send a wrong card back to
review; guides propose cards and updates with evidence; staff decide.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.partners_support import client
from tests.test_guide_tours import _approved_guide, _register


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": client(), "admin": client(), "traveller": client(), "anon": client()}
    try:
        yield made
    finally:
        for each in made.values():
            await each.aclose()


def _card(**overrides: Any) -> dict[str, Any]:
    card: dict[str, Any] = {
        "scope": "between",
        "from_destination": "beirut",
        "to_destination": "byblos",
        "mode": "van",
        "pickup_name": "Charles Helou station",
        "pickup_lat": 33.9003,
        "pickup_lng": 35.5186,
        "dropoff_name": "Byblos highway stop",
        "fare_basis": "person",
        "fare_low_minor": 200,
        "fare_high_minor": 400,
        "currency": "USD",
        "duration_min": 40,
        "duration_max": 75,
        "frequency_minutes": 15,
        "first_departure": "06:00",
        "last_departure": "19:00",
        "tips": {"en": "Ask for Jbeil and pay when you get off.", "de": "ignored"},
        "evidence": [{"kind": "guide_report", "note": "Took it on Tuesday morning"}],
    }
    card.update(overrides)
    return card


async def _admin(clients: dict[str, AsyncClient]) -> AsyncClient:
    admin = clients["admin"]
    user = await _register(admin, "transport-admin")
    async with TestingSessionLocal() as session:
        await session.execute(text("SELECT app.grant_platform_admin(:u, NULL, 'ops')"), {"u": user["id"]})
        await session.commit()
    return admin


@pytest.mark.asyncio
async def test_a_card_shows_only_after_a_field_check_and_hides_after_ninety_days(
    clients: dict[str, AsyncClient],
) -> None:
    admin, anon = await _admin(clients), clients["anon"]
    made = await admin.post("/api/v1/admin/transport", json=_card(evidence=[]))
    assert made.status_code == 200, made.text
    card = made.json()
    assert card["status"] == "submitted" and card["tips"] == {"en": "Ask for Jbeil and pay when you get off."}
    before = (await anon.get("/api/v1/transport/destinations/byblos")).json()
    assert all(item["id"] != card["id"] for item in before["from_beirut"])

    no_check = await admin.post(f"/api/v1/admin/transport/{card['id']}/decision", json={"decision": "published"})
    assert no_check.status_code == 422 and "field check" in no_check.text
    too_old = await admin.post(
        f"/api/v1/admin/transport/{card['id']}/decision",
        json={
            "decision": "published",
            "checked_on": (date.today() - timedelta(days=45)).isoformat(),
            "field_check_note": "Rode it end to end",
        },
    )
    assert too_old.status_code == 422
    published = await admin.post(
        f"/api/v1/admin/transport/{card['id']}/decision",
        json={"decision": "published", "field_check_note": "Rode it end to end, paid 3 USD"},
    )
    assert published.status_code == 200, published.text
    body = published.json()
    assert body["live"] is True
    assert date.fromisoformat(body["review_by"]) - date.fromisoformat(body["checked_on"]) == timedelta(days=90)
    assert body["evidence"][-1]["kind"] == "field_check"

    page = (await anon.get("/api/v1/transport/destinations/byblos")).json()
    shown = next(item for item in page["from_beirut"] if item["id"] == card["id"])
    assert shown["fare"] == {"basis": "person", "low_minor": 200, "high_minor": 400, "currency": "USD"}
    assert shown["pickup"]["name"] == "Charles Helou station" and round(shown["pickup"]["lat"], 4) == 33.9003
    assert "evidence" not in shown and "status" not in shown
    leg = (await anon.get("/api/v1/transport/between?from=beirut&to=byblos")).json()
    assert any(item["id"] == card["id"] for item in leg)
    assert (await anon.get("/api/v1/transport/destinations/atlantis")).status_code == 404

    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.transport_routes SET review_by = app.beirut_today() - 1 WHERE id = CAST(:id AS uuid)"),
            {"id": card["id"]},
        )
        await session.commit()
    stale = (await anon.get("/api/v1/transport/destinations/byblos")).json()
    assert all(item["id"] != card["id"] for item in stale["from_beirut"]), "hidden once past its review date"
    listed = (await admin.get("/api/v1/admin/transport?status=stale")).json()
    assert any(item["id"] == card["id"] for item in listed)
    swept = (await anon.post("/api/v1/partners/ops/sweep", headers={"X-Job-Token": settings.job_token})).json()
    assert swept["transport"]["back_to_review"] >= 1
    queue = (await admin.get("/api/v1/admin/transport")).json()
    assert next(item for item in queue if item["id"] == card["id"])["decision_reason"] == "review date passed"


@pytest.mark.asyncio
async def test_card_shapes_are_checked(clients: dict[str, AsyncClient]) -> None:
    admin = await _admin(clients)
    same = await admin.post("/api/v1/admin/transport", json=_card(from_destination="byblos"))
    assert same.status_code == 422
    half_fare = await admin.post("/api/v1/admin/transport", json=_card(fare_high_minor=None))
    assert half_fare.status_code == 422 and "low and a high" in half_fare.text
    upside_down = await admin.post("/api/v1/admin/transport", json=_card(fare_low_minor=500))
    assert upside_down.status_code == 422
    bad_link = await admin.post(
        "/api/v1/admin/transport", json=_card(evidence=[{"kind": "operator", "note": "Timetable", "url": "http://x"}])
    )
    assert bad_link.status_code == 422
    outside = await admin.post("/api/v1/admin/transport", json=_card(pickup_lat=40.0))
    assert outside.status_code == 422
    walking = await admin.post(
        "/api/v1/admin/transport",
        json=_card(
            scope="around",
            from_destination=None,
            mode="walking",
            fare_basis="free",
            fare_low_minor=None,
            fare_high_minor=None,
            currency=None,
        ),
    )
    assert walking.status_code == 200, walking.text
    assert walking.json()["fare"]["currency"] is None
    airport = await admin.post(
        "/api/v1/admin/transport", json=_card(scope="airport", from_destination=None, mode="taxi", fare_basis="vehicle")
    )
    assert airport.status_code == 200 and airport.json()["from"] is None


@pytest.mark.asyncio
async def test_flags_send_a_wrong_card_back_and_guides_propose_updates(clients: dict[str, AsyncClient]) -> None:
    admin = await _admin(clients)
    anon, traveller = clients["anon"], clients["traveller"]
    card = (await admin.post("/api/v1/admin/transport", json=_card(to_destination="batroun"))).json()
    await admin.post(
        f"/api/v1/admin/transport/{card['id']}/decision",
        json={"decision": "published", "field_check_note": "Checked with the driver at the stop"},
    )
    assert (
        await anon.post(f"/api/v1/transport/routes/{card['id']}/flags", json={"reason": "fare_higher"})
    ).status_code == 401
    flaggers = [traveller, client(), client()]
    try:
        for index, who in enumerate(flaggers):
            await _register(who, f"flagger{index}")
            flagged = await who.post(
                f"/api/v1/transport/routes/{card['id']}/flags", json={"reason": "fare_higher", "details": "Paid 6 USD"}
            )
            assert flagged.status_code == 200, flagged.text
            assert flagged.json()["back_to_review"] is (index == 2)
    finally:
        for extra in flaggers[1:]:
            await extra.aclose()
    queue = (await admin.get("/api/v1/admin/transport?destination=batroun")).json()
    row = next(item for item in queue if item["id"] == card["id"])
    assert row["status"] == "submitted" and len(row["open_flags"]) == 3
    assert (
        await traveller.post(f"/api/v1/transport/routes/{card['id']}/flags", json={"reason": "other"})
    ).status_code == 404

    # Put it back, then a guide proposes an update that retires it once published.
    await admin.post(
        f"/api/v1/admin/transport/{card['id']}/decision",
        json={"decision": "published", "field_check_note": "Fare is now 5 USD, card updated"},
    )
    guide = clients["guide"]
    stranger = client()
    try:
        await _register(stranger, "not-a-guide")
        assert (await stranger.post("/api/v1/transport/guide", json=_card())).status_code == 404
    finally:
        await stranger.aclose()
    await _approved_guide({"guide": guide, "admin": client()})
    no_evidence = await guide.post("/api/v1/transport/guide", json=_card(evidence=[]))
    assert no_evidence.status_code == 422
    update = await guide.post(
        "/api/v1/transport/guide",
        json=_card(to_destination="batroun", fare_low_minor=500, fare_high_minor=600, replaces_route_id=card["id"]),
    )
    assert update.status_code == 200, update.text
    proposal = update.json()
    assert proposal["submitted_role"] == "guide" and proposal["status"] == "submitted"
    assert [item["id"] for item in (await guide.get("/api/v1/transport/guide")).json()] == [proposal["id"]]
    await admin.post(
        f"/api/v1/admin/transport/{proposal['id']}/decision",
        json={"decision": "published", "field_check_note": "Confirmed the new fare in person"},
    )
    old = next(
        item for item in (await admin.get("/api/v1/admin/transport?status=all")).json() if item["id"] == card["id"]
    )
    assert old["status"] == "retired"
    async with TestingSessionLocal() as session:
        told = (
            await session.execute(
                text(
                    "SELECT count(*) FROM app.outbox WHERE event_type = 'transport.card_decided' AND aggregate_id = CAST(:id AS uuid)"
                ),
                {"id": proposal["id"]},
            )
        ).scalar_one()
    assert told >= 1, "the guide hears back"
    rejected = await admin.post(f"/api/v1/admin/transport/{card['id']}/decision", json={"decision": "rejected"})
    assert rejected.status_code == 422, "a rejection needs a reason"
