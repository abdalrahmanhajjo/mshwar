from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class HubPage(BaseModel):
    page: int
    page_size: int
    total: int


class TripSummary(BaseModel):
    id: UUID
    name: str
    status: str
    created_at: datetime


class TripListOut(HubPage):
    items: list[TripSummary]


class FavoriteOut(BaseModel):
    id: UUID
    listing_slug: str
    created_at: datetime


class FavoriteCreate(BaseModel):
    listing_slug: str = Field(min_length=1, max_length=120)


class FavoriteListOut(HubPage):
    items: list[FavoriteOut]


class BookingOut(BaseModel):
    id: UUID
    listing_slug: str
    business_id: Optional[int] = None
    status: str
    policy_summary: str
    reason: Optional[str] = None
    created_at: datetime


class BookingCreate(BaseModel):
    listing_slug: Optional[str] = Field(default=None, max_length=120)
    business_id: Optional[int] = None
    policy_summary: Optional[str] = Field(default=None, max_length=400)


class BookingCancel(BaseModel):
    reason: str = Field(min_length=1, max_length=400)


class BookingListOut(HubPage):
    items: list[BookingOut]


class NotificationOut(BaseModel):
    id: UUID
    title: str
    body: str
    category: str
    read_at: Optional[datetime] = None
    created_at: datetime


class NotificationListOut(HubPage):
    items: list[NotificationOut]
