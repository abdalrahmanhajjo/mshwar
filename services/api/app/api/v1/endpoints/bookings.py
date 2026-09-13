from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import require_verified_user
from app.api.v1.hub_query import page_args, raise_hub_error
from app.api.v1.session import require_session
from app.dependencies import get_auth_db
from app.schemas.hub import BookingCancel, BookingCreate, BookingListOut, BookingOut

router = APIRouter()

_DEFAULT_POLICY = "Preview booking. Cancel requires a reason. Bookings are never deleted."


def _booking_out(row: Any) -> BookingOut:
    return BookingOut(
        id=row[0],
        listing_slug=str(row[1]),
        business_id=row[2],
        status=str(row[3]),
        policy_summary=str(row[4]),
        reason=row[5],
        created_at=row[6],
    )


@router.get("", response_model=BookingListOut)
async def list_bookings(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    paging: tuple[int, int, int] = Depends(page_args),
) -> BookingListOut:
    session = await require_session(request, db)
    page, page_size, offset = paging
    rows = (
        await db.execute(
            text(
                "SELECT id, listing_slug, business_id, status, policy_summary, reason, created_at, total "
                "FROM app.list_my_bookings(:user_id, :lim, :off)"
            ),
            {"user_id": str(session["user_id"]), "lim": page_size, "off": offset},
        )
    ).all()
    total = int(rows[0][7]) if rows else 0
    return BookingListOut(
        items=[_booking_out(row) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("", response_model=BookingOut)
async def create_booking(
    booking: BookingCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    _user: dict[str, object] = Depends(require_verified_user),  # noqa: B008
) -> BookingOut:
    session = await require_session(request, db)
    slug = (booking.listing_slug or "").strip() or (f"listing-{booking.business_id}" if booking.business_id else "")
    if not slug:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="listing_slug is required")
    try:
        row = (
            await db.execute(
                text(
                    "SELECT id, listing_slug, business_id, status, policy_summary, reason, created_at "
                    "FROM app.create_my_booking(:user_id, :slug, :business_id, :policy)"
                ),
                {
                    "user_id": str(session["user_id"]),
                    "slug": slug,
                    "business_id": booking.business_id,
                    "policy": (booking.policy_summary or _DEFAULT_POLICY).strip(),
                },
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Booking not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create booking")
    return _booking_out(row)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_booking(
    booking_id: UUID,
    payload: BookingCancel,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> BookingOut:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text(
                    "SELECT id, listing_slug, business_id, status, policy_summary, reason, created_at "
                    "FROM app.cancel_my_booking(:user_id, :booking_id, :reason)"
                ),
                {
                    "user_id": str(session["user_id"]),
                    "booking_id": str(booking_id),
                    "reason": payload.reason.strip(),
                },
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Booking not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return _booking_out(row)


@router.delete("/{booking_id}")
async def reject_delete_booking(booking_id: UUID) -> None:
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Bookings cannot be deleted",
        headers={"Allow": "GET, POST"},
    )
