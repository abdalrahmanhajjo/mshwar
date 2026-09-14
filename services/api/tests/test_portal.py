from __future__ import annotations

import base64
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
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


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    mailer = RecordingMailer()
    set_mailer(mailer)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


async def _register(api: AsyncClient, email: str, name: str = "Owner") -> dict[str, Any]:
    response = await api.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "long-enough-secret", "display_name": name, "locale": "en"},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _create_org(api: AsyncClient, name: str = "Cedar Kitchen") -> dict[str, Any]:
    response = await api.post("/api/v1/portal/organizations", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


async def _grant_admin(user_id: str) -> None:
    async with TestingSessionLocal() as session:
        await session.execute(text("SELECT app.grant_platform_admin(:user_id)"), {"user_id": user_id})
        await session.commit()


async def _complete_listing(api: AsyncClient, org_id: str) -> dict[str, Any]:
    venue = await api.post(
        f"/api/v1/portal/organizations/{org_id}/venues",
        json={
            "name": "Hamra studio",
            "address": "Hamra, Beirut",
            "lng": BEIRUT_LNG,
            "lat": BEIRUT_LAT,
        },
    )
    assert venue.status_code == 200, venue.text
    experience = await api.post(
        f"/api/v1/portal/organizations/{org_id}/experiences",
        json={
            "venue_id": venue.json()["id"],
            "title": "Cedar tasting",
            "description": "A guided tasting in Beirut.",
            "booking_mode": "request",
            "duration_minutes": 90,
            "min_party": 2,
            "max_party": 8,
            "setting": "indoor",
            "intensity": 2,
            "weather_rules": {"sensitive": False},
            "category": "food",
            "suitability": ["couples", "groups"],
            "weather": ["all-weather"],
            "price": {"currency": "USD", "price_type": "fixed", "unit": "person", "amount_minor": 4500},
            "policy": {"cancellation_rules": {"hours": 24}, "terms_text": "Cancel 24h before."},
        },
    )
    assert experience.status_code == 200, experience.text
    body = experience.json()
    upload = await api.post(
        f"/api/v1/portal/organizations/{org_id}/files",
        json={
            "filename": "hero.jpg",
            "content_type": "image/jpeg",
            "content_base64": base64.b64encode(b"fake-image").decode("ascii"),
            "purpose": "listing",
            "experience_id": body["id"],
            "alt_text": "Cedar table",
        },
    )
    assert upload.status_code == 200, upload.text
    fetched = await api.get(f"/api/v1/portal/organizations/{org_id}/experiences/{body['id']}")
    assert fetched.status_code == 200
    return fetched.json()


@pytest.mark.asyncio
async def test_portal_requires_auth(api: AsyncClient) -> None:
    assert (await api.get("/api/v1/portal/organizations")).status_code == 401


@pytest.mark.asyncio
async def test_onboarding_publish_block_and_admin_verify(api: AsyncClient) -> None:
    owner = await _register(api, "owner-portal@example.com")
    org = await _create_org(api)
    assert org["verification"] == "pending"
    assert org["onboarding"]["can_publish"] is False
    listing = await _complete_listing(api, org["id"])
    assert listing["status"] == "draft"
    blocked = await api.post(f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/publish")
    assert blocked.status_code == 422
    assert "org_unverified" in blocked.text

    upload = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/files",
        json={
            "filename": "cr.pdf",
            "content_type": "application/pdf",
            "content_base64": base64.b64encode(b"%PDF-1.4 stub").decode("ascii"),
            "purpose": "verification",
        },
    )
    assert upload.status_code == 200
    assert upload.json()["public"] is False
    submitted = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/verification",
        json={"legal_name": "Cedar Kitchen SARL", "registration_number": "BE-1001"},
    )
    assert submitted.status_code == 200

    outsider = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _register(outsider, "not-admin@example.com")
    denied = await outsider.post(
        f"/api/v1/admin/organizations/{org['id']}/verify",
        json={"reason": "Looks legitimate"},
    )
    assert denied.status_code == 403
    await outsider.aclose()

    await _grant_admin(owner["id"])
    verified = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/verify",
        json={"reason": "Documents match the commercial register"},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["verification"] == "verified"

    published = await api.post(f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/publish")
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "published"

    public = await api.get(f"/api/v1/businesses/{org['slug']}")
    assert public.status_code == 200
    assert "internal_contact" not in public.json()
    assert "fulfilment_instructions" not in public.json()
    assert public.json()["verified_badge"] is True


@pytest.mark.asyncio
async def test_staff_rbac_invite_expire_and_cross_org(api: AsyncClient) -> None:
    await _register(api, "owner-a@example.com", "Owner A")
    org_a = await _create_org(api, "Org A")
    invited = await api.post(
        f"/api/v1/portal/organizations/{org_a['id']}/staff/invitations",
        json={"email": "booker@example.com", "role": "bookings"},
    )
    assert invited.status_code == 201, invited.text
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = next(msg.token for msg in mailer.messages if msg.purpose == "staff_invite")

    staff = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _register(staff, "booker@example.com", "Booker")
    accepted = await staff.post("/api/v1/portal/invitations/accept", json={"token": token})
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["role"] == "bookings"

    listings = await staff.get(f"/api/v1/portal/organizations/{org_a['id']}/experiences")
    assert listings.status_code == 403

    bookings = await staff.get(f"/api/v1/portal/organizations/{org_a['id']}/bookings")
    assert bookings.status_code == 200

    owner_b = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _register(owner_b, "owner-b@example.com", "Owner B")
    org_b = (await owner_b.post("/api/v1/portal/organizations", json={"name": "Org B"})).json()
    leaked = await staff.get(f"/api/v1/portal/organizations/{org_b['id']}")
    assert leaked.status_code == 403
    leaked_list = await staff.get(f"/api/v1/portal/organizations/{org_b['id']}/bookings")
    assert leaked_list.status_code == 403

    finance_invite = await api.post(
        f"/api/v1/portal/organizations/{org_a['id']}/staff/invitations",
        json={"email": "finance@example.com", "role": "finance"},
    )
    revoked = await api.post(
        f"/api/v1/portal/organizations/{org_a['id']}/staff/invitations/{finance_invite.json()['id']}/revoke"
    )
    assert revoked.json()["ok"] is True

    await staff.aclose()
    await owner_b.aclose()


@pytest.mark.asyncio
async def test_expired_staff_invite_cannot_be_accepted(api: AsyncClient) -> None:
    await _register(api, "owner-expire@example.com")
    org = await _create_org(api, "Expire Lab")
    invited = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/staff/invitations",
        json={"email": "late-staff@example.com", "role": "inventory"},
    )
    assert invited.status_code == 201, invited.text
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = next(msg.token for msg in mailer.messages if msg.purpose == "staff_invite")
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE app.staff_invitations SET expires_at = now() - interval '1 hour' WHERE email = 'late-staff@example.com'"
            )
        )
        await session.commit()
    late = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _register(late, "late-staff@example.com", "Late")
    expired = await late.post("/api/v1/portal/invitations/accept", json={"token": token})
    assert expired.status_code == 422
    await late.aclose()


