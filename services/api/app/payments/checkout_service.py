"""Checkout flows that combine the payment provider with the booking functions.

Routers stay thin: they authenticate, validate input and map these results to HTTP.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sql import fetch_json
from app.payments.factory import PaymentTimeout, get_payment_provider
from app.payments.policy import refund_bps_from_snapshot, refund_minor
from app.payments.types import PaymentIntent

PayOutcomeKind = Literal["processed", "declined", "timed_out", "not_found", "not_payable", "not_required"]

_CREATE_PAYMENT = (
    "SELECT app.create_payment_for_booking(:user_id, :booking_id, :provider, :account, :idem, :external, :live)"
)


@dataclass
class PayOutcome:
    kind: PayOutcomeKind
    intent: PaymentIntent | None = None
    payment: Any = None
    settlement: Any = None


async def get_customer_booking(db: AsyncSession, user_id: str, booking_id: UUID) -> Any:
    return await fetch_json(
        db,
        "SELECT app.get_checkout_booking(:user_id, :booking_id)",
        {"user_id": user_id, "booking_id": str(booking_id)},
    )


async def _record_payment(db: AsyncSession, user_id: str, booking_id: UUID, key: str, intent: PaymentIntent) -> Any:
    return await fetch_json(
        db,
        _CREATE_PAYMENT,
        {
            "user_id": user_id,
            "booking_id": str(booking_id),
            "provider": intent.provider,
            "account": intent.provider_account,
            "idem": key,
            "external": intent.provider_ref,
            "live": intent.live_mode,
        },
    )


async def _apply_outcome(db: AsyncSession, payment: Any, outcome: str, reason: str) -> Any:
    payment_id = payment["id"] if isinstance(payment, dict) else None
    return await fetch_json(
        db,
        "SELECT app.apply_payment_outcome(:payment_id, :outcome, :reason)",
        {"payment_id": payment_id, "outcome": outcome, "reason": reason},
    )


async def pay_for_booking(
    db: AsyncSession,
    *,
    user_id: str,
    booking_id: UUID,
    idempotency_key: str,
    fault: str | None,
) -> PayOutcome:
    """Create a provider intent for a pending booking and record the result.

    Failed and timed-out attempts are committed immediately so the booking and
    its inventory are released even though the HTTP response is an error.
    """
    booking = await get_customer_booking(db, user_id, booking_id)
    if not isinstance(booking, dict):
        return PayOutcome("not_found")
    if booking.get("status") != "pending":
        return PayOutcome("not_payable")
    if not booking.get("payment_required"):
        return PayOutcome("not_required")

    provider = get_payment_provider(fault)
    try:
        intent = provider.create_intent(
            amount_minor=int(booking["total_minor"]),
            currency=str(booking["currency"]),
            idempotency_key=idempotency_key,
            metadata={"booking_id": str(booking_id)},
        )
    except PaymentTimeout as exc:
        # The provider state is unknown. The booking is released now; a late success
        # arrives by webhook and is queued for reconciliation by apply_payment_outcome.
        await _record_payment(db, user_id, booking_id, idempotency_key, exc.intent)
        await fetch_json(
            db,
            "SELECT app.cancel_checkout_booking(:user_id, :booking_id, :reason, false, NULL)",
            {"user_id": user_id, "booking_id": str(booking_id), "reason": "Payment provider timed out"},
        )
        await db.commit()
        return PayOutcome("timed_out", intent=exc.intent)

    payment = await _record_payment(db, user_id, booking_id, idempotency_key, intent)
    if intent.status == "failed":
        await _apply_outcome(db, payment, "failed", "provider declined")
        await db.commit()
        return PayOutcome("declined", intent=intent, payment=payment)
    settlement = None
    if intent.status == "succeeded":
        settlement = await _apply_outcome(db, payment, "succeeded", "provider settled")
    return PayOutcome("processed", intent=intent, payment=payment, settlement=settlement)


async def preview_cancellation(db: AsyncSession, *, user_id: str, booking_id: UUID) -> Any:
    """Database preview plus the refund computed from the frozen policy snapshot."""
    preview = await fetch_json(
        db,
        "SELECT app.preview_cancellation(:user_id, :booking_id)",
        {"user_id": user_id, "booking_id": str(booking_id)},
    )
    if not (isinstance(preview, dict) and preview.get("price_snapshot")):
        return preview
    booking = await get_customer_booking(db, user_id, booking_id)
    if not isinstance(booking, dict):
        return preview
    raw_policy = booking.get("policy_snapshot")
    policy = raw_policy if isinstance(raw_policy, dict) else {}
    bps = refund_bps_from_snapshot(policy, booking.get("starts_at"))
    return {
        **preview,
        "engine_refund_bps": bps,
        "engine_refund_minor": refund_minor(int(booking.get("total_minor") or 0), bps),
    }


async def simulate_payment_outcome(db: AsyncSession, *, user_id: str, booking_id: UUID, outcome: str) -> Any:
    """Dev-only: settle the customer's latest payment for their own booking."""
    payment_id = await fetch_json(
        db,
        "SELECT app.latest_customer_payment(:user_id, :booking_id)",
        {"booking_id": str(booking_id), "user_id": user_id},
    )
    if payment_id is None:
        return None
    return await _apply_outcome(db, {"id": str(payment_id)}, outcome, f"simulated:{outcome}")
