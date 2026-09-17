from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, get_mailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from app.payments.confirmations import render_confirmation
from app.payments.factory import get_payment_provider
from app.payments.lebanon_stub import LebanonAcquirerStub, adapter_names
from app.payments.policy import refund_bps_from_snapshot, refund_minor
from app.payments.state_machine import ALL_BOOKING_STATUSES, allowed, blocked_pairs
from app.payments.stripe_test import StripeTestAdapter, sign_stripe_payload
from app.payments.types import PaymentIntent
from tests.conftest import TestingSessionLocal
from tests.media_fixtures import b64, tiny_jpeg


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}@example.com"


async def _register(api: AsyncClient, email: str, name: str = "Owner") -> dict[str, Any]:
    response = await api.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": email,
            "password": "long-enough-secret",
            "display_name": name,
            "locale": "en",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _verify(api: AsyncClient, email: str) -> None:
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.verification_tokens_for(email)[0]
    confirmed = await api.post("/api/v1/auth/verify-email", json={"token": token})
    assert confirmed.status_code == 200, confirmed.text


async def _grant_admin(user_id: str) -> None:
    async with TestingSessionLocal() as session:
        await session.execute(text("SELECT app.grant_platform_admin(:user_id)"), {"user_id": user_id})
        await session.commit()


async def _published_listing(api: AsyncClient, *, mode: str = "request", capacity: int = 10) -> dict[str, Any]:
    owner = await _register(api, _email("owner"), "Owner")
    org = (await api.post("/api/v1/portal/organizations", json={"name": f"Kitchen {uuid4().hex[:6]}"})).json()
    from app.core.geo import BEIRUT_LAT, BEIRUT_LNG

    venue = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/venues",
        json={"name": "Hamra", "address": "Hamra", "lng": BEIRUT_LNG, "lat": BEIRUT_LAT},
    )
    experience = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/experiences",
        json={
            "venue_id": venue.json()["id"],
            "title": "Cedar tasting",
            "description": "A guided tasting in Beirut.",
            "booking_mode": mode if mode != "instant" else "request",
            "duration_minutes": 90,
            "min_party": 1,
            "max_party": 8,
            "setting": "indoor",
            "intensity": 2,
            "weather_rules": {"sensitive": False},
            "category": "food",
            "suitability": ["groups"],
            "weather": ["all-weather"],
            "price": {"currency": "USD", "price_type": "fixed", "unit": "person", "amount_minor": 4500},
            "policy": {"cancellation_rules": {"hours": 24}, "terms_text": "Cancel 24h before."},
        },
    )
    assert experience.status_code == 200, experience.text
    listing = experience.json()
    upload = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/files",
        json={
            "filename": "hero.jpg",
            "content_type": "image/jpeg",
            "content_base64": b64(tiny_jpeg()),
            "purpose": "listing",
            "experience_id": listing["id"],
            "alt_text": "Cedar table",
        },
    )
    assert upload.status_code == 200, upload.text
    await _grant_admin(owner["id"])
    await api.post(f"/api/v1/admin/organizations/{org['id']}/verify", json={"reason": "Documents match"})
    hours = await api.put(
        f"/api/v1/portal/organizations/{org['id']}/opening-hours",
        json={
            "venue_id": listing["venue_id"],
            "hours": [{"weekday": d, "opens": "10:00", "closes": "18:00"} for d in range(7)],
            "source": "portal",
        },
    )
    assert hours.status_code == 200
    start = (datetime.now(UTC) + timedelta(days=3)).date()
    generated = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/slots/generate",
        json={
            "experience_id": listing["id"],
            "start_date": start.isoformat(),
            "end_date": (start + timedelta(days=1)).isoformat(),
            "capacity": capacity,
        },
    )
    assert generated.status_code == 200, generated.text
    published = await api.post(f"/api/v1/portal/organizations/{org['id']}/experiences/{listing['id']}/publish")
    assert published.status_code == 200, published.text
    if mode == "instant":
        updated = await api.post(
            f"/api/v1/portal/organizations/{org['id']}/experiences",
            json={
                "id": listing["id"],
                "venue_id": listing["venue_id"],
                "title": listing["title"],
                "description": listing["description"],
                "booking_mode": "instant",
                "duration_minutes": 90,
                "min_party": 1,
                "max_party": 8,
                "setting": "indoor",
                "category": "food",
                "suitability": ["groups"],
                "weather": ["all-weather"],
                "price": {"currency": "USD", "price_type": "fixed", "unit": "person", "amount_minor": 4500},
                "policy": {"cancellation_rules": {"hours": 24}, "terms_text": "Cancel 24h before."},
            },
        )
        assert updated.status_code == 200, updated.text
        listing = updated.json()
    slots = (await api.get(f"/api/v1/checkout/slots/{listing['slug']}")).json()
    return {"owner": owner, "org": org, "listing": listing, "slots": slots}