@pytest.mark.asyncio
async def test_pause_preserves_history_and_hides_from_public(api: AsyncClient) -> None:
    owner = await _register(api, "pause@example.com")
    org = await _create_org(api, "Pause Lab")
    listing = await _complete_listing(api, org["id"])
    await _grant_admin(owner["id"])
    await api.post(f"/api/v1/admin/organizations/{org['id']}/verify", json={"reason": "Approved for pause test"})
    published = await api.post(f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/publish")
    assert published.json()["status"] == "published"

    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO app.analytics_events (event_name, organization_id, experience_id, properties, dedupe_key)
                VALUES ('listing_view', :org, :exp, '{}'::jsonb, :dedupe)
                """
            ),
            {"org": org["id"], "exp": listing["id"], "dedupe": f"view-{uuid4()}"},
        )
        await session.execute(
            text(
                """
                INSERT INTO app.reviews (booking_id, author_id, rating, body)
                SELECT NULL, :user_id, 5, 'kept'
                WHERE false
                """
            ),
            {"user_id": owner["id"]},
        )
        await session.commit()

    paused = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/status",
        json={"status": "paused"},
    )
    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"
    assert paused.json()["title"] == "Cedar tasting"

    public = await api.get(f"/api/v1/businesses/experiences/{listing['slug']}")
    assert public.status_code == 404
    org_public = await api.get(f"/api/v1/businesses/{org['slug']}")
    assert org_public.json()["experiences"] == []

    restored = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/status",
        json={"status": "published"},
    )
    assert restored.json()["status"] == "published"
    assert restored.json()["description"] == listing["description"]


@pytest.mark.asyncio
async def test_availability_blackout_and_booking_inbox(api: AsyncClient) -> None:
    owner = await _register(api, "inbox@example.com")
    org = await _create_org(api, "Inbox Lab")
    listing = await _complete_listing(api, org["id"])
    await _grant_admin(owner["id"])
    await api.post(f"/api/v1/admin/organizations/{org['id']}/verify", json={"reason": "Approved for inbox"})
    await api.post(f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/publish")

    hours = await api.put(
        f"/api/v1/portal/organizations/{org['id']}/opening-hours",
        json={
            "venue_id": listing["venue_id"],
            "hours": [{"weekday": d, "opens": "10:00", "closes": "18:00"} for d in range(7)],
            "source": "portal",
        },
    )
    assert hours.status_code == 200
    assert hours.json()[0]["source"] == "portal"
    assert hours.json()[0]["updated_at"]

    start = (datetime.now(timezone.utc) + timedelta(days=2)).date()
    generated = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/slots/generate",
        json={
            "experience_id": listing["id"],
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=2)).isoformat(),
            "capacity": 10,
        },
    )
    assert generated.status_code == 200, generated.text
    availability = await api.get(f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/availability")
    assert availability.status_code == 200
    slots = availability.json()["slots"]
    assert slots
    assert slots[0]["remaining"] == slots[0]["capacity"]
    blackout = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/blackouts",
        json={
            "experience_id": listing["id"],
            "start": slots[0]["starts_at"],
            "end": slots[0]["ends_at"],
            "reason": "Private event",
        },
    )
    assert blackout.status_code == 200
    after = await api.get(f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/availability")
    flagged = next(item for item in after.json()["slots"] if item["id"] == slots[0]["id"])
    assert flagged["blacked_out"] is True
    assert len(after.json()["slots"]) == len(slots)

    traveller = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    customer = await _register(traveller, "traveller-inbox@example.com", "Traveller")
    booking_id = await _insert_booking(org["id"], listing, customer["id"], slots[1] if len(slots) > 1 else slots[0])
    await traveller.aclose()

    inbox = await api.get(f"/api/v1/portal/organizations/{org['id']}/bookings")
    assert inbox.status_code == 200
    assert any(row["id"] == booking_id for row in inbox.json())
    assert all(row["experience_title"] for row in inbox.json())

    responded = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/bookings/{booking_id}/respond",
        json={"status": "confirmed", "reason": "Table reserved", "message": "See you at 10."},
    )
    assert responded.status_code == 200, responded.text
    assert responded.json()["status"] == "confirmed"

    csv_resp = await api.get(f"/api/v1/portal/organizations/{org['id']}/bookings.csv")
    assert csv_resp.status_code == 200
    assert "experience_title" in csv_resp.text

    capture = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/metrics/events",
        json={"event_name": "listing_view", "experience_id": listing["id"], "dedupe_key": f"view-{uuid4()}"},
    )
    assert capture.status_code == 200
    metrics = await api.get(f"/api/v1/portal/organizations/{org['id']}/metrics")
    assert metrics.status_code == 200
    assert "comparison_from" in metrics.json()
    assert metrics.json()["current"]["confirmations"] >= 1


@pytest.mark.asyncio
async def test_internal_contacts_never_leak_on_public_endpoints(api: AsyncClient) -> None:
    await _register(api, "contacts@example.com")
    org = await _create_org(api, "Private Contacts")
    updated = await api.put(
        f"/api/v1/portal/organizations/{org['id']}/contacts",
        json={
            "public_contact": {"name": "Front desk", "email": "hello@example.com"},
            "internal_contact": {"name": "Ops", "email": "ops-internal@example.com", "phone": "01-000000"},
            "fulfilment_instructions": "Call the kitchen extension, never publish this.",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["internal_contact"]["email"] == "ops-internal@example.com"
    public = await api.get(f"/api/v1/businesses/{org['slug']}")
    assert public.status_code == 200
    dumped = public.text
    assert "ops-internal@example.com" not in dumped
    assert "kitchen extension" not in dumped
    assert "internal_contact" not in public.json()
    assert "fulfilment_instructions" not in public.json()
    assert public.json()["public_contact"]["email"] == "hello@example.com"


async def _insert_booking(org_id: str, listing: dict[str, Any], customer_id: str, slot: dict[str, Any]) -> str:
    booking_id = str(uuid4())
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO app.bookings (
                    id, customer_id, organization_id, experience_id, slot_id, party_size, status, mode,
                    hold_until, inventory_reserved, currency, total_minor, payment_required,
                    price_snapshot, policy_snapshot, request_key, request_hash, traveller_note
                ) VALUES (
                    :id, :customer_id, :org_id, :experience_id, :slot_id, 2, 'pending', 'request',
                    now() + interval '12 hours', true, 'USD', 9000, false,
                    CAST(:price_snapshot AS jsonb), CAST(:policy_snapshot AS jsonb),
                    :request_key, :request_hash, 'Window seat if possible'
                )
                """
            ),
            {
                "id": booking_id,
                "customer_id": customer_id,
                "org_id": org_id,
                "experience_id": listing["id"],
                "slot_id": slot["id"],
                "price_snapshot": '{"schema_version":1}',
                "policy_snapshot": '{"schema_version":1}',
                "request_key": f"req-{uuid4().hex[:12]}",
                "request_hash": uuid4().hex,
            },
        )
        await session.execute(
            text("UPDATE app.slots SET reserved = reserved + 2 WHERE id = :slot_id"),
            {"slot_id": slot["id"]},
        )
        await session.commit()
    return booking_id
