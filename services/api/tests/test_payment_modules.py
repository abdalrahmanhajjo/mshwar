from __future__ import annotations

import json

import pytest

from app.payments import metrics
from app.payments.confirmations import confirmation_email, render_confirmation
from app.payments.factory import FaultInjectingProvider, PaymentTimeout, get_payment_provider, payment_fault
from app.payments.lebanon_stub import LebanonAcquirerStub
from app.payments.stripe_test import StripeTestAdapter, sign_stripe_payload
from app.payments.webhook import payload_hash, sanitize_event, verify_or_reject


def test_metrics_counters_reset() -> None:
    metrics.reset()
    metrics.increment("outbox_published", 2)
    assert metrics.snapshot()["outbox_published"] == 2
    metrics.reset()
    assert metrics.snapshot() == {}


def test_factory_faults_and_lebanon_adapter() -> None:
    provider = get_payment_provider("fail")
    assert isinstance(provider, FaultInjectingProvider)
    failed = provider.create_intent(amount_minor=1000, currency="USD", idempotency_key="fault-fail-1", metadata={})
    assert failed.status == "failed"
    timed = get_payment_provider("timeout")
    with pytest.raises(PaymentTimeout) as exc:
        timed.create_intent(amount_minor=1000, currency="USD", idempotency_key="fault-to-1", metadata={})
    assert exc.value.intent.provider_ref.startswith("pi_stub_")
    stub = LebanonAcquirerStub()
    intent = stub.create_intent(amount_minor=500, currency="USD", idempotency_key="lb-key-01", metadata={})
    assert intent.provider == "lebanon_acquirer"
    assert intent.status == "succeeded"
    assert intent.provider_ref != "booking-id"
    refund = stub.refund(provider_ref=intent.provider_ref, amount_minor=500, idempotency_key="lb-re-01", reason="test")
    assert refund.provider_ref.startswith("lb_re_")
    with pytest.raises(ValueError):
        stub.verify_webhook(b"{}", "")
    accepted = stub.verify_webhook(b"{}", "lebanon-stub")
    assert accepted.outcome == "succeeded"
    assert payment_fault("late_success").mode == "late_success"


def test_webhook_helpers_and_stripe_refund() -> None:
    adapter = StripeTestAdapter(webhook_secret="whsec_local_stub")
    payload = json.dumps({"id": "evt_2", "type": "payment_intent.failed", "data": {"object": {"id": "pi_x"}}}).encode()
    event = verify_or_reject(adapter, payload, sign_stripe_payload(payload, "whsec_local_stub"))
    sanitized = sanitize_event(event)
    assert sanitized["outcome"] == "failed"
    assert payload_hash(payload)
    refund = adapter.refund(provider_ref="pi_x", amount_minor=100, idempotency_key="re-key-01", reason="demo")
    assert refund.status == "requested"
    with pytest.raises(ValueError):
        verify_or_reject(adapter, payload, "")


def test_confirmation_email_from_persisted_payload() -> None:
    message = confirmation_email(
        "guest@example.com",
        "booking.confirmed",
        {"experience_title": "Cedar tasting", "total_minor": 4500, "currency": "USD", "status": "confirmed"},
        "fr",
    )
    assert message.purpose == "booking_confirmation"
    assert "Cedar tasting" in (message.text_body or "")
    rendered = render_confirmation({"booking": {"experience_title": "X", "status": "pending"}}, "de")
    assert rendered["locale"] == "en"
    assert rendered["dir"] == "ltr"
