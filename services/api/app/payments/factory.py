from __future__ import annotations

from app.core.config import settings
from app.payments.lebanon_stub import LebanonAcquirerStub
from app.payments.provider import PaymentProvider
from app.payments.stripe_test import StripeTestAdapter
from app.payments.types import PaymentFault, PaymentIntent, RefundResult, VerifiedWebhookEvent


class PaymentTimeout(TimeoutError):
    def __init__(self, intent: PaymentIntent) -> None:
        super().__init__("payment provider timed out")
        self.intent = intent


class FaultInjectingProvider:
    """Wraps a provider so tests can fail, time out, or succeed late."""

    def __init__(self, inner: PaymentProvider, fault: str = "") -> None:
        self._inner = inner
        self.fault = fault
        self.name = inner.name
        self.account = inner.account
        self.live_mode = inner.live_mode
        self.timed_out = False

    def create_intent(
        self,
        *,
        amount_minor: int,
        currency: str,
        idempotency_key: str,
        metadata: dict[str, str],
    ) -> PaymentIntent:
        if self.fault == "fail":
            intent = self._inner.create_intent(
                amount_minor=amount_minor,
                currency=currency,
                idempotency_key=idempotency_key,
                metadata=metadata,
            )
            return intent.model_copy(update={"status": "failed"})
        if self.fault == "timeout":
            self.timed_out = True
            intent = self._inner.create_intent(
                amount_minor=amount_minor,
                currency=currency,
                idempotency_key=idempotency_key,
                metadata=metadata,
            )
            raise PaymentTimeout(intent)
        return self._inner.create_intent(
            amount_minor=amount_minor,
            currency=currency,
            idempotency_key=idempotency_key,
            metadata=metadata,
        )

    def refund(
        self,
        *,
        provider_ref: str,
        amount_minor: int,
        idempotency_key: str,
        reason: str,
    ) -> RefundResult:
        return self._inner.refund(
            provider_ref=provider_ref,
            amount_minor=amount_minor,
            idempotency_key=idempotency_key,
            reason=reason,
        )

    def verify_webhook(self, payload: bytes, signature_header: str) -> VerifiedWebhookEvent:
        event = self._inner.verify_webhook(payload, signature_header)
        if self.fault == "late_success":
            return event.model_copy(update={"outcome": "succeeded"})
        return event


def configured_fault() -> str:
    return (settings.payments_fault or "").strip()


def get_payment_provider(fault: str | None = None) -> PaymentProvider:
    name = (settings.payment_provider or "stripe_test").strip()
    if name == "lebanon_acquirer":
        inner: PaymentProvider = LebanonAcquirerStub()
    else:
        inner = StripeTestAdapter(
            secret_key=settings.stripe_secret_key,
            webhook_secret=settings.stripe_webhook_secret,
        )
    mode = fault if fault is not None else configured_fault()
    if mode:
        return FaultInjectingProvider(inner, mode)
    return inner


def payment_fault(mode: str) -> PaymentFault:
    return PaymentFault(mode=mode)
