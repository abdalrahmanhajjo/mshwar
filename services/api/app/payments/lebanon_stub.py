from __future__ import annotations

import hashlib

from app.payments.types import PaymentIntent, RefundResult, VerifiedWebhookEvent


class LebanonAcquirerStub:
    """Second adapter proving booking code does not depend on a card network.

    Lebanon is not on Stripe's global availability list. Pilot production must
    select a licensed local acquirer; this stub stands in for that interface.
    """

    name = "lebanon_acquirer"
    account = "acct_lebanon_pilot"
    live_mode = False

    def create_intent(
        self,
        *,
        amount_minor: int,
        currency: str,
        idempotency_key: str,
        metadata: dict[str, str],
    ) -> PaymentIntent:
        digest = hashlib.sha256(f"lb:{idempotency_key}:{amount_minor}".encode()).hexdigest()[:18]
        return PaymentIntent(
            provider=self.name,
            provider_account=self.account,
            provider_ref=f"lb_pi_{digest}",
            amount_minor=amount_minor,
            currency=currency,
            status="succeeded",
            client_secret=None,
            live_mode=False,
        )

    def refund(
        self,
        *,
        provider_ref: str,
        amount_minor: int,
        idempotency_key: str,
        reason: str,
    ) -> RefundResult:
        digest = hashlib.sha256(f"lb-re:{idempotency_key}".encode()).hexdigest()[:14]
        return RefundResult(
            provider=self.name,
            provider_ref=f"lb_re_{digest}",
            amount_minor=amount_minor,
            status="requested",
        )

    def verify_webhook(self, payload: bytes, signature_header: str) -> VerifiedWebhookEvent:
        if signature_header != "lebanon-stub":
            raise ValueError("lebanon acquirer webhook rejected")
        event_id = hashlib.sha256(payload).hexdigest()[:24]
        return VerifiedWebhookEvent(
            provider=self.name,
            provider_account=self.account,
            event_id=f"lb_evt_{event_id}",
            outcome="succeeded",
            provider_ref=None,
            payment_id=None,
            live_mode=False,
            sanitized={"event_id": f"lb_evt_{event_id}", "outcome": "succeeded"},
        )


def adapter_names() -> tuple[str, ...]:
    return ("stripe_test", "lebanon_acquirer")