async def _traveller(api: AsyncClient) -> dict[str, Any]:
    email = _email("guest")
    user = await _register(api, email, "Guest")
    await _verify(api, email)
    return user


def test_state_machine_covers_seven_named_states() -> None:
    required = {"draft", "pending", "confirmed", "rejected", "cancelled", "completed", "refunded"}
    assert required <= ALL_BOOKING_STATUSES
    assert allowed("draft", "pending")
    assert allowed("pending", "confirmed")
    assert not allowed("confirmed", "pending")
    assert not allowed("refunded", "confirmed")
    blocked = blocked_pairs()
    assert ("confirmed", "draft") in blocked
    assert ("expired", "confirmed") in blocked


def test_policy_engine_window_matrix() -> None:
    start = datetime(2030, 6, 1, 12, tzinfo=UTC)
    snapshot = {
        "windows": [
            {"hours_before": 48, "refund_bps": 10000},
            {"hours_before": 24, "refund_bps": 5000},
            {"hours_before": 0, "refund_bps": 0},
        ]
    }
    assert refund_bps_from_snapshot(snapshot, start, now=start - timedelta(hours=60)) == 10000
    assert refund_bps_from_snapshot(snapshot, start, now=start - timedelta(hours=30)) == 5000
    assert refund_bps_from_snapshot(snapshot, start, now=start - timedelta(hours=2)) == 0
    assert refund_minor(9000, 5000) == 4500
    hours_only = {"rules": {"hours": 24}}
    assert refund_bps_from_snapshot(hours_only, start, now=start - timedelta(hours=25)) == 10000
    assert refund_bps_from_snapshot(hours_only, start, now=start - timedelta(hours=2)) == 0


def test_payment_adapters_have_no_stripe_types() -> None:
    stripe = StripeTestAdapter()
    lebanon = LebanonAcquirerStub()
    intent = stripe.create_intent(amount_minor=1000, currency="USD", idempotency_key="idem-key-1", metadata={})
    other = lebanon.create_intent(amount_minor=1000, currency="USD", idempotency_key="idem-key-1", metadata={})
    assert isinstance(intent, PaymentIntent)
    assert intent.provider == "stripe_test"
    assert other.provider == "lebanon_acquirer"
    assert intent.provider_ref != "booking-id"
    assert "stripe" not in type(intent).__module__
    assert adapter_names() == ("stripe_test", "lebanon_acquirer")
    provider = get_payment_provider()
    assert provider.name in adapter_names()


def test_webhook_signature_reject_and_accept() -> None:
    adapter = StripeTestAdapter(webhook_secret="whsec_local_stub")
    payload = json.dumps(
        {
            "id": "evt_1",
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_stub", "status": "succeeded"}},
        }
    ).encode("utf-8")
    with pytest.raises(ValueError):
        adapter.verify_webhook(payload, "")
    with pytest.raises(ValueError):
        adapter.verify_webhook(payload, "t=1,v1=deadbeef")
    header = sign_stripe_payload(payload, "whsec_local_stub")
    event = adapter.verify_webhook(payload, header)
    assert event.outcome == "succeeded"
    assert event.event_id == "evt_1"


def test_confirmation_uses_persisted_fields_only() -> None:
    rendered = render_confirmation(
        {
            "booking": {
                "experience_title": "Cedar tasting",
                "total_minor": 9000,
                "currency": "USD",
                "status": "confirmed",
                "policy_snapshot": {"terms": "Cancel 24h before."},
            }
        },
        "ar",
    )
    assert rendered["dir"] == "rtl"
    assert "Cedar tasting" in rendered["body"]
    assert "9000" in rendered["body"]
    assert rendered["from_persisted"] == "true"


