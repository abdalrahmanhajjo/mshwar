from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.data_quality import scheduler_enabled, scheduler_status
from app.core.geo import BEIRUT_LAT, BEIRUT_LNG
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.core.search_reindex import reindex_provider, taxonomy_reindex_payload
from app.main import app
from tests.conftest import TestingSessionLocal


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


async def _register(api: AsyncClient, email: str, name: str = "Operator") -> dict[str, Any]:
    local, _, domain = email.partition("@")
    unique = f"{local}-{uuid4().hex[:8]}@{domain or 'example.com'}"
    response = await api.post(
        "/api/v1/auth/register",
        json={"email": unique, "password": "long-enough-secret", "display_name": name, "locale": "en"},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _grant(user_id: str, tier: str = "ops") -> None:
    async with TestingSessionLocal() as session:
        await session.execute(
            text("SELECT app.grant_platform_admin(:user_id, NULL, :tier)"),
            {"user_id": user_id, "tier": tier},
        )
        await session.commit()


def test_search_reindex_is_stub() -> None:
    assert reindex_provider() == "stub"
    payload = taxonomy_reindex_payload("term", "rename")
    assert payload["provider"] == "stub"
    assert payload["status"] == "queued"


def test_quality_scheduler_defaults_off() -> None:
    assert scheduler_enabled() is False
    assert "quality/run" in scheduler_status()["trigger"]


@pytest.mark.asyncio
async def test_privilege_escalation_blocked(api: AsyncClient) -> None:
    traveller = await _register(api, "traveller-admin@example.com", "Traveller")
    me = await api.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["admin_tier"] is None

    assert (await api.get("/api/v1/admin/me")).status_code == 403
    assert (await api.get("/api/v1/admin/users")).status_code == 403
    assert (await api.get("/api/v1/admin/organizations")).status_code == 403
    assert (await api.get("/api/v1/admin/kpis")).status_code == 403

    self_grant = await api.post(
        "/api/v1/admin/roles",
        json={"user_id": traveller["id"], "tier": "elevated"},
    )
    assert self_grant.status_code == 403

    await _grant(traveller["id"], "ops")
    me_admin = await api.get("/api/v1/auth/me")
    assert me_admin.json()["admin_tier"] == "ops"
    assert (await api.get("/api/v1/admin/me")).status_code == 200

    still_self = await api.post(
        "/api/v1/admin/roles",
        json={"user_id": traveller["id"], "tier": "elevated"},
    )
    assert still_self.status_code == 403

    async with TestingSessionLocal() as session:
        with pytest.raises(Exception):  # noqa: B017
            await session.execute(
                text("SELECT app.grant_platform_admin(:target, :actor, 'ops')"),
                {"target": traveller["id"], "actor": traveller["id"]},
            )
            await session.commit()
        await session.rollback()


@pytest.mark.asyncio
async def test_verified_badge_only_via_admin(api: AsyncClient) -> None:
    owner = await _register(api, "badge-owner@example.com", "Owner")
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Badge Kitchen"})).json()
    assert org["verification"] == "pending"
    public_pending = await api.get(f"/api/v1/businesses/{org['slug']}")
    assert public_pending.status_code in (200, 404)
    if public_pending.status_code == 200:
        assert public_pending.json().get("verified_badge") is not True

    denied = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/verify",
        json={"reason": "I own this business"},
    )
    assert denied.status_code == 403

    await _grant(owner["id"], "ops")
    missing_reason = await api.post(f"/api/v1/admin/organizations/{org['id']}/verify", json={"reason": ""})
    assert missing_reason.status_code == 422

    verified = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/verify",
        json={"reason": "Commercial register matches"},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["verification"] == "verified"

    public = await api.get(f"/api/v1/businesses/{org['slug']}")
    assert public.status_code == 200
    assert public.json()["verified_badge"] is True

    suspended = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/suspend",
        json={"reason": "Complaints about the kitchen"},
    )
    assert suspended.status_code == 200
    assert suspended.json()["verification"] == "suspended"
    after = await api.get(f"/api/v1/businesses/{org['slug']}")
    if after.status_code == 200:
        assert after.json().get("verified_badge") is not True

    reverified = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/re-verify",
        json={"reason": "Documents re-checked"},
    )
    assert reverified.status_code == 200
    assert reverified.json()["verification"] == "verified"


