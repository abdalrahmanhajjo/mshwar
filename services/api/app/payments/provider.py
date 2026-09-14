from __future__ import annotations

from typing import Protocol

from app.payments.types import PaymentIntent, RefundResult, VerifiedWebhookEvent


class PaymentProvider(Protocol):
    name: str
    account: str
    live_mode: bool

    def create_intent(
        self,
        *,
        amount_minor: int,
        currency: str,
        idempotency_key: str,
        metadata: dict[str, str],
    ) -> PaymentIntent: ...

    def refund(
        self,
        *,
        provider_ref: str,
        amount_minor: int,
        idempotency_key: str,
        reason: str,
    ) -> RefundResult: ...

    def verify_webhook(self, payload: bytes, signature_header: str) -> VerifiedWebhookEvent: ...
