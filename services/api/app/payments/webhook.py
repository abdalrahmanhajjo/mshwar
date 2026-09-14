from __future__ import annotations

import hashlib
import logging
from typing import Any

from app.payments.provider import PaymentProvider
from app.payments.types import VerifiedWebhookEvent

logger = logging.getLogger("mshwar.payments.webhook")


def payload_hash(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sanitize_event(event: VerifiedWebhookEvent) -> dict[str, Any]:
    return {
        "event_id": event.event_id,
        "outcome": event.outcome,
        "provider_ref": event.provider_ref,
        "payment_id": event.payment_id,
    }


def verify_or_reject(provider: PaymentProvider, payload: bytes, signature: str) -> VerifiedWebhookEvent:
    try:
        return provider.verify_webhook(payload, signature)
    except Exception:
        logger.warning("unverified payment webhook rejected provider=%s", provider.name)
        raise