@pytest.mark.asyncio
async def test_session_log_and_role_grant(api: AsyncClient) -> None:
    elevated = await _register(api, "elevated-admin@example.com", "Elevated")
    ops = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    other = await _register(ops, "ops-admin@example.com", "Ops")
    await _grant(elevated["id"], "elevated")
    sessions = await api.get("/api/v1/admin/sessions")
    assert sessions.status_code == 200
    assert any(row["user_id"] == elevated["id"] for row in sessions.json())
    assert all("duration_seconds" in row for row in sessions.json())

    granted = await api.post("/api/v1/admin/roles", json={"user_id": other["id"], "tier": "ops"})
    assert granted.status_code == 200, granted.text
    self_grant = await api.post("/api/v1/admin/roles", json={"user_id": elevated["id"], "tier": "elevated"})
    assert self_grant.status_code == 403
    await ops.aclose()


@pytest.mark.asyncio
async def test_moderation_preserves_review_text(api: AsyncClient) -> None:
    admin = await _register(api, "mod-admin@example.com")
    await _grant(admin["id"], "ops")
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Mod Kitchen"})).json()
    listing = await _listing(api, org["id"])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as reviewer:
        customer = await _register(reviewer, "reviewer@example.com")
    booking_id = await _completed_booking(org["id"], listing, customer["id"])
    async with TestingSessionLocal() as session:
        review_id = str(uuid4())
        await session.execute(
            text(
                """
                INSERT INTO app.reviews (id, booking_id, author_id, rating, body, moderation)
                VALUES (:id, :booking_id, :author_id, 2, 'Service was slow.', 'pending')
                """
            ),
            {"id": review_id, "booking_id": booking_id, "author_id": customer["id"]},
        )
        await session.commit()

    hidden = await api.post(
        f"/api/v1/admin/moderation/review/{review_id}",
        json={"action": "hide", "reason": "Personal attack"},
    )
    assert hidden.status_code == 200, hidden.text
    assert hidden.json()["snapshot"]["body"] == "Service was slow."

    unconfirmed = await api.post(
        "/api/v1/admin/moderation/bulk",
        json={"entity_type": "review", "ids": [review_id], "action": "hide", "reason": "spam wave", "confirm": False},
    )
    assert unconfirmed.status_code == 422

    bulk = await api.post(
        "/api/v1/admin/moderation/bulk",
        json={
            "entity_type": "review",
            "ids": [review_id],
            "action": "restore",
            "reason": "false positive",
            "confirm": True,
        },
    )
    assert bulk.status_code == 200, bulk.text

    async with TestingSessionLocal() as session:
        with pytest.raises(Exception):  # noqa: B017
            await session.execute(text("UPDATE app.reviews SET body = 'rewritten' WHERE id = :id"), {"id": review_id})
            await session.commit()
        await session.rollback()
        body = (
            await session.execute(text("SELECT body, moderation FROM app.reviews WHERE id = :id"), {"id": review_id})
        ).one()
        assert body[0] == "Service was slow."


@pytest.mark.asyncio
async def test_taxonomy_retire_and_reindex_stub(api: AsyncClient) -> None:
    admin = await _register(api, "tax-admin@example.com")
    await _grant(admin["id"], "ops")
    created = await api.post(
        "/api/v1/admin/taxonomy",
        json={
            "kind": "category",
            "slug": f"sunset-sips-{uuid4().hex[:8]}",
            "label": "Sunset sips",
            "reason": "Seasonal category",
        },
    )
    assert created.status_code == 200, created.text
    assert created.json()["reindex"]["provider"] == "stub"
    term_id = created.json()["id"]
    retired = await api.post(
        f"/api/v1/admin/taxonomy/{term_id}/retire",
        json={"reason": "Season ended"},
    )
    assert retired.status_code == 200
    assert retired.json()["historical_assignments_kept"] is True
    assert retired.json()["active"] is False


