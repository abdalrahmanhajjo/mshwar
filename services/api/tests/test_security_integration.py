from __future__ import annotations

import asyncio
import base64
import json
from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.core.security_limits import reserve
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.test_booking_payments import _published_listing, _traveller


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


async def register(api: AsyncClient) -> dict:
    response = await api.post(
        "/api/v1/auth/register",
        json={
            "email": f"{uuid4()}@example.com",
            "password": "security-test-passphrase",
            "display_name": "Security review",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def grant_admin(actor: str) -> None:
    async with TestingSessionLocal() as db:
        await db.execute(text("SELECT app.grant_platform_admin(:actor)"), {"actor": actor})
        await db.commit()


@pytest.mark.asyncio
async def test_idor_trip_group_organization_planner_documents_and_share_links(api, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "private_storage_dir", str(tmp_path))
    await register(api)
    trip = (await api.post("/api/v1/trips", json={"name": "Private trip"})).json()["id"]
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Private org"})).json()["id"]
    plan_response = await api.post("/api/v1/planner/sessions", json={"text": "A day in Byblos", "locale": "en"})
    assert plan_response.status_code == 200, plan_response.text
    async with TestingSessionLocal() as db:
        plan = str(await db.scalar(text("SELECT id FROM app.planner_sessions ORDER BY created_at DESC LIMIT 1")))
    await register(api)
    for method, route, target, body in [
        ("post", "/api/v1/trips/{id}/archive", trip, None),
        ("get", "/api/v1/groups/trips/{id}", trip, None),
        ("get", "/api/v1/groups/trips/{id}/share-links", trip, None),
        ("get", "/api/v1/portal/organizations/{id}", org, None),
        ("get", "/api/v1/portal/organizations/{id}/verification/documents", org, None),
        ("get", "/api/v1/portal/organizations/{id}/staff", org, None),
        ("get", "/api/v1/planner/sessions/{id}", plan, None),
    ]:
        foreign = await api.request(method, route.format(id=target), json=body)
        missing = await api.request(method, route.format(id=uuid4()), json=body)
        assert foreign.status_code == missing.status_code == 404, (route, foreign.text, missing.text)
        assert foreign.json() == missing.json() == {"detail": "Resource not found"}
    denied_upload = await api.post(
        f"/api/v1/portal/organizations/{org}/files",
        json={
            "filename": "private.pdf",
            "content_type": "application/pdf",
            "content_base64": base64.b64encode(b"%PDF-1.4\n%%EOF").decode(),
            "purpose": "verification",
        },
    )
    assert denied_upload.status_code == 404
    assert not list(tmp_path.rglob("*"))


@pytest.mark.asyncio
async def test_payment_simulation_and_booking_idor(api) -> None:
    listing = await _published_listing(api)
    await _traveller(api)
    slot = listing["slots"]["slots"][0]
    body = {
        "listing_slug": listing["listing"]["slug"],
        "slot_id": slot["id"],
        "party_size": 1,
        "idempotency_key": uuid4().hex,
    }
    quote = (await api.post("/api/v1/checkout/quote", json={k: body[k] for k in ("listing_slug", "slot_id", "party_size")})).json()
    body.update(price_rule_id=quote["price_rule_id"], policy_id=quote["policy_id"])
    response = await api.post("/api/v1/checkout/draft", json=body)
    assert response.status_code == 200, response.text
    booking = response.json()["id"]
    await _traveller(api)
    for suffix, method, payload in [
        ("", "get", None),
        ("/timeline", "get", None),
        ("/cancel", "post", {"reason": "Private booking"}),
        ("/simulate", "post", {"outcome": "succeeded"}),
    ]:
        foreign = await api.request(method, f"/api/v1/checkout/{booking}{suffix}", json=payload)
        missing = await api.request(method, f"/api/v1/checkout/{uuid4()}{suffix}", json=payload)
        assert foreign.status_code == missing.status_code == 404, foreign.text
        assert foreign.json() == missing.json()


@pytest.mark.asyncio
async def test_consent_revocation_changes_plan_defaults_and_records_both_purposes(api) -> None:
    user = await register(api)
    assert (await api.get("/api/v1/privacy/consents")).json() == {
        "personalisation": False,
        "marketing": False,
        "policy_version": "2026-09-14",
    }
    await api.put(
        "/api/v1/profile", json={"display_name": "Test", "locale": "en", "preferences": {"default_group_size": 4}}
    )
    assert (await api.post("/api/v1/trips", json={"name": "No consent"})).json()["effective_defaults"][
        "default_group_size"
    ] is None
    granted = await api.put("/api/v1/privacy/consents", json={"personalisation": True})
    assert granted.json()["marketing"] is False
    assert (await api.post("/api/v1/trips", json={"name": "Consent"})).json()["effective_defaults"][
        "default_group_size"
    ] == 4
    await api.put("/api/v1/privacy/consents", json={"marketing": True})
    await api.put("/api/v1/privacy/consents", json={"personalisation": False, "marketing": False})
    assert (await api.post("/api/v1/trips", json={"name": "Revoked"})).json()["effective_defaults"][
        "default_group_size"
    ] is None
    async with TestingSessionLocal() as db:
        events = (
            await db.execute(
                text("SELECT purpose,granted FROM app.consent_events WHERE user_id=:id"), {"id": user["id"]}
            )
        ).all()
        assert {tuple(row) for row in events} == {
            ("personalisation", True),
            ("personalisation", False),
            ("marketing", True),
            ("marketing", False),
        }


@pytest.mark.asyncio
async def test_audit_append_only_backend_and_admin_search(api) -> None:
    actor = await register(api)
    org = await api.post("/api/v1/portal/organizations", json={"name": "Audited org"})
    assert org.status_code == 201, org.text
    assert (await api.get("/api/v1/admin/audit")).status_code == 403
    await grant_admin(actor["id"])
    events = await api.get(
        "/api/v1/admin/audit", params={"actor": actor["id"], "target": "organizations", "action": "INSERT"}
    )
    assert events.status_code == 200, events.text
    assert events.json()["total"] == 1
    event = events.json()["items"][0]
    assert event["reason"] == "portal.create_organization"
    assert event["request_id"] == org.headers["X-Request-ID"]
    assert event["target"]["id"] == org.json()["id"]
    for statement in ["UPDATE app.audit_log SET reason=reason", "DELETE FROM app.audit_log", "TRUNCATE app.audit_log"]:
        async with TestingSessionLocal() as db:
            await db.execute(text("SET LOCAL ROLE mshwar_backend"))
            with pytest.raises(DBAPIError):
                await db.execute(text(statement))
            await db.rollback()


@pytest.mark.asyncio
async def test_all_consequential_tables_have_audit_triggers(api) -> None:
    expected = {
        "organizations",
        "organization_members",
        "experiences",
        "slots",
        "bookings",
        "payments",
        "refunds",
        "reviews",
        "users",
        "credentials",
        "sessions",
        "user_private",
        "consent_events",
        "trips",
        "trip_members",
        "trip_share_links",
        "trip_guests",
        "trip_suggestions",
        "votes",
        "staff_invitations",
        "verification_documents",
        "platform_admins",
        "planner_sessions",
        "configuration_versions",
        "verification_events",
    }
    async with TestingSessionLocal() as db:
        rows = await db.execute(
            text("""SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
          JOIN pg_proc p ON p.oid=t.tgfoid WHERE p.proname='audit_change' AND NOT t.tgisinternal""")
        )
        assert expected <= {row[0] for row in rows}
    actor = await register(api)
    await api.put("/api/v1/privacy/consents", json={"marketing": True})
    await api.post("/api/v1/trips", json={"name": "Audit coverage"})
    async with TestingSessionLocal() as db:
        rows = (
            await db.execute(
                text("SELECT table_name,changes FROM app.audit_log WHERE actor_id=:actor"), {"actor": actor["id"]}
            )
        ).all()
        assert {"sessions", "user_private", "consent_events", "trips"} <= {r[0] for r in rows}
        assert "security-test-passphrase" not in json.dumps([r[1] for r in rows])


@pytest.mark.asyncio
async def test_shared_budget_is_atomic_persistent_and_never_overspends() -> None:
    key = "concurrency-" + uuid4().hex
    results = await asyncio.gather(*(reserve(key, 3, 60, durable=True) for _ in range(10)))
    assert results.count(0) == 3
    limiter.reset()
    assert await reserve(key, 3, 60, durable=True) > 0


@pytest.mark.asyncio
async def test_upload_byte_and_count_budget_shared_by_organization(api, monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(settings, "private_storage_dir", str(tmp_path))
    monkeypatch.setattr(settings, "upload_org_hourly_count", 1)
    await register(api)
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Quota org"})).json()["id"]
    body = {
        "filename": "safe.pdf",
        "content_type": "application/pdf",
        "purpose": "verification",
        "content_base64": base64.b64encode(b"%PDF-1.4\n%%EOF").decode(),
    }
    first = await api.post(f"/api/v1/portal/organizations/{org}/files", json=body)
    assert first.status_code == 200, first.text
    file = await api.get(first.json()["signed"]["url"])
    assert file.status_code == 200 and file.headers["cache-control"] == "no-store"
    denied = await api.post(f"/api/v1/portal/organizations/{org}/files", json=body)
    assert denied.status_code == 429 and int(denied.headers["retry-after"]) > 0
    monkeypatch.setattr(settings, "upload_org_hourly_count", 30)
    monkeypatch.setattr(settings, "upload_org_daily_bytes", 1)
    assert (await api.post(f"/api/v1/portal/organizations/{org}/files", json=body)).status_code == 429


@pytest.mark.asyncio
async def test_cross_origin_mutation_rejected(api) -> None:
    await register(api)
    result = await api.put(
        "/api/v1/privacy/consents", headers={"Origin": "https://untrusted.example"}, json={"marketing": True}
    )
    assert result.status_code == 403
    assert (await api.get("/api/v1/privacy/consents")).json()["marketing"] is False
