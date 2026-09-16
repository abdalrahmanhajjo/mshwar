from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.job_auth import job_token_valid
from app.core.mailer import RecordingMailer, set_mailer
from app.core.notifications.channels import NotificationMessage, StubEmailChannel, email_channel
from app.core.notifications.service import email_is_stub
from app.core.notifications.taxonomy import ALL_EVENTS, category_for
from app.core.rate_limit import limiter
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


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}@example.com"


async def _register(client: AsyncClient, email: str, locale: str = "en", name: str = "Lina") -> dict[str, Any]:
    created = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "long-enough-secret", "display_name": name, "locale": locale},
    )
    assert created.status_code == 201, created.text
    return created.json()


async def _register_verified(client: AsyncClient, email: str, locale: str = "en") -> dict[str, Any]:
    from app.core.mailer import RecordingMailer, get_mailer

    user = await _register(client, email, locale)
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.verification_tokens_for(email)[0]
    confirmed = await client.post("/api/v1/auth/verify-email", json={"token": token})
    assert confirmed.status_code == 200, confirmed.text
    return user


async def _grant(user_id: str, tier: str = "ops") -> None:
    async with TestingSessionLocal() as session:
        await session.execute(
            text("SELECT app.grant_platform_admin(:user_id, NULL, :tier)"),
            {"user_id": user_id, "tier": tier},
        )
        await session.commit()


def test_taxonomy_keeps_marketing_separate() -> None:
    assert category_for("booking.rejected") == "transactional"
    assert category_for("marketing.campaign") == "marketing"
    assert "booking.requested" in ALL_EVENTS


def test_email_channel_is_stub_without_keys() -> None:
    assert email_is_stub() is True
    assert isinstance(email_channel(), StubEmailChannel)


def test_job_token_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "internal_job_token", "")
    monkeypatch.setattr(settings, "notification_dispatch_token", "")
    monkeypatch.setattr(settings, "enable_dev_endpoints", True)
    assert job_token_valid(None) is True
    monkeypatch.setattr(settings, "enable_dev_endpoints", False)
    assert job_token_valid(None) is False
    monkeypatch.setattr(settings, "internal_job_token", "a" * 40)
    assert job_token_valid(None) is False
    assert job_token_valid("wrong") is False
    assert job_token_valid("a" * 40) is True


@pytest.mark.asyncio
async def test_stub_email_hides_unsubscribe_token() -> None:
    channel = StubEmailChannel()
    result = await channel.deliver(
        NotificationMessage(
            notification_id=str(uuid4()),
            user_id=str(uuid4()),
            channel="email",
            category="marketing",
            event_type="marketing.campaign",
            title="Hi",
            body="Offer",
            to_email="ada@example.com",
            unsubscribe_token="secret-unsub-token",
        )
    )
    assert result.outcome == "stubbed"
    assert "secret-unsub-token" not in repr(channel.sent[0])


@pytest.mark.asyncio
async def test_hub_booking_lifecycle_notifies_in_user_language(api: AsyncClient) -> None:
    await _register_verified(api, _email("booker"), "ar")
    created = await api.post("/api/v1/bookings", json={"business_id": 3})
    assert created.status_code == 200, created.text
    notes = await api.get("/api/v1/notifications")
    assert notes.status_code == 200
    items = notes.json()["items"]
    assert items
    confirmed = next(item for item in items if item["event_type"] == "booking.confirmed")
    assert confirmed["locale"] == "ar"
    assert confirmed["deep_link"]
    assert "/bookings" in confirmed["deep_link"]
    assert "تأكيد" in confirmed["title"] or "حجز" in confirmed["title"]

    cancelled = await api.post(
        f"/api/v1/bookings/{created.json()['id']}/cancel",
        json={"reason": "Dates no longer work"},
    )
    assert cancelled.status_code == 200
    after = await api.get("/api/v1/notifications")
    titles = [item["title"] for item in after.json()["items"]]
    assert any("إلغاء" in title or "cancelled" in title.lower() for title in titles)
    cancel_note = next(item for item in after.json()["items"] if item["event_type"] == "booking.cancelled")
    assert cancel_note["deep_link"].endswith(created.json()["id"]) or created.json()["id"] in cancel_note["deep_link"]