@pytest.mark.asyncio
async def test_modes_quote_and_inquiry(api: AsyncClient) -> None:
    request_listing = await _published_listing(api, mode="request")
    slots = request_listing["slots"]["slots"]
    assert request_listing["slots"]["booking_mode"] == "request"
    quote = await api.post(
        "/api/v1/checkout/quote",
        json={"listing_slug": request_listing["listing"]["slug"], "slot_id": slots[0]["id"], "party_size": 2},
    )
    assert quote.status_code == 200, quote.text
    assert quote.json()["effective_mode"] == "request"
    assert quote.json()["price_snapshot"]["total_minor"] == 9000

    inquiry = await _published_listing(api, mode="inquiry")
    guest = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _traveller(guest)
    created = await guest.post(
        "/api/v1/checkout/inquiry",
        json={"listing_slug": inquiry["listing"]["slug"], "party_size": 2, "message": "Do you have Friday lunch?"},
        headers={"Idempotency-Key": f"inq-{uuid4().hex[:10]}"},
    )
    assert created.status_code == 200, created.text
    assert created.json()["mode"] == "inquiry"
    await guest.aclose()


@pytest.mark.asyncio
async def test_checkout_commit_idempotency_and_snapshots(api: AsyncClient) -> None:
    catalog = await _published_listing(api, mode="instant", capacity=4)
    guest = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _traveller(guest)
    slot = catalog["slots"]["slots"][0]
    quote = (
        await guest.post(
            "/api/v1/checkout/quote",
            json={"listing_slug": catalog["listing"]["slug"], "slot_id": slot["id"], "party_size": 2},
        )
    ).json()
    key = f"book-{uuid4().hex[:12]}"
    body = {
        "listing_slug": catalog["listing"]["slug"],
        "slot_id": slot["id"],
        "party_size": 2,
        "price_rule_id": quote["price_rule_id"],
        "policy_id": quote["policy_id"],
        "idempotency_key": key,
    }
    draft = await guest.post("/api/v1/checkout/draft", json=body, headers={"Idempotency-Key": key})
    assert draft.status_code == 200, draft.text
    assert draft.json()["status"] == "draft"
    first = await guest.post("/api/v1/checkout/commit", json=body, headers={"Idempotency-Key": key})
    assert first.status_code == 200, first.text
    booking_id = first.json()["id"]
    second = await guest.post("/api/v1/checkout/commit", json=body, headers={"Idempotency-Key": key})
    assert second.status_code == 200
    assert second.json()["id"] == booking_id
    async with TestingSessionLocal() as session:
        count = (
            await session.execute(text("SELECT count(*) FROM app.bookings WHERE request_key = :key"), {"key": key})
        ).scalar()
        assert count == 1
        await session.execute(
            text(
                """
                INSERT INTO app.policies (experience_id, version, cancellation_rules, terms_text)
                SELECT experience_id, version + 1, '{"hours": 1}'::jsonb, 'Changed after booking'
                FROM app.policies
                WHERE id = :id
                """
            ),
            {"id": quote["policy_id"]},
        )
        await session.commit()
    conflict = await guest.post(
        "/api/v1/checkout/commit",
        json={**body, "party_size": 1},
        headers={"Idempotency-Key": key},
    )
    assert conflict.status_code == 422
    confirmation = await guest.get(f"/api/v1/checkout/{booking_id}/confirmation")
    assert confirmation.status_code == 200
    assert confirmation.json()["policy_snapshot"]["terms"] == "Cancel 24h before."
    assert confirmation.json()["generated_from"] == "persisted"
    timeline = await guest.get(f"/api/v1/checkout/{booking_id}/timeline")
    assert timeline.status_code == 200
    assert timeline.json()["timeline"]
    await guest.aclose()


