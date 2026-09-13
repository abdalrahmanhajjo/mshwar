from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import require_verified_user
from app.dependencies import get_db

router = APIRouter()


class Booking(BaseModel):
    id: int
    business_id: int
    status: str = "pending"


class BookingCreate(BaseModel):
    business_id: int


@router.get("", response_model=list[Booking])
async def list_bookings(db: AsyncSession = Depends(get_db)) -> list[Booking]:  # noqa: B008
    return []


@router.post("", response_model=Booking)
async def create_booking(
    booking: BookingCreate,
    _user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
) -> Booking:
    return Booking(id=1, business_id=booking.business_id, status="confirmed")
