from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: UUID
    title: str
    body: str
    category: str
    read_at: datetime | None = None
    created_at: datetime
    deep_link: str | None = None
    event_type: str | None = None
    locale: str | None = None


class NotificationListOut(BaseModel):
    items: list[NotificationOut]
    page: int
    page_size: int
    total: int


class CommunicationPreferencesIn(BaseModel):
    marketing_email: bool
    marketing_in_app: bool = False


class RolePrefIn(BaseModel):
    role: str = Field(min_length=3, max_length=16)
    event_type: str = Field(min_length=3, max_length=64)
    email_enabled: bool = True
    in_app_enabled: bool = True


class EscalationIn(BaseModel):
    first_minutes: int = Field(default=30, ge=1, le=7 * 24 * 60)
    repeat_minutes: int = Field(default=60, ge=1, le=7 * 24 * 60)
    max: int = Field(default=3, ge=1, le=20)


class EmitNotificationIn(BaseModel):
    event_type: str = Field(min_length=3, max_length=64)
    aggregate_id: UUID
    user_id: UUID | None = None
    organization_id: UUID | None = None
    payload: dict[str, object] = Field(default_factory=dict)


class MaterialChangeIn(BaseModel):
    trip_id: UUID
    before: dict[str, object] = Field(default_factory=dict)
    after: dict[str, object] = Field(default_factory=dict)
