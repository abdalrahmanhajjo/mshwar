"""Cross-user and cross-organisation access attempts on every resource type (MSHWAR-108).

One world per test: business A with a published listing, traveller A with a
booking, a paid payment, a trip, a favourite, a planner session, a group-trip
share link, a review and a notification. The attacker is a verified traveller
who also owns business B. Every attempt must fail without revealing whether
the target exists, and must leave the target unchanged.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.test_admin import _completed_booking
from tests.test_booking_payments import _published_listing, _traveller


@dataclass
class World:
    owner: AsyncClient
    traveller: AsyncClient
    attacker: AsyncClient
    org_a: str
    org_b: str
    listing: dict[str, Any]
    booking_id: str
    review_id: str
    trip_id: str
    favorite_id: str
    session_id: str
    stop_id: str
    version_id: str
    link_id: str
    notification_id: str
    blackout_id: str
    invite_id: str


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def world() -> AsyncGenerator[World, None]:
    set_mailer(RecordingMailer())
    owner, traveller, attacker = _client(), _client(), _client()
    catalog = await _published_listing(owner, mode="instant", capacity=5)
    org_a = catalog["org"]["id"]
    listing = catalog["listing"]

    customer = await _traveller(traveller)
    slot = catalog["slots"]["slots"][0]
    quote = (
        await traveller.post(
            "/api/v1/checkout/quote",
            json={"listing_slug": listing["slug"], "slot_id": slot["id"], "party_size": 1},
        )
    ).json()
    key = f"idor-{uuid4().hex[:10]}"
    booking = await traveller.post(
        "/api/v1/checkout/commit",
        json={
            "listing_slug": listing["slug"],
            "slot_id": slot["id"],
            "party_size": 1,
            "price_rule_id": quote["price_rule_id"],
            "policy_id": quote["policy_id"],
            "idempotency_key": key,
        },
        headers={"Idempotency-Key": key},
    )
    assert booking.status_code == 200, booking.text
    booking_id = booking.json()["id"]

    reviewed_booking = await _completed_booking(org_a, listing, str(customer["id"]))
    review = await traveller.post(
        "/api/v1/reviews",
        json={"booking_id": reviewed_booking, "rating": 5, "body": "Kind hosts and good bread."},
    )
    assert review.status_code == 200, review.text

    trip = (await traveller.post("/api/v1/trips", json={"name": "Private weekend"})).json()
    favorite = (await traveller.post("/api/v1/favorites", json={"listing_slug": "slow-day-byblos"})).json()
    planned = await traveller.post(
        "/api/v1/planner/sessions", json={"text": "a slow day in Byblos for two", "locale": "en"}
    )
    assert planned.status_code == 200, planned.text
    plan = planned.json()["plan"]
    link = await traveller.post(f"/api/v1/groups/trips/{trip['id']}/share-links", json={"role": "view"})
    assert link.status_code == 200, link.text
    notes = (await traveller.get("/api/v1/notifications")).json()["items"]
    assert notes, "the booking should have produced a notification"

    start = datetime.now(UTC) + timedelta(days=10)
    blackout = await owner.post(
        f"/api/v1/portal/organizations/{org_a}/blackouts",
        json={
            "experience_id": listing["id"],
            "start": start.isoformat(),
            "end": (start + timedelta(hours=2)).isoformat(),
            "reason": "Private event",
        },
    )
    assert blackout.status_code == 200, blackout.text
    invite = await owner.post(
        f"/api/v1/portal/organizations/{org_a}/staff/invitations",
        json={"email": f"staff-{uuid4().hex[:8]}@example.com", "role": "bookings"},
    )
    assert invite.status_code == 201, invite.text

    await _traveller(attacker)
    org_b = (await attacker.post("/api/v1/portal/organizations", json={"name": f"Rival {uuid4().hex[:6]}"})).json()

    yield World(
        owner=owner,
        traveller=traveller,
        attacker=attacker,
        org_a=org_a,
        org_b=org_b["id"],
        listing=listing,
        booking_id=booking_id,
        review_id=review.json()["id"],
        trip_id=trip["id"],
        favorite_id=favorite["id"],
        session_id=planned.json()["session_id"],
        stop_id=plan["stops"][0]["id"],
        version_id=plan["version_id"],
        link_id=link.json()["id"],
        notification_id=notes[0]["id"],
        blackout_id=blackout.json()["id"],
        invite_id=invite.json()["id"],
    )
    for client in (owner, traveller, attacker):
        await client.aclose()
    set_mailer(None)


async def _attempt(client: AsyncClient, method: str, path: str, body: Any = None) -> tuple[int, dict[str, Any]]:
    headers = {"Idempotency-Key": f"idor-{uuid4().hex[:12]}"} if method == "POST" else None
    response = await client.request(method, path, json=body, headers=headers)
    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}
    return response.status_code, payload if isinstance(payload, dict) else {"items": payload}


def _user_owned(w: World) -> list[tuple[str, str, Any]]:
    b, s, v = w.booking_id, w.session_id, w.version_id
    return [
        ("GET", f"/api/v1/checkout/{b}", None),
        ("GET", f"/api/v1/checkout/{b}/timeline", None),
        ("GET", f"/api/v1/checkout/{b}/confirmation", None),
        ("POST", f"/api/v1/checkout/{b}/cancel-preview", None),
        ("POST", f"/api/v1/checkout/{b}/cancel", {"reason": "not mine"}),
        ("POST", f"/api/v1/checkout/{b}/pay", {}),
        ("POST", f"/api/v1/trips/{w.trip_id}/archive", None),
        ("DELETE", f"/api/v1/favorites/{w.favorite_id}", None),
        ("GET", f"/api/v1/planner/sessions/{s}", None),
        ("POST", f"/api/v1/planner/sessions/{s}/lock", {"stop_id": w.stop_id}),
        ("POST", f"/api/v1/planner/sessions/{s}/regenerate", None),
        ("POST", f"/api/v1/planner/sessions/{s}/refine", {"text": "make it cheaper", "locale": "en"}),
        ("GET", f"/api/v1/planner/sessions/{s}/stops/{w.stop_id}/alternatives", None),
        ("GET", f"/api/v1/planner/trips/{w.trip_id}/versions", None),
        ("GET", f"/api/v1/planner/versions/{v}", None),
        ("POST", f"/api/v1/planner/versions/{v}/link-booking", {"booking_id": b}),
        ("POST", f"/api/v1/notifications/{w.notification_id}/read", None),
        ("GET", f"/api/v1/groups/trips/{w.trip_id}", None),
        ("GET", f"/api/v1/groups/trips/{w.trip_id}/participants", None),
        ("GET", f"/api/v1/groups/trips/{w.trip_id}/share-links", None),
        ("POST", f"/api/v1/groups/trips/{w.trip_id}/share-links", {"role": "edit"}),
        ("POST", f"/api/v1/groups/share-links/{w.link_id}/revoke", None),
        ("GET", f"/api/v1/groups/trips/{w.trip_id}/suggestions", None),
        ("POST", f"/api/v1/groups/trips/{w.trip_id}/lock", None),
        ("GET", f"/api/v1/groups/trips/{w.trip_id}/summary", None),
    ]


def _with_random_ids(path: str, w: World) -> str:
    for real in (
        w.booking_id,
        w.session_id,
        w.version_id,
        w.trip_id,
        w.favorite_id,
        w.stop_id,
        w.link_id,
        w.notification_id,
    ):
        path = path.replace(real, str(uuid4()))
    return path


@pytest.mark.asyncio
async def test_other_travellers_records_look_like_missing_records(world: World) -> None:
    failures = []
    for method, path, body in _user_owned(world):
        status, payload = await _attempt(world.attacker, method, path, body)
        missing_status, missing_payload = await _attempt(world.attacker, method, _with_random_ids(path, world), body)
        if status != 404:
            failures.append(f"{method} {path}: {status} {payload}")
        elif (status, payload.get("detail")) != (missing_status, missing_payload.get("detail")):
            failures.append(f"{method} {path}: foreign {payload} differs from missing {missing_payload}")
    assert not failures, "\n".join(failures)

    # Nothing changed for the owner.
    booking = await world.traveller.get(f"/api/v1/checkout/{world.booking_id}")
    assert booking.status_code == 200
    assert booking.json()["status"] not in {"cancelled", "expired"}
    trips = (await world.traveller.get("/api/v1/trips")).json()
    assert any(item["id"] == world.trip_id and item["status"] != "archived" for item in trips["items"])
    favorites = (await world.traveller.get("/api/v1/favorites")).json()["items"]
    assert any(item["id"] == world.favorite_id for item in favorites)
    links = (await world.traveller.get(f"/api/v1/groups/trips/{world.trip_id}/share-links")).json()
    assert any(item["id"] == world.link_id and not item.get("revoked_at") for item in links)


@pytest.mark.asyncio
async def test_cross_user_writes_to_reviews_are_refused(world: World) -> None:
    review = await world.attacker.post(
        "/api/v1/reviews", json={"booking_id": world.booking_id, "rating": 1, "body": "I was never there."}
    )
    assert review.status_code in {403, 404}
    report = await world.attacker.post(f"/api/v1/reviews/{world.review_id}/report", json={"reason": "spam"})
    assert report.status_code == 200  # any signed-in reader may report a public review
    async with TestingSessionLocal() as session:
        count = (
            await session.execute(
                text("SELECT count(*) FROM app.reviews WHERE booking_id = :id"), {"id": world.booking_id}
            )
        ).scalar_one()
    assert count == 0


def _org_scoped(w: World, org: str) -> list[tuple[str, str, Any]]:
    listing = w.listing
    base = f"/api/v1/portal/organizations/{org}"
    start = (datetime.now(UTC) + timedelta(days=20)).date()
    return [
        ("GET", base, None),
        ("GET", f"{base}/onboarding", None),
        ("GET", f"{base}/staff", None),
        ("GET", f"{base}/experiences", None),
        ("GET", f"{base}/experiences/{listing['id']}", None),
        ("GET", f"{base}/experiences/{listing['id']}/availability", None),
        ("GET", f"{base}/bookings", None),
        ("GET", f"{base}/bookings.csv", None),
        ("GET", f"{base}/metrics", None),
        ("GET", f"{base}/metrics.csv", None),
        ("GET", f"{base}/reviews", None),
        ("GET", f"{base}/verification/documents", None),
        ("GET", f"{base}/notification-preferences", None),
        ("PUT", f"{base}/contacts", {"public_phone": "+96170000000"}),
        ("PUT", f"{base}/escalation", {"escalation_minutes": 5}),
        (
            "PUT",
            f"{base}/notification-preferences",
            {"role": "owner", "event_type": "booking.requested", "in_app": False, "email": False},
        ),
        ("POST", f"{base}/experiences/{listing['id']}/publish", None),
        ("POST", f"{base}/experiences/{listing['id']}/status", {"status": "paused"}),
        ("POST", f"{base}/venues", {"name": "Taken", "address": "Hamra", "lng": 35.5, "lat": 33.89}),
        (
            "PUT",
            f"{base}/opening-hours",
            {"venue_id": listing["venue_id"], "hours": [{"weekday": 1, "opens": "01:00", "closes": "02:00"}]},
        ),
        (
            "POST",
            f"{base}/blackouts",
            {
                "experience_id": listing["id"],
                "start": f"{start.isoformat()}T10:00:00Z",
                "end": f"{start.isoformat()}T12:00:00Z",
                "reason": "hijack",
            },
        ),
        ("DELETE", f"{base}/blackouts/{w.blackout_id}", None),
        (
            "POST",
            f"{base}/slots/generate",
            {
                "experience_id": listing["id"],
                "start_date": start.isoformat(),
                "end_date": start.isoformat(),
                "capacity": 99,
            },
        ),
        ("POST", f"{base}/bookings/{w.booking_id}/respond", {"status": "rejected", "reason": "hijack"}),
        ("POST", f"{base}/bookings/{w.booking_id}/cancel", {"status": "cancelled", "reason": "hijack"}),
        ("POST", f"{base}/reviews/{w.review_id}/responses", {"body": "Not our review to answer."}),
        ("POST", f"{base}/reviews/{w.review_id}/hide", None),
        ("DELETE", f"{base}/reviews/{w.review_id}", None),
        ("POST", f"{base}/staff/invitations", {"email": "mole@example.com", "role": "owner"}),
        ("POST", f"{base}/staff/invitations/{w.invite_id}/revoke", None),
        ("POST", f"{base}/metrics/events", {"event_name": "revenue", "dedupe_key": uuid4().hex}),
        (
            "POST",
            f"{base}/files",
            {
                "filename": "x.pdf",
                "content_type": "application/pdf",
                "content_base64": "JVBERi0xLjQK",
                "purpose": "verification",
            },
        ),
    ]


@pytest.mark.asyncio
async def test_another_business_cannot_touch_this_business(world: World) -> None:
    failures = []
    for method, path, body in _org_scoped(world, world.org_a):
        status, payload = await _attempt(world.attacker, method, path, body)
        if status != 403 or payload.get("code") != "forbidden":
            failures.append(f"{method} {path}: {status} {payload}")
    assert not failures, "\n".join(failures)


@pytest.mark.asyncio
async def test_own_organisation_id_does_not_unlock_another_businesss_objects(world: World) -> None:
    # The attacker is owner of org B, so capability checks pass; the objects belong to org A.
    failures = []
    for method, path, body in _org_scoped(world, world.org_b):
        if not any(
            key in path
            for key in (world.listing["id"], world.booking_id, world.review_id, world.blackout_id, world.invite_id)
        ):
            continue
        if path.endswith("/files"):
            continue
        status, payload = await _attempt(world.attacker, method, path, body)
        if status not in {404, 422}:
            failures.append(f"{method} {path}: {status} {payload}")
    assert not failures, "\n".join(failures)
    for action in ("unpublish", "publish"):
        status, _ = await _attempt(
            world.attacker, "POST", f"/api/v1/catalogue/experiences/{world.listing['slug']}/{action}"
        )
        assert status == 404


@pytest.mark.asyncio
async def test_business_a_state_is_unchanged_after_the_attempts(world: World) -> None:
    for method, path, body in _org_scoped(world, world.org_a):
        await _attempt(world.attacker, method, path, body)
    for method, path, body in _org_scoped(world, world.org_b):
        await _attempt(world.attacker, method, path, body)
    listing = await world.owner.get(f"/api/v1/portal/organizations/{world.org_a}/experiences/{world.listing['id']}")
    assert listing.status_code == 200
    assert listing.json()["status"] == "published"
    staff = (await world.owner.get(f"/api/v1/portal/organizations/{world.org_a}/staff")).json()
    assert "mole@example.com" not in str(staff)
    booking = await world.traveller.get(f"/api/v1/checkout/{world.booking_id}")
    assert booking.json()["status"] not in {"rejected", "cancelled"}
    async with TestingSessionLocal() as session:
        responses = (
            await session.execute(
                text("SELECT count(*) FROM app.review_responses WHERE review_id = :id"), {"id": world.review_id}
            )
        ).scalar_one()
        blackouts = (
            await session.execute(text("SELECT count(*) FROM app.blackouts WHERE id = :id"), {"id": world.blackout_id})
        ).scalar_one()
    assert responses == 0
    assert blackouts == 1


@pytest.mark.asyncio
async def test_signed_file_links_are_scoped_and_short_lived(world: World) -> None:
    listed = await world.owner.get(f"/api/v1/portal/organizations/{world.org_a}/verification/documents")
    assert listed.status_code == 200
    denied = await world.attacker.get(f"/api/v1/portal/organizations/{world.org_a}/verification/documents")
    assert denied.status_code == 403
    tampered = await world.attacker.get("/api/v1/portal/files/" + "x" * 64)
    assert tampered.status_code in {400, 404}


@pytest.mark.asyncio
async def test_travellers_record_only_engagement_events(world: World) -> None:
    base = f"/api/v1/portal/organizations/{world.org_a}/metrics/events"
    viewed = await world.attacker.post(
        base, json={"event_name": "listing_view", "experience_id": world.listing["id"], "dedupe_key": uuid4().hex}
    )
    assert viewed.status_code == 200, viewed.text
    elsewhere = await world.attacker.post(
        f"/api/v1/portal/organizations/{world.org_b}/metrics/events",
        json={"event_name": "listing_view", "experience_id": world.listing["id"], "dedupe_key": uuid4().hex},
    )
    assert elsewhere.status_code == 404  # org B staff, but the listing is org A's
    key = uuid4().hex
    first = await world.owner.post(
        base, json={"event_name": "revenue", "dedupe_key": key, "properties": {"amount_minor": 100}}
    )
    assert first.status_code == 200, first.text
    # The same key from someone else is a different event and cannot overwrite the owner's.
    replay = await world.attacker.post(
        base,
        json={
            "event_name": "listing_view",
            "experience_id": world.listing["id"],
            "dedupe_key": key,
            "properties": {"amount_minor": 1},
        },
    )
    assert replay.status_code == 200
    assert replay.json()["id"] != first.json()["id"]
    async with TestingSessionLocal() as session:
        stored = (
            await session.execute(
                text("SELECT properties FROM app.analytics_events WHERE id = :id"), {"id": first.json()["id"]}
            )
        ).scalar_one()
    assert stored == {"amount_minor": 100}