@pytest.mark.asyncio
async def test_overbooking_and_hold_expiry(api: AsyncClient) -> None:
    catalog = await _published_listing(api, mode="request", capacity=1)
    slot = catalog["slots"]["slots"][0]
    quote = (
        await api.post(
            "/api/v1/checkout/quote",
            json={"listing_slug": catalog["listing"]["slug"], "slot_id": slot["id"], "party_size": 1},
        )
    ).json()

    async def _client() -> AsyncClient:
        client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        await _traveller(client)
        return client

    first = await _client()
    second = await _client()

    async def _commit(client: AsyncClient, prefix: str):
        body = {
            "listing_slug": catalog["listing"]["slug"],
            "slot_id": slot["id"],
            "party_size": 1,
            "price_rule_id": quote["price_rule_id"],
            "policy_id": quote["policy_id"],
            "idempotency_key": f"{prefix}-{uuid4().hex[:10]}",
        }
        return await client.post(
            "/api/v1/checkout/commit",
            json=body,
            headers={"Idempotency-Key": body["idempotency_key"]},
        )

    first_resp, second_resp = await asyncio.gather(_commit(first, "a"), _commit(second, "b"))
    statuses = {first_resp.status_code, second_resp.status_code}
    assert 200 in statuses
    assert statuses != {200}
    loser = first_resp if first_resp.status_code != 200 else second_resp
    assert "capacity" in loser.text.lower() or loser.status_code in {409, 422}
    winner = first_resp if first_resp.status_code == 200 else second_resp
    booking_id = winner.json()["id"]
    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.bookings SET hold_until = now() - interval '1 minute' WHERE id = :id"),
            {"id": booking_id},
        )
        await session.commit()
    expired = await api.post("/api/v1/checkout/ops/expire-holds")
    assert expired.status_code == 200
    assert expired.json()["expired"] >= 1
    await first.aclose()
    await second.aclose()


@pytest.mark.asyncio
async def test_invalid_transition_changes_nothing(api: AsyncClient) -> None:
    catalog = await _published_listing(api, mode="request", capacity=3)
    guest = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _traveller(guest)
    slot = catalog["slots"]["slots"][0]
    quote = (
        await guest.post(
            "/api/v1/checkout/quote",
            json={"listing_slug": catalog["listing"]["slug"], "slot_id": slot["id"], "party_size": 1},
        )
    ).json()
    key = f"tr-{uuid4().hex[:10]}"
    commit = await guest.post(
        "/api/v1/checkout/commit",
        json={
            "listing_slug": catalog["listing"]["slug"],
            "slot_id": slot["id"],
            "party_size": 1,
            "price_rule_id": quote["price_rule_id"],
            "policy_id": quote["policy_id"],
            "idempotency_key": key,
        },
        headers={"Idempotency-Key": key},
    )
    booking_id = commit.json()["id"]
    async with TestingSessionLocal() as session:
        with pytest.raises(Exception):  # noqa: B017
            await session.execute(
                text("SELECT app.transition_booking(:id, 'completed', 'too soon')"),
                {"id": booking_id},
            )
            await session.commit()
        await session.rollback()
        status = (
            await session.execute(text("SELECT status FROM app.bookings WHERE id = :id"), {"id": booking_id})
        ).scalar()
        assert status == "pending"
    await guest.aclose()


