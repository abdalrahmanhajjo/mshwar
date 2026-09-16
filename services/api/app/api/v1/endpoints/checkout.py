from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_session import require_session, require_verified_user
from app.core.config import settings
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.job_auth import require_dev_endpoints, require_job_token
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.payments.checkout_service import pay_for_booking, preview_cancellation, simulate_payment_outcome
from app.payments.confirmations import render_confirmation
from app.payments.outbox import outbox_metrics, publish_outbox
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
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Idempotency-Key is required")
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
    user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    key = _idempotency(idempotency_key, payload.idempotency_key)
    body = payload.model_dump(mode="json")
    return await fetch_json(
        db,
        "SELECT app.create_checkout_draft(:user_id, :slug, :slot_id, :party, :key, :hash, :stop, :corr)",
        {
            "user_id": str(user["user_id"]),
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
    user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    key = _idempotency(idempotency_key, payload.idempotency_key)
    body = payload.model_dump(mode="json")
    return await fetch_json(
        db,
        "SELECT app.commit_checkout(:user_id, :slug, :slot_id, :party, :key, :hash, :price, :policy, :stop, :corr)",
        {
            "user_id": str(user["user_id"]),
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
    user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    key = (idempotency_key or payload.idempotency_key or f"inquiry-{uuid4().hex}").strip()
    return await fetch_json(
        db,
        "SELECT app.create_inquiry_request(:user_id, :slug, :party, :message, :requested, :key, :hash)",
        {
            "user_id": str(user["user_id"]),
            "slug": payload.listing_slug,
            "party": payload.party_size,
            "message": payload.message,
            "requested": payload.requested_at,
            "key": key,
            "hash": _hash_body(payload.model_dump(mode="json")),
        },
    )


@router.post("/ops/expire-holds", dependencies=[Depends(require_job_token)])
async def expire_holds(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    limit: int = Query(default=100, ge=1, le=1000),
) -> Any:
    expired = (await db.execute(text("SELECT app.expire_bookings(:lim)"), {"lim": limit})).scalar()
    await db.execute(text("SELECT app.expire_idempotency_keys()"))
    return {"expired": int(expired or 0)}


@router.post("/ops/publish-outbox", dependencies=[Depends(require_job_token)])
async def publish_outbox_endpoint(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await publish_outbox(db)


@router.get("/ops/metrics", dependencies=[Depends(require_job_token)])
async def checkout_metrics(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
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
    return await preview_cancellation(db, user_id=str(session["user_id"]), booking_id=booking_id)


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
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    key = _idempotency(idempotency_key, payload.idempotency_key)
    fault = payload.fault if settings.dev_endpoints_enabled else None
    result = await pay_for_booking(
        db, user_id=str(user["user_id"]), booking_id=booking_id, idempotency_key=key, fault=fault
    )
    if result.kind == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if result.kind == "not_payable":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking is not payable")
    if result.kind == "not_required":
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="Payment is not required")
    if result.kind == "timed_out":
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={"detail": "Payment timed out", "booking_id": str(booking_id)},
        )
    if result.kind == "declined":
        return JSONResponse(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            content={"detail": "Payment failed", "booking_id": str(booking_id)},
        )
    if result.intent is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal error")
    return {
        "booking_id": str(booking_id),
        "payment": result.payment,
        "intent": result.intent.model_dump(),
        "provider": result.intent.provider,
        "outcome": result.settlement,
    }


@router.post("/{booking_id}/simulate", dependencies=[Depends(require_dev_endpoints)])
async def simulate_payment(
    booking_id: UUID,
    payload: CheckoutSimulateIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Dev-only: settle your own booking's latest payment without a provider."""
    session = await require_session(request, db)
    settled = await simulate_payment_outcome(
        db, user_id=str(session["user_id"]), booking_id=booking_id, outcome=payload.outcome
    )
    if settled is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return settled
