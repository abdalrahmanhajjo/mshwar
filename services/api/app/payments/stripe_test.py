from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any

from app.payments.types import PaymentIntent, RefundResult, VerifiedWebhookEvent

# Stripe SDK types are not imported. This adapter speaks HTTP-shaped dicts only.


class StripeTestAdapter:
    """Stripe test-mode adapter. When secret/webhook values are unset it stays local."""

    name = "stripe_test"
    account = "acct_platform"

    def __init__(
        self,
        secret_key: str = "",
        webhook_secret: str = "",
        *,
        live_mode: bool = False,
        stub: bool | None = None,
    ) -> None:
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret
        self.live_mode = live_mode
        self.stub = secret_key == "" if stub is None else stub

    def create_intent(
        self,
        *,
        amount_minor: int,
        currency: str,
        idempotency_key: str,
        metadata: dict[str, str],
    ) -> PaymentIntent:
        digest = hashlib.sha256(f"{idempotency_key}:{amount_minor}:{currency}".encode()).hexdigest()[:20]
        provider_ref = f"pi_stub_{digest}"
        return PaymentIntent(
            provider=self.name,
            provider_account=self.account,
            provider_ref=provider_ref,
            amount_minor=amount_minor,
            currency=currency,
            status="succeeded" if self.stub else "created",
            client_secret=f"{provider_ref}_secret" if self.stub else None,
            live_mode=self.live_mode,
        )

    def refund(
        self,
        *,
        provider_ref: str,
        amount_minor: int,
        idempotency_key: str,
        reason: str,
    ) -> RefundResult:
        digest = hashlib.sha256(f"{idempotency_key}:{provider_ref}:{reason}".encode()).hexdigest()[:16]
        return RefundResult(
            provider=self.name,
            provider_ref=f"re_stub_{digest}",
            amount_minor=amount_minor,
            status="requested",
        )

    def verify_webhook(self, payload: bytes, signature_header: str) -> VerifiedWebhookEvent:
        secret = self.webhook_secret or "whsec_local_stub"
        _verify_stripe_signature(payload, signature_header, secret)
        body = json.loads(payload.decode("utf-8"))
        if not isinstance(body, dict):
            raise TypeError("webhook payload must be an object")
        data = body.get("data") if isinstance(body.get("data"), dict) else body
        obj = data.get("object") if isinstance(data, dict) and isinstance(data.get("object"), dict) else data
        event_id = str(body.get("id") or body.get("event_id") or "")
        if not event_id:
            raise ValueError("webhook event id required")
        outcome = _outcome_from_event(
            str(body.get("type") or body.get("outcome") or ""), obj if isinstance(obj, dict) else {}
        )
        provider_ref = None
        payment_id = None
        if isinstance(obj, dict):
            provider_ref = _optional_str(obj.get("id") or obj.get("provider_ref"))
            raw_meta = obj.get("metadata")
            meta = raw_meta if isinstance(raw_meta, dict) else {}
            payment_id = _optional_str(obj.get("payment_id") or meta.get("payment_id"))
        sanitized: dict[str, object] = {
            "event_id": event_id,
            "outcome": outcome,
            "provider_ref": provider_ref,
            "payment_id": payment_id,
        }
        return VerifiedWebhookEvent(
            provider=self.name,
            provider_account=self.account,
            event_id=event_id,
            outcome=outcome,
            provider_ref=provider_ref,
            payment_id=payment_id,
            live_mode=self.live_mode,
            sanitized=sanitized,
        )


def sign_stripe_payload(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    ts = str(timestamp if timestamp is not None else int(time.time()))
    signed = hmac.new(secret.encode("utf-8"), f"{ts}.".encode() + payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={signed}"


def _verify_stripe_signature(payload: bytes, header: str, secret: str) -> None:
    if not header:
        raise ValueError("missing webhook signature")
    parts = dict(item.split("=", 1) for item in header.split(",") if "=" in item)
    timestamp = parts.get("t")
    signature = parts.get("v1")
    if not timestamp or not signature:
        raise ValueError("invalid webhook signature")
    expected = hmac.new(secret.encode("utf-8"), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("webhook signature mismatch")
    if abs(int(time.time()) - int(timestamp)) > 300:
        raise ValueError("webhook timestamp too old")


def _outcome_from_event(event_type: str, obj: dict[str, Any]) -> str:
    if event_type.endswith("succeeded") or event_type == "succeeded" or obj.get("status") == "succeeded":
        return "succeeded"
    if event_type.endswith("failed") or event_type == "failed" or obj.get("status") == "failed":
        return "failed"
    if event_type.endswith(("canceled", "cancelled")) or obj.get("status") in {"cancelled", "canceled"}:
        return "cancelled"
    explicit = obj.get("outcome")
    if explicit in {"succeeded", "failed", "cancelled"}:
        return str(explicit)
    raise ValueError("unrecognised payment outcome")


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text or None
