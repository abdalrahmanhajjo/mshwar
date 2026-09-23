"""Request bodies for the guide portal (G1: identity and verification)."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

TIERS = {"licensed", "host"}
DOCUMENT_KINDS = {"licence", "id", "first_aid", "insurance", "driving"}


class GuideProfileIn(BaseModel):
    """The application form. Everything but tier and name is optional at draft."""

    model_config = ConfigDict(extra="forbid")

    tier: str
    display_name: str = Field(min_length=2, max_length=80)
    headline: str = Field(default="", max_length=140)
    bio: str = Field(default="", max_length=4000)
    languages: list[str] = Field(default_factory=list, max_length=8)
    regions: list[str] = Field(default_factory=list, max_length=12)
    specialities: list[str] = Field(default_factory=list, max_length=12)
    years_guiding: int | None = Field(default=None, ge=0, le=70)
    phone: str = Field(default="", max_length=32)

    @field_validator("tier")
    @classmethod
    def known_tier(cls, value: str) -> str:
        if value not in TIERS:
            raise ValueError("tier must be licensed or host")
        return value


class GuideCredentialIn(BaseModel):
    """One uploaded document. The key points at private storage, never a URL."""

    model_config = ConfigDict(extra="forbid")

    kind: str
    document_key: str = Field(min_length=1, max_length=400)
    reference: str = Field(default="", max_length=120)
    issuer: str = Field(default="", max_length=120)
    issued_on: date | None = None
    expires_on: date | None = None

    @field_validator("kind")
    @classmethod
    def known_kind(cls, value: str) -> str:
        if value not in DOCUMENT_KINDS:
            raise ValueError("unknown document kind")
        return value


class GuideDocumentDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str
    reason: str = Field(default="", max_length=500)

    @field_validator("decision")
    @classmethod
    def known_decision(cls, value: str) -> str:
        if value not in {"verified", "rejected"}:
            raise ValueError("decision must be verified or rejected")
        return value


class GuideDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str
    reason: str = Field(default="", max_length=500)

    @field_validator("decision")
    @classmethod
    def known_decision(cls, value: str) -> str:
        if value not in {"approved", "rejected", "suspended"}:
            raise ValueError("unknown decision")
        return value


# ---- G2: tours, availability and requests -------------------------------------------


class TourMeetingIn(BaseModel):
    """Where the day starts. It becomes the tour's venue."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=120)
    address: str = Field(default="", max_length=240)
    lat: float = Field(ge=33.0, le=34.8)
    lng: float = Field(ge=35.0, le=36.7)
    destination_slug: str = Field(default="beirut", max_length=80)


class GuideTourIn(BaseModel):
    """A tour: a listing on the guide's own organisation plus a route and a meeting point."""

    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=8, max_length=4000)
    duration_minutes: int = Field(ge=30, le=720)
    min_party: int = Field(default=1, ge=1, le=60)
    max_party: int = Field(ge=1, le=60)
    min_age: int | None = Field(default=None, ge=0, le=21)
    intensity: int | None = Field(default=None, ge=1, le=5)
    setting: str = Field(default="outdoor", pattern="^(indoor|outdoor|mixed)$")
    category: str = Field(default="culture", max_length=40)
    price_minor: int = Field(default=0, ge=0, le=100_000_00)
    price_unit: str = Field(default="person", pattern="^(person|group)$")
    languages: list[str] = Field(default_factory=list, max_length=8)
    included: str = Field(default="", max_length=1000)
    bring: str = Field(default="", max_length=1000)
    cancellation_terms: str = Field(default="", max_length=1000)
    meeting: TourMeetingIn
    route: list[str] = Field(default_factory=list, max_length=12)


class WeeklyStartIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    weekday: int = Field(ge=0, le=6)
    start: str = Field(pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$")


class AvailabilityExceptionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    local_date: date
    reason: str = Field(default="", max_length=140)


class GuideAvailabilityIn(BaseModel):
    """A weekly rhythm, with the days that break it."""

    model_config = ConfigDict(extra="forbid")

    pattern: list[WeeklyStartIn] = Field(default_factory=list, max_length=28)
    min_notice_hours: int = Field(default=24, ge=0, le=720)
    max_tours_per_day: int = Field(default=2, ge=1, le=8)
    exceptions: list[AvailabilityExceptionIn] = Field(default_factory=list, max_length=120)


class TourRequestIn(BaseModel):
    """A traveller asks for a place on a tour. Nothing is paid here."""

    model_config = ConfigDict(extra="forbid")

    slot_id: str
    party_size: int = Field(ge=1, le=60)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=120)


class TourRequestResponseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern="^(confirmed|rejected)$")
    reason: str = Field(min_length=2, max_length=500)
    message: str | None = Field(default=None, max_length=1000)


# ---- G3: hire a guide from the planner -------------------------------------------------


class HireTermsIn(BaseModel):
    """What a licensed guide charges for a hired day, and the largest group they take."""

    model_config = ConfigDict(extra="forbid")

    day_rate_minor: int | None = Field(default=None, ge=0, le=100_000_00)
    max_group: int = Field(default=12, ge=1, le=60)


class PartyNotesIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dietary: str = Field(default="", max_length=500)
    accessibility: str = Field(default="", max_length=500)
    children: str = Field(default="", max_length=500)


class EngagementRequestIn(BaseModel):
    """A traveller asks a guide to run one version of their plan."""

    model_config = ConfigDict(extra="forbid")

    version_id: str
    guide_slug: str = Field(min_length=1, max_length=120)
    party_size: int | None = Field(default=None, ge=1, le=60)
    message: str = Field(default="", max_length=2000)
    party_notes: PartyNotesIn = Field(default_factory=PartyNotesIn)
    contact_phone: str = Field(default="", max_length=32)


class EngagementAnswerIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer: str = Field(pattern="^(accept|decline)$")
    reason: str = Field(default="", max_length=500)


class ProposedStopIn(BaseModel):
    """Either an existing stop (by id) at its new time, or a new place (by slug)."""

    model_config = ConfigDict(extra="forbid")

    stop_id: str | None = None
    slug: str | None = Field(default=None, max_length=160)
    starts_at: str
    ends_at: str


class EngagementProposalIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stops: list[ProposedStopIn] = Field(min_length=1, max_length=20)
    note: str = Field(default="", max_length=1000)
    rate_minor: int | None = Field(default=None, ge=0, le=100_000_00)


class EngagementDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str = Field(pattern="^(confirm|accept_changes|reject_changes)$")


class EngagementCancelIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(default="", max_length=500)


# ---- G4: place proposals and corrections ---------------------------------------------


class ProposedPlaceIn(BaseModel):
    """For a new place, everything a listing needs; for a correction, only what changes."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=140)
    title: str | None = Field(default=None, max_length=140)
    description: str | None = Field(default=None, max_length=4000)
    category: str | None = Field(default=None, max_length=40)
    destination_slug: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=240)
    lat: float | None = Field(default=None, ge=33.0, le=34.8)
    lng: float | None = Field(default=None, ge=35.0, le=36.7)
    setting: str | None = Field(default=None, pattern="^(indoor|outdoor|mixed)$")
    listing_kind: str | None = Field(default=None, pattern="^(experience|attraction|restaurant)$")
    suggested_minutes: int | None = Field(default=None, ge=15, le=600)
    free_entry: bool | None = None
    closed: bool | None = None
    note: str | None = Field(default=None, max_length=1000)


class ProposalIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str = Field(pattern="^(new|correction)$")
    target_slug: str | None = Field(default=None, max_length=160)
    place: ProposedPlaceIn
    evidence_urls: list[str] = Field(min_length=1, max_length=5)


class ProposalPhotoIn(BaseModel):
    """Either the guide's own photo, uploaded, or a Wikimedia Commons file."""

    model_config = ConfigDict(extra="forbid")

    # The guide's own photo.
    filename: str | None = Field(default=None, max_length=200)
    content_type: str | None = Field(default=None, max_length=40)
    content_base64: str | None = None
    rights_granted: bool = False
    # A Commons photo.
    commons_page_url: str | None = Field(default=None, max_length=500)
    commons_image_url: str | None = Field(default=None, max_length=500)
    license: str | None = Field(default=None, max_length=80)
    license_url: str | None = Field(default=None, max_length=500)
    attribution: str | None = Field(default=None, max_length=200)
    alt_text: str = Field(default="", max_length=200)


class ProposalDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str = Field(pattern="^(accepted|rejected)$")
    reason: str = Field(default="", max_length=500)
