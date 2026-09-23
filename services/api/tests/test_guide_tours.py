"""G2: an approved guide publishes a tour, opens dates, and answers requests.

The rules worth protecting are the ones a screen cannot hold: a local host cannot
charge (the database refuses the write, not only the form), a tour's route is made
of real published places, the weekly rhythm never produces more tours in a day than
the guide said they can run, and a request never asks the traveller for money.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.geo import BEIRUT_LAT, BEIRUT_LNG
from app.core.mailer import RecordingMailer, get_mailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.media_fixtures import b64, tiny_jpeg


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "traveller": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _register(client: AsyncClient, prefix: str, *, verify: bool = False) -> dict[str, Any]:
    email = f"{prefix}-{uuid4().hex[:12]}@example.com"
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": email,
            "password": "long-enough-secret",
            "display_name": prefix.title(),
            "locale": "en",
        },
    )
    assert response.status_code == 201, response.text
    if verify:
        mailer = get_mailer()
        assert isinstance(mailer, RecordingMailer)
        token = mailer.verification_tokens_for(email)[0]
        confirmed = await client.post("/api/v1/auth/verify-email", json={"token": token})
        assert confirmed.status_code == 200, confirmed.text
    return dict(response.json())


async def _approved_guide(clients: dict[str, AsyncClient], tier: str = "licensed") -> dict[str, Any]:
    guide, admin = clients["guide"], clients["admin"]
    await _register(guide, f"{tier}-guide")
    applied = await guide.put(
        "/api/v1/guides/me",
        json={"tier": tier, "display_name": "Rami Haddad", "languages": ["ar", "en"], "regions": ["beirut"]},
    )
    assert applied.status_code == 200, applied.text
    profile = applied.json()
    for kind in profile["required_documents"]:
        body: dict[str, Any] = {"kind": kind, "document_key": f"private/{kind}-{uuid4().hex[:8]}.pdf"}
        if kind == "licence":
            body["expires_on"] = (date.today() + timedelta(days=365)).isoformat()
        assert (await guide.put("/api/v1/guides/me/documents", json=body)).status_code == 200
    assert (await guide.post("/api/v1/guides/me/submit")).status_code == 200

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


async def _published_place() -> str:
    async with TestingSessionLocal() as session:
        slug = (
            await session.execute(
                text("SELECT slug FROM app.experiences WHERE status = 'published' ORDER BY slug LIMIT 1")
            )
        ).scalar_one()
    return str(slug)


def _tour(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "title": "Hamra on foot",
        "description": "Two hours through Hamra's bookshops, cafés and old cinemas.",
        "duration_minutes": 120,
        "max_party": 8,
        "price_minor": 2500,
        "languages": ["en", "ar"],
        "included": "Coffee at the halfway stop",
        "bring": "Comfortable shoes",
        "meeting": {"name": "Hamra Street, by the Costa", "lat": BEIRUT_LAT, "lng": BEIRUT_LNG},
    }
    body.update(overrides)
    return body


async def _photo(guide: AsyncClient, organization_id: str, tour_id: str) -> None:
    upload = await guide.post(
        f"/api/v1/portal/organizations/{organization_id}/files",
        json={
            "filename": "hero.jpg",
            "content_type": "image/jpeg",
            "content_base64": b64(tiny_jpeg()),
            "purpose": "listing",
            "experience_id": tour_id,
            "alt_text": "The street at the start of the walk",
        },
    )
    assert upload.status_code == 200, upload.text


@pytest.mark.asyncio
async def test_a_guide_publishes_a_tour_and_a_traveller_requests_it(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    profile = await _approved_guide(clients)
    stop = await _published_place()

    created = await guide.put("/api/v1/guides/me/tours", json=_tour(route=[stop]))
    assert created.status_code == 200, created.text
    tour = created.json()
    assert tour["status"] == "draft"
    assert tour["booking_mode"] == "request", "a guide always confirms the request"
    assert [row["slug"] for row in tour["route"]] == [stop]
    assert tour["meeting_point"] == "Hamra Street, by the Costa"

    await _photo(guide, profile["organization_id"], tour["id"])
    published = await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/publish")
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"

    # Every day at 10:00, and an hour of notice so today's start may still count.
    availability = await guide.put(
        "/api/v1/guides/me/availability",
        json={"pattern": [{"weekday": d, "start": "10:00"} for d in range(7)], "min_notice_hours": 1},
    )
    assert availability.status_code == 200, availability.text
    slots = await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/slots", params={"days": 7})
    assert slots.status_code == 200, slots.text
    assert slots.json()["created"] >= 6

    public = await traveller.get(f"/api/v1/guides/{profile['slug']}/tours")
    assert public.status_code == 200
    [listed] = public.json()
    assert listed["price_minor"] == 2500
    assert listed["next_slots"], "open starts are on the public page"
    slot_id = listed["next_slots"][0]["id"]

    anonymous = await traveller.post(
        f"/api/v1/guides/tours/{listed['slug']}/request", json={"slot_id": slot_id, "party_size": 2}
    )
    assert anonymous.status_code == 401

    await _register(traveller, "traveller", verify=True)
    asked = await traveller.post(
        f"/api/v1/guides/tours/{listed['slug']}/request",
        json={"slot_id": slot_id, "party_size": 2},
        headers={"Idempotency-Key": "tour-request-0001"},
    )
    assert asked.status_code == 200, asked.text
    booking = asked.json()
    assert booking["status"] == "pending"
    assert booking["payment_required"] is False, "paid on the day, to the guide"

    again = await traveller.post(
        f"/api/v1/guides/tours/{listed['slug']}/request",
        json={"slot_id": slot_id, "party_size": 2},
        headers={"Idempotency-Key": "tour-request-0001"},
    )
    assert again.json()["id"] == booking["id"], "a retried request is the same request"

    inbox = await guide.get("/api/v1/guides/me/requests", params={"status": "pending"})
    assert inbox.status_code == 200, inbox.text
    assert any(row["id"] == booking["id"] for row in inbox.json())

    answered = await guide.post(
        f"/api/v1/guides/me/requests/{booking['id']}/respond",
        json={"status": "confirmed", "reason": "See you at ten", "message": "Meet by the Costa."},
    )
    assert answered.status_code == 200, answered.text
    assert answered.json()["status"] == "confirmed"


@pytest.mark.asyncio
async def test_a_local_host_cannot_charge(clients: dict[str, AsyncClient]) -> None:
    guide = clients["guide"]
    profile = await _approved_guide(clients, tier="host")

    priced = await guide.put("/api/v1/guides/me/tours", json=_tour(price_minor=1500))
    assert priced.status_code == 422, "the form says no in words"
    assert "cannot charge" in priced.text

    free = await guide.put("/api/v1/guides/me/tours", json=_tour(price_minor=0))
    assert free.status_code == 200, free.text
    tour = free.json()
    tour_id = tour["id"]

    # The business portal is still reachable by the guide's organisation. It must
    # not be a way around the rule: the database refuses the priced write.
    around = await guide.post(
        f"/api/v1/portal/organizations/{profile['organization_id']}/experiences",
        json={
            "id": tour_id,
            "venue_id": tour["venue_id"],
            "title": tour["title"],
            "description": tour["description"],
            "booking_mode": "request",
            "duration_minutes": 120,
            "min_party": 1,
            "max_party": 8,
            "setting": "outdoor",
            "category": "culture",
            "price": {"currency": "USD", "price_type": "fixed", "unit": "person", "amount_minor": 1500},
            "policy": {"cancellation_rules": {}, "terms_text": "Tell me early."},
        },
    )
    assert around.status_code == 403, around.text

    async with TestingSessionLocal() as session:
        with pytest.raises(Exception, match="cannot charge"):
            await session.execute(
                text("UPDATE app.price_rules SET amount_minor = 1500 WHERE experience_id = :e"), {"e": tour_id}
            )
        await session.rollback()


@pytest.mark.asyncio
async def test_a_route_is_made_of_real_places(clients: dict[str, AsyncClient]) -> None:
    guide = clients["guide"]
    await _approved_guide(clients)
    invented = await guide.put("/api/v1/guides/me/tours", json=_tour(route=["a-place-that-does-not-exist"]))
    assert invented.status_code == 422
    assert "not a published place" in invented.text


@pytest.mark.asyncio
async def test_the_daily_cap_counts_every_tour(clients: dict[str, AsyncClient]) -> None:
    guide = clients["guide"]
    await _approved_guide(clients)
    first = (await guide.put("/api/v1/guides/me/tours", json=_tour(title="Morning walk"))).json()
    second = (await guide.put("/api/v1/guides/me/tours", json=_tour(title="Evening walk"))).json()

    await guide.put(
        "/api/v1/guides/me/availability",
        json={
            "pattern": [{"weekday": d, "start": t} for d in range(7) for t in ("09:00", "17:00")],
            "min_notice_hours": 48,
            "max_tours_per_day": 1,
            "exceptions": [{"local_date": (date.today() + timedelta(days=4)).isoformat(), "reason": "Wedding"}],
        },
    )
    one = await guide.post(f"/api/v1/guides/me/tours/{first['id']}/slots", params={"days": 10})
    two = await guide.post(f"/api/v1/guides/me/tours/{second['id']}/slots", params={"days": 10})
    assert one.status_code == 200 and two.status_code == 200
    assert two.json()["created"] == 0, "one tour a day, across both tours"
    assert two.json()["skipped_for_daily_cap"] > 0

    async with TestingSessionLocal() as session:
        rows = (
            await session.execute(
                text(
                    "SELECT (starts_at AT TIME ZONE 'Asia/Beirut')::date AS day, count(*) FROM app.slots "
                    "WHERE experience_id IN (:a, :b) GROUP BY 1"
                ),
                {"a": first["id"], "b": second["id"]},
            )
        ).all()
    assert rows and all(count == 1 for _, count in rows)
    days = {day for day, _ in rows}
    assert date.today() + timedelta(days=4) not in days, "a day off stays off"
    assert date.today() not in days, "the notice period is honoured"

    availability = (await guide.get("/api/v1/guides/me/availability")).json()
    assert availability["max_tours_per_day"] == 1
    assert availability["exceptions"][0]["reason"] == "Wedding"


@pytest.mark.asyncio
async def test_tours_are_for_approved_guides_only(clients: dict[str, AsyncClient]) -> None:
    guide = clients["guide"]
    await _register(guide, "applicant")
    await guide.put("/api/v1/guides/me", json={"tier": "licensed", "display_name": "Not Yet"})
    assert (await guide.get("/api/v1/guides/me/tours")).status_code == 404
    assert (await guide.put("/api/v1/guides/me/tours", json=_tour())).status_code == 404
    assert (await guide.get("/api/v1/guides/me/requests")).status_code == 404
    bad = await guide.put("/api/v1/guides/me/availability", json={"pattern": [{"weekday": 9, "start": "10:00"}]})
    assert bad.status_code == 422
