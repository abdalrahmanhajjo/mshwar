from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import require_verified_user
from app.api.v1.session import require_session
from app.core.config import settings
from app.core.portal_auth import fetch_json
from app.dependencies import get_auth_db
from app.payments.confirmations import render_confirmation
from app.payments.factory import PaymentTimeout, get_payment_provider
from app.payments.outbox import outbox_metrics, publish_outbox
from app.payments.policy import refund_bps_from_snapshot, refund_minor
from app.schemas.checkout import (
    CheckoutCancelIn,
    CheckoutCommitIn,
    CheckoutInquiryIn,
    CheckoutPayIn,
    CheckoutQuoteIn,
    CheckoutSimulateIn,
)

router = APIRouter()


def _hash_body(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _idempotency(header_key: str | None, body_key: str | None) -> str:
    key = (header_key or body_key or "").strip()
    if len(key) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Idempotency-Key is required")
    return key


@router.get("/slots/{slug}")
async def list_slots(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await fetch_json(db, "SELECT app.list_public_slots(:slug)", {"slug": slug})


@router.post("/quote")
async def quote_checkout(
    payload: CheckoutQuoteIn,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await fetch_json(
        db,
        "SELECT app.quote_checkout(:slug, :slot_id, :party)",
        {"slug": payload.listing_slug, "slot_id": str(payload.slot_id), "party": payload.party_size},
    )


@router.post("/draft")
async def create_draft(
    payload: CheckoutCommitIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    _user: dict[str, object] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    session = await require_session(request, db)
    key = _idempotency(idempotency_key, payload.idempotency_key)
    body = payload.model_dump(mode="json")
    return await fetch_json(
        db,
        "SELECT app.create_checkout_draft(:user_id, :slug, :slot_id, :party, :key, :hash, :stop, :corr)",
        {
            "user_id": str(session["user_id"]),
            "slug": payload.listing_slug,
            "slot_id": str(payload.slot_id),
            "party": payload.party_size,
            "key": key,
            "hash": _hash_body(body),
            "stop": str(payload.trip_stop_id) if payload.trip_stop_id else None,
            "corr": request.headers.get("x-request-id") or key,
        },
    )


@router.post("/commit")
async def commit_checkout(
    payload: CheckoutCommitIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    _user: dict[str, object] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    session = await require_session(request, db)
    key = _idempotency(idempotency_key, payload.idempotency_key)
    body = payload.model_dump(mode="json")
    return await fetch_json(
        db,
        "SELECT app.commit_checkout(:user_id, :slug, :slot_id, :party, :key, :hash, :price, :policy, :stop, :corr)",
        {
            "user_id": str(session["user_id"]),
            "slug": payload.listing_slug,
            "slot_id": str(payload.slot_id),
            "party": payload.party_size,
            "key": key,
            "hash": _hash_body(body),
            "price": str(payload.price_rule_id),
            "policy": str(payload.policy_id),
            "stop": str(payload.trip_stop_id) if payload.trip_stop_id else None,
            "corr": request.headers.get("x-request-id") or key,
        },
    )


@router.post("/inquiry")
async def create_inquiry(
    payload: CheckoutInquiryIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    _user: dict[str, object] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    session = await require_session(request, db)
    key = (idempotency_key or payload.idempotency_key or f"inquiry-{uuid4().hex}").strip()
    return await fetch_json(
        db,
        "SELECT app.create_inquiry_request(:user_id, :slug, :party, :message, :requested, :key, :hash)",
        {
            "user_id": str(session["user_id"]),
            "slug": payload.listing_slug,
            "party": payload.party_size,
            "message": payload.message,
            "requested": payload.requested_at,
            "key": key,
            "hash": _hash_body(payload.model_dump(mode="json")),
        },
    )


@router.post("/ops/expire-holds")
async def expire_holds(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    limit: int = Query(default=100, ge=1, le=1000),
) -> Any:
    await require_session(request, db)
    expired = (await db.execute(text("SELECT app.expire_bookings(:lim)"), {"lim": limit})).scalar()
    await db.execute(text("SELECT app.expire_idempotency_keys()"))
    return {"expired": int(expired or 0)}


@router.post("/ops/publish-outbox")
async def publish_outbox_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    await require_session(request, db)
    return await publish_outbox(db)


@router.get("/ops/metrics")
async def checkout_metrics(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    await require_session(request, db)
    return await outbox_metrics(db)


@router.get("/mine")
async def list_mine(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(db, "SELECT app.list_my_checkout_bookings(:user_id)", {"user_id": str(session["user_id"])})


@router.get("/{booking_id}")
async def get_booking(
    booking_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.get_checkout_booking(:user_id, :booking_id)",
        {"user_id": str(session["user_id"]), "booking_id": str(booking_id)},
    )


@router.get("/{booking_id}/timeline")
async def get_timeline(
    booking_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.get_booking_timeline(:user_id, :booking_id)",
        {"user_id": str(session["user_id"]), "booking_id": str(booking_id)},
    )


@router.get("/{booking_id}/confirmation")
async def get_confirmation(
    booking_id: UUID,
    request: Request,
    locale: str = Query(default="en"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    record = await fetch_json(
        db,
        "SELECT app.get_booking_confirmation(:user_id, :booking_id)",
        {"user_id": str(session["user_id"]), "booking_id": str(booking_id)},
    )
    if not isinstance(record, dict):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    rendered = render_confirmation(record, locale)
    return {**record, "rendered": rendered}


@router.post("/{booking_id}/cancel-preview")
async def cancel_preview(
    booking_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    preview = await fetch_json(
        db,
        "SELECT app.preview_cancellation(:user_id, :booking_id)",
        {"user_id": str(session["user_id"]), "booking_id": str(booking_id)},
    )
    if isinstance(preview, dict) and preview.get("price_snapshot"):
        starts = None
        booking = await fetch_json(
            db,
            "SELECT app.get_checkout_booking(:user_id, :booking_id)",
            {"user_id": str(session["user_id"]), "booking_id": str(booking_id)},
        )
        if isinstance(booking, dict):
            starts = booking.get("starts_at")
            raw_policy = booking.get("policy_snapshot")
            policy = raw_policy if isinstance(raw_policy, dict) else {}
            bps = refund_bps_from_snapshot(policy, starts)
            preview = {
                **preview,
                "engine_refund_bps": bps,
                "engine_refund_minor": refund_minor(int(booking.get("total_minor") or 0), bps),
            }
    return preview


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: UUID,
    payload: CheckoutCancelIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.cancel_checkout_booking(:user_id, :booking_id, :reason, false, NULL)",
        {"user_id": str(session["user_id"]), "booking_id": str(booking_id), "reason": payload.reason},
    )


@router.post("/{booking_id}/pay")
async def pay_booking(
    booking_id: UUID,
    payload: CheckoutPayIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    _user: dict[str, object] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    session = await require_session(request, db)
    key = _idempotency(idempotency_key, payload.idempotency_key)
    fault = payload.fault if settings.environment != "production" else None
    provider = get_payment_provider(fault)
    booking = await fetch_json(
        db,
        "SELECT app.get_checkout_booking(:user_id, :booking_id)",
        {"user_id": str(session["user_id"]), "booking_id": str(booking_id)},
    )
    if not isinstance(booking, dict):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.get("status") != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking is not payable")
    if not booking.get("payment_required"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Payment is not required")
    try:
        intent = provider.create_intent(
            amount_minor=int(booking["total_minor"]),
            currency=str(booking["currency"]),
            idempotency_key=key,
            metadata={"booking_id": str(booking_id)},
        )
    except PaymentTimeout as exc:
        intent = exc.intent
        await fetch_json(
            db,
            "SELECT app.create_payment_for_booking(:user_id, :booking_id, :provider, :account, :idem, :external, :live)",
            {
                "user_id": str(session["user_id"]),
                "booking_id": str(booking_id),
                "provider": intent.provider,
                "account": intent.provider_account,
                "idem": key,
                "external": intent.provider_ref,
                "live": intent.live_mode,
            },
        )
        await fetch_json(
            db,
            "SELECT app.cancel_checkout_booking(:user_id, :booking_id, :reason, false, NULL)",
            {
                "user_id": str(session["user_id"]),
                "booking_id": str(booking_id),
                "reason": "Payment provider timed out",
            },
        )
        await db.commit()
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={"detail": "Payment timed out", "booking_id": str(booking_id)},
        )
    payment = await fetch_json(
        db,
        "SELECT app.create_payment_for_booking(:user_id, :booking_id, :provider, :account, :idem, :external, :live)",
        {
            "user_id": str(session["user_id"]),
            "booking_id": str(booking_id),
            "provider": intent.provider,
            "account": intent.provider_account,
            "idem": key,
            "external": intent.provider_ref,
            "live": intent.live_mode,
        },
    )
    if intent.status == "failed":
        await fetch_json(
            db,
            "SELECT app.apply_payment_outcome(:payment_id, 'failed', 'provider declined')",
            {"payment_id": payment["id"] if isinstance(payment, dict) else None},
        )
        await db.commit()
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content={"detail": "Payment failed", "booking_id": str(booking_id)},
        )
    outcome = None
    if intent.status == "succeeded":
        outcome = await fetch_json(
            db,
            "SELECT app.apply_payment_outcome(:payment_id, 'succeeded', 'provider settled')",
            {"payment_id": payment["id"] if isinstance(payment, dict) else None},
        )
    return {
        "booking_id": str(booking_id),
        "payment": payment,
        "intent": intent.model_dump(),
        "provider": intent.provider,
        "outcome": outcome,
    }


@router.post("/{booking_id}/simulate")
async def simulate_payment(
    booking_id: UUID,
    payload: CheckoutSimulateIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    if settings.is_production:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Simulation disabled")
    session = await require_session(request, db)
    row = (
        await db.execute(
            text(
                """
                SELECT id FROM app.payments
                WHERE booking_id = :booking_id
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"booking_id": str(booking_id)},
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    _ = session
    return await fetch_json(
        db,
        "SELECT app.apply_payment_outcome(:payment_id, :outcome, :reason)",
        {
            "payment_id": str(row[0]),
            "outcome": payload.outcome,
            "reason": f"simulated:{payload.outcome}",
        },
    )
