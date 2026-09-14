from __future__ import annotations

from pydantic import BaseModel, Field


class PaymentIntent(BaseModel):
    """Provider-neutral payment intent. Never stores a booking identifier as the provider ref."""

    provider: str
    provider_account: str
    provider_ref: str
    amount_minor: int
    currency: str
    status: str
    client_secret: str | None = None
    live_mode: bool = False


class RefundResult(BaseModel):
    provider: str
    provider_ref: str
    amount_minor: int
    status: str


class VerifiedWebhookEvent(BaseModel):
    provider: str
    provider_account: str
    event_id: str
    outcome: str
    provider_ref: str | None = None
    payment_id: str | None = None
    live_mode: bool = False
    sanitized: dict[str, object] = Field(default_factory=dict)


class PaymentFault(BaseModel):
    """Test-only fault injection. Domain code never imports a card-network SDK."""

    mode: str = ""  # fail | timeout | late_success | ""