@pytest.mark.asyncio
async def test_emit_covers_remaining_traveller_events_and_history(api: AsyncClient) -> None:
    await _register(api, _email("events"), "fr")
    booking_id = str(uuid4())
    for event in ("booking.requested", "booking.rejected", "payment.status_changed"):
        emitted = await api.post(
            "/api/v1/notifications/events",
            json={"event_type": event, "aggregate_id": booking_id, "payload": {"status": "failed"}},
        )
        assert emitted.status_code == 200, emitted.text
    feed = await api.get("/api/v1/notifications")
    types = {item["event_type"] for item in feed.json()["items"]}
    assert {"booking.requested", "booking.rejected", "payment.status_changed"} <= types
    assert all(item["locale"] == "fr" for item in feed.json()["items"])
    assert all(item["deep_link"] for item in feed.json()["items"])


@pytest.mark.asyncio
async def test_material_itinerary_change_notifies_only_when_material(api: AsyncClient) -> None:
    await _register(api, _email("tripper"))
    trip_id = str(uuid4())
    same = await api.post(
        "/api/v1/notifications/itinerary-change",
        json={"trip_id": trip_id, "before": {"stops": ["a"]}, "after": {"stops": ["a"]}},
    )
    assert same.status_code == 200
    assert same.json()["notified"] is False
    changed = await api.post(
        "/api/v1/notifications/itinerary-change",
        json={"trip_id": trip_id, "before": {"stops": ["a"]}, "after": {"stops": ["b"]}},
    )
    assert changed.status_code == 200
    assert changed.json()["notified"] is True
    notes = await api.get("/api/v1/notifications")
    material = [item for item in notes.json()["items"] if item["event_type"] == "itinerary.material_change"]
    assert material
    assert "/trips" in material[0]["deep_link"]


@pytest.mark.asyncio
async def test_marketing_opt_out_never_blocks_transactional(api: AsyncClient) -> None:
    await _register(api, _email("consent"))
    prefs = await api.get("/api/v1/notifications/preferences")
    assert prefs.status_code == 200
    assert prefs.json()["transactional_email"] is True
    updated = await api.put(
        "/api/v1/notifications/preferences",
        json={"marketing_email": False, "marketing_in_app": False},
    )
    assert updated.status_code == 200
    assert updated.json()["marketing_email"] is False
    assert updated.json()["transactional_email"] is True

    rejected = await api.post(
        "/api/v1/notifications/events",
        json={"event_type": "booking.rejected", "aggregate_id": str(uuid4())},
    )
    assert rejected.status_code == 200
    marketing = await api.post(
        "/api/v1/notifications/events",
        json={
            "event_type": "marketing.campaign",
            "aggregate_id": str(uuid4()),
            "payload": {"body": "Spring weekend ideas"},
        },
    )
    assert marketing.status_code == 200

    history = await api.get("/api/v1/notifications/consent")
    assert history.status_code == 200
    purposes = {row["purpose"] for row in history.json()}
    assert "marketing_email" in purposes

    feed = await api.get("/api/v1/notifications")
    types = {item["event_type"] for item in feed.json()["items"]}
    assert "booking.rejected" in types
    assert "marketing.campaign" not in types

    async with TestingSessionLocal() as session:
        statuses = (
            await session.execute(
                text(
                    "SELECT category, status FROM app.notifications "
                    "WHERE user_id = :uid AND event_type = 'marketing.campaign'"
                ),
                {"uid": (await api.get("/api/v1/auth/me")).json()["id"]},
            )
        ).all()
    assert statuses
    assert all(row[0] == "marketing" and row[1] == "suppressed" for row in statuses)


@pytest.mark.asyncio
async def test_unsubscribe_link_opts_out_marketing_only(api: AsyncClient) -> None:
    await _register(api, _email("unsub"))
    await api.put(
        "/api/v1/notifications/preferences",
        json={"marketing_email": True, "marketing_in_app": True},
    )
    token = (await api.get("/api/v1/notifications/preferences")).json()["unsubscribe_token"]
    lookup = await api.get(f"/api/v1/notifications/unsubscribe/{token}")
    assert lookup.status_code == 200
    applied = await api.post(f"/api/v1/notifications/unsubscribe/{token}")
    assert applied.status_code == 200
    assert applied.json()["marketing_email"] is False
    assert applied.json()["transactional_email"] is True
    missing = await api.post("/api/v1/notifications/unsubscribe/not-a-real-token")
    assert missing.status_code in {404, 422}


