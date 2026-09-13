from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ContactPayload(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    public_contact: ContactPayload | None = None


class OrganizationContactsUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    public_contact: ContactPayload | None = None
    internal_contact: ContactPayload | None = None
    fulfilment_instructions: str | None = Field(default=None, max_length=4000)


class VerificationSubmit(BaseModel):
    legal_name: str = Field(min_length=2, max_length=160)
    registration_number: str = Field(min_length=2, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)


class AdminVerificationAction(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class StaffInviteCreate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    role: str = Field(min_length=3, max_length=32)


class StaffInviteAccept(BaseModel):
    token: str = Field(min_length=8, max_length=256, repr=False)


class VenueUpsert(BaseModel):
    id: UUID | None = None
    name: str = Field(min_length=2, max_length=160)
    address: str = Field(min_length=2, max_length=240)
    lng: float
    lat: float
    destination_slug: str = "beirut"


class PricePayload(BaseModel):
    currency: str = "USD"
    price_type: str = "fixed"
    unit: str = "person"
    amount_minor: int | None = None
    max_amount_minor: int | None = None


class PolicyPayload(BaseModel):
    cancellation_rules: dict[str, Any] = Field(default_factory=dict)
    terms_text: str = Field(min_length=4, max_length=8000)


class ExperienceUpsert(BaseModel):
    id: UUID | None = None
    venue_id: UUID
    title: str = Field(min_length=3, max_length=160)
    description: str = ""
    booking_mode: str = "request"
    duration_minutes: int = Field(default=60, ge=15, le=24 * 60)
    min_party: int = Field(default=1, ge=1)
    max_party: int = Field(default=8, ge=1)
    min_age: int | None = Field(default=None, ge=0)
    setting: str = "mixed"
    intensity: int | None = Field(default=None, ge=1, le=5)
    weather_rules: dict[str, Any] = Field(default_factory=dict)
    category: str | None = None
    suitability: list[str] = Field(default_factory=list)
    weather: list[str] = Field(default_factory=list)
    price: PricePayload | None = None
    policy: PolicyPayload | None = None


class ExperienceStatusUpdate(BaseModel):
    status: str


class OpeningHourIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    opens: str
    closes: str


class OpeningHoursReplace(BaseModel):
    venue_id: UUID
    hours: list[OpeningHourIn]
    source: str = "portal"


class OpeningExceptionIn(BaseModel):
    venue_id: UUID
    local_date: date
    closed: bool = False
    opens: str | None = None
    closes: str | None = None
    source: str = "portal"


class BlackoutIn(BaseModel):
    experience_id: UUID
    start: datetime
    end: datetime
    reason: str = Field(min_length=2, max_length=240)
    source: str = "portal"


class SlotGenerateIn(BaseModel):
    experience_id: UUID
    start_date: date
    end_date: date
    capacity: int = Field(ge=1, le=500)
    source: str = "portal-recurrence"


class BookingRespondIn(BaseModel):
    status: str
    reason: str = Field(min_length=2, max_length=500)
    message: str | None = Field(default=None, max_length=2000)


class AnalyticsCaptureIn(BaseModel):
    event_name: str
    experience_id: UUID | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    dedupe_key: str = Field(min_length=4, max_length=200)


class FileUploadIn(BaseModel):
    filename: str = Field(min_length=1, max_length=160)
    content_type: str = "application/octet-stream"
    content_base64: str
    alt_text: str | None = None
    experience_id: UUID | None = None
    purpose: str = "verification"
