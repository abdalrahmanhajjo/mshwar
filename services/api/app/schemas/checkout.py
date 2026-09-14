from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CheckoutQuoteIn(BaseModel):
    listing_slug: str = Field(min_length=1, max_length=160)
    slot_id: UUID
    party_size: int = Field(ge=1, le=40)
    trip_stop_id: UUID | None = None


class CheckoutCommitIn(CheckoutQuoteIn):
    price_rule_id: UUID
    policy_id: UUID
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)


class CheckoutInquiryIn(BaseModel):
    listing_slug: str = Field(min_length=1, max_length=160)
    party_size: int = Field(ge=1, le=40)
    message: str = Field(min_length=4, max_length=4000)
    requested_at: datetime | None = None
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)


class CheckoutCancelIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class CheckoutPayIn(BaseModel):
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)
    fault: str | None = Field(default=None, max_length=32)


class CheckoutSimulateIn(BaseModel):
    outcome: str = Field(min_length=4, max_length=16)
    event_id: str | None = None