@pytest.mark.asyncio
async def test_business_role_prefs_and_escalation_schedule(api: AsyncClient) -> None:
    owner = await _register(api, _email("owner"))
    org = await api.post("/api/v1/portal/organizations", json={"name": "Cedar Notices"})
    assert org.status_code == 201, org.text
    org_id = org.json()["id"]
    listed = await api.get(f"/api/v1/portal/organizations/{org_id}/notification-preferences")
    assert listed.status_code == 200
    schedule = await api.put(
        f"/api/v1/portal/organizations/{org_id}/escalation",
        json={"first_minutes": 15, "repeat_minutes": 45, "max": 4},
    )
    assert schedule.status_code == 200, schedule.text
    assert schedule.json()["escalation"]["first_minutes"] == 15
    pref = await api.put(
        f"/api/v1/portal/organizations/{org_id}/notification-preferences",
        json={
            "role": "finance",
            "event_type": "business.booking.requested",
            "email_enabled": False,
            "in_app_enabled": True,
        },
    )
    assert pref.status_code == 200
    roles = pref.json()["roles"]
    assert any(row["role"] == "finance" and row["email_enabled"] is False for row in roles)

    booking_id = str(uuid4())
    emitted = await api.post(
        "/api/v1/notifications/events",
        json={
            "event_type": "business.booking.requested",
            "aggregate_id": booking_id,
            "organization_id": org_id,
            "user_id": owner["id"],
        },
    )
    assert emitted.status_code == 200, emitted.text
    notes = await api.get("/api/v1/notifications")
    business = [item for item in notes.json()["items"] if item["event_type"] == "business.booking.requested"]
    assert business
    assert "/business/bookings" in business[0]["deep_link"]

    tick = await api.post("/api/v1/notifications/escalate")
    assert tick.status_code == 200
    assert "escalated" in tick.json()


@pytest.mark.asyncio
async def test_dispatch_records_stub_email_and_admin_can_resend(api: AsyncClient) -> None:
    user = await _register(api, _email("ops"))
    await _grant(user["id"], "ops")
    booking_id = str(uuid4())
    emitted = await api.post(
        "/api/v1/notifications/events",
        json={"event_type": "booking.rejected", "aggregate_id": booking_id},
    )
    assert emitted.status_code == 200
    dispatched = await api.post("/api/v1/notifications/dispatch")
    assert dispatched.status_code == 200
    assert dispatched.json()["stub"] is True
    assert dispatched.json()["processed"] >= 1

    health = await api.get("/api/v1/admin/notifications/health")
    assert health.status_code == 200
    assert "channels" in health.json()
    assert health.json()["max_attempts"] == 8

    async with TestingSessionLocal() as session:
        email_id = (
            await session.execute(
                text(
                    "SELECT id FROM app.notifications "
                    "WHERE user_id = :uid AND channel = 'email' "
                    "ORDER BY created_at DESC LIMIT 1"
                ),
                {"uid": user["id"]},
            )
        ).scalar_one()
        for _ in range(8):
            await session.execute(
                text("SELECT app.record_notification_delivery(:id, 'failed', 'smtp_error', 'provider down', 8)"),
                {"id": str(email_id)},
            )
        await session.commit()

    health_after = await api.get("/api/v1/admin/notifications/health")
    assert health_after.json()["dead_letters"] >= 1
    listed = await api.get("/api/v1/admin/notifications", params={"status": "failed"})
    assert listed.status_code == 200
    assert any(row["id"] == str(email_id) for row in listed.json())

    resend = await api.post(
        f"/api/v1/admin/notifications/{email_id}/resend",
        json={"reason": "Customer asked for the confirmation email"},
    )
    assert resend.status_code == 200, resend.text
    assert resend.json()["status"] == "pending"

    kpis = await api.get("/api/v1/admin/kpis")
    assert kpis.status_code == 200
    keys = {item["key"] for item in kpis.json()["definitions"]}
    assert "notification_email_delivery_rate" in keys

    stranger = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    async with stranger:
        await _register(stranger, _email("nope"))
        assert (await stranger.get("/api/v1/admin/notifications/health")).status_code == 403