@pytest.mark.asyncio
async def test_payment_failure_timeout_and_late_success(api: AsyncClient) -> None:
    catalog = await _published_listing(api, mode="instant", capacity=2)
    guest = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    await _traveller(guest)
    slot = catalog["slots"]["slots"][0]
    quote = (
        await guest.post(
            "/api/v1/checkout/quote",
            json={"listing_slug": catalog["listing"]["slug"], "slot_id": slot["id"], "party_size": 1},
        )
    ).json()

    async def _commit(client: AsyncClient) -> str:
        key = f"pay-{uuid4().hex[:10]}"
        response = await client.post(
            "/api/v1/checkout/commit",
            json={
                "listing_slug": catalog["listing"]["slug"],
                "slot_id": slot["id"],
                "party_size": 1,
                "price_rule_id": quote["price_rule_id"],
                "policy_id": quote["policy_id"],
                "idempotency_key": key,
            },
            headers={"Idempotency-Key": key},
        )
        assert response.status_code == 200, response.text
        return str(response.json()["id"])

    instant_id = await _commit(guest)
    settled = await guest.post(
        f"/api/v1/checkout/{instant_id}/pay",
        json={"idempotency_key": f"ok-{uuid4().hex[:10]}"},
        headers={"Idempotency-Key": f"ok-{uuid4().hex[:10]}"},
    )
    assert settled.status_code == 200, settled.text
    after_ok = await guest.get(f"/api/v1/checkout/{instant_id}")
    assert after_ok.json()["status"] == "confirmed"
    assert after_ok.json()["inventory_reserved"] is True

    failed_id = await _commit(guest)
    failed = await guest.post(
        f"/api/v1/checkout/{failed_id}/pay",
        json={"idempotency_key": f"fail-{uuid4().hex[:10]}", "fault": "fail"},
        headers={"Idempotency-Key": f"fail-{uuid4().hex[:10]}"},
    )
    assert failed.status_code == 402
    after_fail = await guest.get(f"/api/v1/checkout/{failed_id}")
    assert after_fail.json()["status"] in {"cancelled", "expired"}
    assert after_fail.json()["inventory_reserved"] is False

    timeout_id = await _commit(guest)
    timed = await guest.post(
        f"/api/v1/checkout/{timeout_id}/pay",
        json={"idempotency_key": f"to-{uuid4().hex[:10]}", "fault": "timeout"},
        headers={"Idempotency-Key": f"to-{uuid4().hex[:10]}"},
    )
    assert timed.status_code == 504
    late = await guest.post(f"/api/v1/checkout/{timeout_id}/simulate", json={"outcome": "succeeded"})
    assert late.status_code == 200, late.text
    after_late = await guest.get(f"/api/v1/checkout/{timeout_id}")
    assert after_late.json()["status"] != "confirmed"
    assert after_late.json()["inventory_reserved"] is False

    payload = json.dumps(
        {
            "id": f"evt_{uuid4().hex[:8]}",
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_unused", "status": "succeeded", "payment_id": None}},
        }
    ).encode("utf-8")
    unconfigured = await api.post(
        "/api/v1/webhooks/payments", content=payload, headers={"stripe-signature": "t=1,v1=nope"}
    )
    assert unconfigured.status_code == 503
    await guest.aclose()


@pytest.mark.asyncio
async def test_cancel_preview_outbox_and_reconciliation(api: AsyncClient) -> None:
    catalog = await _published_listing(api, mode="request", capacity=3)
    guest = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    user = await _traveller(guest)
    slot = catalog["slots"]["slots"][0]
    quote = (
        await guest.post(
            "/api/v1/checkout/quote",
            json={"listing_slug": catalog["listing"]["slug"], "slot_id": slot["id"], "party_size": 1},
        )
    ).json()
    key = f"cx-{uuid4().hex[:10]}"
    booking = (
        await guest.post(
            "/api/v1/checkout/commit",
            json={
                "listing_slug": catalog["listing"]["slug"],
                "slot_id": slot["id"],
                "party_size": 1,
                "price_rule_id": quote["price_rule_id"],
                "policy_id": quote["policy_id"],
                "idempotency_key": key,
            },
            headers={"Idempotency-Key": key},
        )
    ).json()
    preview = await guest.post(f"/api/v1/checkout/{booking['id']}/cancel-preview")
    assert preview.status_code == 200
    assert "refund_minor" in preview.json()
    cancelled = await guest.post(
        f"/api/v1/checkout/{booking['id']}/cancel",
        json={"reason": "Plans changed"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    published = await guest.post("/api/v1/checkout/ops/publish-outbox")
    assert published.status_code == 200
    metrics = await guest.get("/api/v1/checkout/ops/metrics")
    assert metrics.status_code == 200
    assert "depth" in metrics.json()
    await _grant_admin(user["id"])
    queue = await guest.get("/api/v1/admin/payments/reconciliation")
    assert queue.status_code == 200
    reconcile = await guest.post("/api/v1/admin/payments/reconcile")
    assert reconcile.status_code == 200
    business_cancel = await api.post(
        f"/api/v1/portal/organizations/{catalog['org']['id']}/bookings/{booking['id']}/cancel",
        json={"status": "cancelled", "reason": "Kitchen closed"},
    )
    assert business_cancel.status_code in {200, 422}
    mine = await guest.get("/api/v1/checkout/mine")
    assert mine.status_code == 200
    await guest.aclose()