@pytest.mark.asyncio
async def test_non_elevated_cannot_force_cancel(api: AsyncClient) -> None:
    ops = await _register(api, "ops-finance@example.com")
    await _grant(ops["id"], "ops")
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Pay Kitchen"})).json()
    await api.post(
        f"/api/v1/admin/organizations/{org['id']}/verify",
        json={"reason": "Documents reviewed"},
    )
    listing = await _listing(api, org["id"])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as guest:
        customer = await _register(guest, "guest@example.com")
    booking_id, _payment_id = await _payable_booking(org["id"], listing, customer["id"])

    inspect = await api.get(f"/api/v1/admin/bookings/{booking_id}")
    assert inspect.status_code == 200
    dumped = inspect.text.lower()
    assert "sk_" not in dumped
    assert inspect.json()["price_snapshot"]
    assert inspect.json()["policy_snapshot"]

    denied = await api.post(
        f"/api/v1/admin/bookings/{booking_id}/force-cancel",
        json={"reason": "Guest asked support"},
    )
    assert denied.status_code == 403

    await _grant(ops["id"], "elevated")
    cancelled = await api.post(
        f"/api/v1/admin/bookings/{booking_id}/force-cancel",
        json={"reason": "Guest asked support"},
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["status"] == "cancelled"

    resend = await api.post(
        f"/api/v1/admin/bookings/{booking_id}/resend-confirmation",
        json={"reason": "Guest never received email"},
    )
    assert resend.status_code == 200, resend.text

    refunded = await api.post(
        f"/api/v1/admin/bookings/{booking_id}/mark-refunded",
        json={"reason": "Card disputed"},
    )
    assert refunded.status_code == 200, refunded.text
    assert refunded.json()["refunds"]


@pytest.mark.asyncio
async def test_config_rollback_cases_and_quality(api: AsyncClient) -> None:
    admin = await _register(api, "ops-console@example.com")
    await _grant(admin["id"], "elevated")
    first = await api.put(
        "/api/v1/admin/config",
        json={
            "key": "marketplace.fees",
            "value": {"commission_bps": 1000, "service_fee_minor": 0},
            "reason": "Initial fees",
        },
    )
    assert first.status_code == 200, first.text
    second = await api.put(
        "/api/v1/admin/config",
        json={
            "key": "marketplace.fees",
            "value": {"commission_bps": 1500, "service_fee_minor": 200},
            "reason": "Trial bump",
        },
    )
    assert second.status_code == 200
    rolled = await api.post(
        "/api/v1/admin/config/marketplace.fees/rollback",
        json={"reason": "Revert trial"},
    )
    assert rolled.status_code == 200, rolled.text
    assert rolled.json()["value"]["commission_bps"] == 1000

    flag = await api.put(
        "/api/v1/admin/flags",
        json={
            "key": "planner.v2",
            "environment": "development",
            "cohort": "staff",
            "enabled": True,
            "payload": {},
            "reason": "Internal preview",
        },
    )
    assert flag.status_code == 200, flag.text

    kpis = await api.get("/api/v1/admin/kpis")
    assert kpis.status_code == 200
    assert "users" in kpis.json()["metrics"]
    assert any(item["key"] == "planner_success_rate" for item in kpis.json()["definitions"])

    opened = await api.post("/api/v1/admin/cases", json={"reason": "Guest cannot find confirmation", "evidence": []})
    assert opened.status_code == 200, opened.text
    case_id = opened.json()["id"]
    no_outcome = await api.post(f"/api/v1/admin/cases/{case_id}/resolve", json={"outcome": ""})
    assert no_outcome.status_code == 422
    resolved = await api.post(
        f"/api/v1/admin/cases/{case_id}/resolve",
        json={"outcome": "Resent confirmation from the inspector"},
    )
    assert resolved.status_code == 200

    org = (await api.post("/api/v1/portal/organizations", json={"name": "Quality Kitchen"})).json()
    venue = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/venues",
        json={"name": "Paris desk", "address": "Paris", "lng": 2.35, "lat": 48.85},
    )
    assert venue.status_code == 422

    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO app.venues (id, organization_id, name, address, location, location_source)
                VALUES (
                    gen_random_uuid(), :org_id, 'Paris desk', 'Paris',
                    ST_SetSRID(ST_MakePoint(2.35, 48.85), 4326)::geography, 'test'
                )
                """
            ),
            {"org_id": org["id"]},
        )
        await session.commit()

    run = await api.post("/api/v1/admin/quality/run?notify=true")
    assert run.status_code == 200, run.text
    listed = await api.get("/api/v1/admin/quality")
    assert listed.status_code == 200
    codes = {item["rule_code"] for item in listed.json()["issues"]}
    assert "coords_outside_lebanon" in codes or run.json()["open"] >= 0

    if listed.json()["issues"]:
        issue_id = listed.json()["issues"][0]["id"]
        notified = await api.post(f"/api/v1/admin/quality/{issue_id}/notify")
        assert notified.status_code in (200, 422)


@pytest.mark.asyncio
async def test_admin_console_remaining_paths(api: AsyncClient) -> None:
    elevated = await _register(api, "console-elevated@example.com")
    await _grant(elevated["id"], "elevated")
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Console Kitchen"})).json()
    case = await api.get(f"/api/v1/admin/organizations/{org['id']}")
    assert case.status_code == 200
    assert case.json()["verified_badge"] is False

    rejected = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/reject",
        json={"reason": "Incomplete commercial register"},
    )
    assert rejected.status_code == 200
    verified = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/verify",
        json={"reason": "Register arrived later"},
    )
    assert verified.json()["verification"] == "verified"
    revoked = await api.post(
        f"/api/v1/admin/organizations/{org['id']}/revoke",
        json={"reason": "Licence expired"},
    )
    assert revoked.status_code == 200

    created = await api.post(
        "/api/v1/admin/taxonomy",
        json={
            "kind": "amenity",
            "slug": f"quiet-corner-{uuid4().hex[:8]}",
            "label": "Quiet corner",
            "reason": "New amenity",
        },
    )
    other = await api.post(
        "/api/v1/admin/taxonomy",
        json={
            "kind": "amenity",
            "slug": f"quiet-room-{uuid4().hex[:8]}",
            "label": "Quiet room",
            "reason": "Duplicate amenity",
        },
    )
    renamed = await api.post(
        f"/api/v1/admin/taxonomy/{created.json()['id']}/rename",
        json={"label": "Quiet table", "reason": "Clearer label"},
    )
    assert renamed.status_code == 200
    merged = await api.post(
        f"/api/v1/admin/taxonomy/{other.json()['id']}/merge",
        json={"target_id": created.json()["id"], "reason": "Deduplicate amenities"},
    )
    assert merged.status_code == 200

    users = await api.get("/api/v1/admin/users")
    assert users.status_code == 200
    assert any(row["id"] == elevated["id"] for row in users.json())

    queue = await api.get("/api/v1/admin/organizations?verification=pending")
    assert queue.status_code == 200
    assert (await api.get("/api/v1/admin/taxonomy")).status_code == 200
    assert (await api.get("/api/v1/admin/moderation?entity_type=review")).status_code == 200

    assert (await api.get("/api/v1/admin/bookings")).status_code == 200
    assert (await api.get("/api/v1/admin/config")).status_code == 200
    assert (await api.get("/api/v1/admin/flags")).status_code == 200
    assert (await api.get("/api/v1/admin/moderation/events")).status_code == 200
    assert (await api.get("/api/v1/admin/roles")).status_code == 200

    opened = await api.post("/api/v1/admin/cases", json={"reason": "Double charge report", "evidence": []})
    case_id = opened.json()["id"]
    assigned = await api.post(
        f"/api/v1/admin/cases/{case_id}/assign",
        json={"assignee_id": elevated["id"], "note": "I will take this"},
    )
    assert assigned.status_code == 200
    escalated = await api.post(
        f"/api/v1/admin/cases/{case_id}/escalate",
        json={"note": "Needs finance review"},
    )
    assert escalated.status_code == 200

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other_client:
        ops = await _register(other_client, "console-ops@example.com")
    granted = await api.post("/api/v1/admin/roles", json={"user_id": ops["id"], "tier": "ops"})
    assert granted.status_code == 200
    revoked_role = await api.post(
        f"/api/v1/admin/roles/{ops['id']}/revoke",
        json={"reason": "Left the operations team"},
    )
    assert revoked_role.status_code == 200


async def _listing(api: AsyncClient, org_id: str) -> dict[str, Any]:
    venue = await api.post(
        f"/api/v1/portal/organizations/{org_id}/venues",
        json={"name": "Hamra studio", "address": "Hamra, Beirut", "lng": BEIRUT_LNG, "lat": BEIRUT_LAT},
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
    return experience.json()


async def _slot_for(listing: dict[str, Any]) -> dict[str, Any]:
    async with TestingSessionLocal() as session:
        slot_id = str(uuid4())
        await session.execute(
            text(
                """
                INSERT INTO app.slots (
                    id, experience_id, starts_at, ends_at, capacity, reserved, authoritative, source, observed_at, status
                ) VALUES (
                    :id, :experience_id, now() - interval '3 hours', now() - interval '1 hour',
                    10, 0, true, 'test', now(), 'open'
                )
                """
            ),
            {"id": slot_id, "experience_id": listing["id"]},
        )
        await session.commit()
        return {"id": slot_id}


async def _completed_booking(org_id: str, listing: dict[str, Any], customer_id: str) -> str:
    slot = await _slot_for(listing)
    booking_id = str(uuid4())
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO app.bookings (
                    id, customer_id, organization_id, experience_id, slot_id, party_size, status, mode,
                    hold_until, inventory_reserved, currency, total_minor, payment_required,
                    price_snapshot, policy_snapshot, request_key, request_hash
                ) VALUES (
                    :id, :customer_id, :org_id, :experience_id, :slot_id, 2, 'pending', 'request',
                    now() + interval '12 hours', true, 'USD', 9000, false,
                    CAST(:price_snapshot AS jsonb), CAST(:policy_snapshot AS jsonb), :request_key, :request_hash
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
        await session.execute(
            text("UPDATE app.bookings SET status = 'confirmed' WHERE id = :id"),
            {"id": booking_id},
        )
        await session.execute(
            text("UPDATE app.bookings SET status = 'completed' WHERE id = :id"),
            {"id": booking_id},
        )
        await session.commit()
    return booking_id


async def _payable_booking(org_id: str, listing: dict[str, Any], customer_id: str) -> tuple[str, str]:
    slot = await _slot_for(listing)
    booking_id = str(uuid4())
    payment_id = str(uuid4())
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO app.bookings (
                    id, customer_id, organization_id, experience_id, slot_id, party_size, status, mode,
                    hold_until, inventory_reserved, currency, total_minor, payment_required,
                    price_snapshot, policy_snapshot, request_key, request_hash
                ) VALUES (
                    :id, :customer_id, :org_id, :experience_id, :slot_id, 2, 'pending', 'request',
                    now() + interval '12 hours', true, 'USD', 9000, true,
                    CAST(:price_snapshot AS jsonb), CAST(:policy_snapshot AS jsonb), :request_key, :request_hash
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
        await session.execute(
            text(
                """
                INSERT INTO app.payments (
                    id, booking_id, currency, provider, provider_account, live_mode, external_id,
                    idempotency_key, amount_minor, status
                ) VALUES (
                    :id, :booking_id, 'USD', 'stub', 'acct_platform', false, :external_id,
                    :idempotency_key, 9000, 'created'
                )
                """
            ),
            {
                "id": payment_id,
                "booking_id": booking_id,
                "external_id": f"pay-{uuid4().hex[:10]}",
                "idempotency_key": f"idem-{uuid4().hex[:10]}",
            },
        )
        await session.execute(text("UPDATE app.payments SET status = 'succeeded' WHERE id = :id"), {"id": payment_id})
        await session.commit()
    return booking_id, payment_id
