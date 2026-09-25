"""Request bodies for partner accounts: drivers and money changers (V1-V4)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PARTNER_KINDS = {"driver", "changer"}
DOCUMENT_KINDS = {
    "id",
    "selfie",
    "profile_photo",
    "public_licence",
    "judicial_record",
    "vehicle_registration",
    "insurance",
    "inspection",
    "plate_rental",
    "bdl_registration",
    "commercial_register",
    "storefront_photo",
}
# Photos of a face or a shop front must be images; the rest may be PDFs.
PHOTO_KINDS = {"selfie", "profile_photo", "storefront_photo"}


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PartnerProfileIn(_Strict):
    display_name: str = Field(min_length=2, max_length=80)
    headline: str = Field(default="", max_length=140)
    bio: str = Field(default="", max_length=2000)
    languages: list[str] = Field(default_factory=list, max_length=10)
    regions: list[str] = Field(default_factory=list, max_length=30)


class PartnerDocumentUploadIn(_Strict):
    kind: str
    filename: str = Field(min_length=1, max_length=200)
    content_type: str = Field(max_length=60)
    content_base64: str
    vehicle_id: str | None = None
    office_id: str | None = None
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


class VehicleIn(_Strict):
    id: str | None = None
    plate: str = Field(min_length=2, max_length=16)
    plate_rented: bool = False
    make: str = Field(min_length=1, max_length=40)
    model: str = Field(min_length=1, max_length=40)
    colour: str = Field(min_length=1, max_length=30)
    year: int | None = Field(default=None, ge=1970, le=2100)
    seats: int = Field(ge=1, le=16)
    active: bool = True


class AgreementIn(_Strict):
    version: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")


class PhoneStartIn(_Strict):
    phone: str = Field(min_length=8, max_length=20)

    @field_validator("phone")
    @classmethod
    def e164(cls, value: str) -> str:
        cleaned = "".join(ch for ch in value if ch.isdigit() or ch == "+")
        if cleaned.startswith("00"):
            cleaned = "+" + cleaned[2:]
        return cleaned


class CodeIn(_Strict):
    code: str = Field(min_length=6, max_length=12)


class PartnerDecisionIn(_Strict):
    decision: str = Field(pattern="^(approved|rejected|suspended)$")
    reason: str = Field(default="", max_length=500)


class PartnerDocumentDecisionIn(_Strict):
    decision: str = Field(pattern="^(verified|rejected)$")
    reason: str = Field(default="", max_length=500)


class PartnerCheckIn(_Strict):
    kind: str = Field(pattern="^(video_call|visit|recheck)$")
    notes: str = Field(min_length=10, max_length=2000)
    outcome: str = Field(default="ok", pattern="^(ok|concern)$")


# ---- V2: transport cards --------------------------------------------------------------


class EvidenceIn(_Strict):
    kind: str = Field(pattern="^(field_check|operator|guide_report|traveller_report)$")
    note: str = Field(min_length=5, max_length=500)
    url: str = Field(default="", max_length=500)
    on: date | None = None


class TransportRouteIn(_Strict):
    scope: str = Field(pattern="^(between|airport|around)$")
    from_destination: str | None = Field(default=None, max_length=80)
    to_destination: str = Field(min_length=2, max_length=80)
    mode: str = Field(pattern="^(service_taxi|taxi|bus|van|ride_hailing|car_rental|walking|ferry)$")
    line_name: str = Field(default="", max_length=80)
    pickup_name: str = Field(default="", max_length=120)
    pickup_lat: float | None = Field(default=None, ge=33.0, le=34.8)
    pickup_lng: float | None = Field(default=None, ge=35.0, le=36.7)
    dropoff_name: str = Field(default="", max_length=120)
    dropoff_lat: float | None = Field(default=None, ge=33.0, le=34.8)
    dropoff_lng: float | None = Field(default=None, ge=35.0, le=36.7)
    fare_basis: str = Field(default="person", pattern="^(person|vehicle|free)$")
    fare_low_minor: int | None = Field(default=None, ge=0)
    fare_high_minor: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, pattern="^(USD|LBP|EUR)$")
    duration_min: int | None = Field(default=None, ge=1, le=1440)
    duration_max: int | None = Field(default=None, ge=1, le=1440)
    frequency_minutes: int | None = Field(default=None, ge=1, le=1440)
    first_departure: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    last_departure: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    runs_sunday: bool | None = None
    tips: dict[str, str] = Field(default_factory=dict)
    step_free: bool | None = None
    night_service: bool | None = None
    luggage_ok: bool | None = None
    safety_note: str = Field(default="", max_length=500)
    evidence: list[EvidenceIn] = Field(default_factory=list, max_length=10)
    replaces_route_id: str | None = None


class TransportDecisionIn(_Strict):
    decision: str = Field(pattern="^(published|rejected|retired)$")
    checked_on: date | None = None
    field_check_note: str = Field(default="", max_length=500)
    reason: str = Field(default="", max_length=500)


class TransportFlagIn(_Strict):
    reason: str = Field(pattern="^(fare_higher|fare_lower|no_longer_runs|wrong_pickup|times_wrong|unsafe|other)$")
    details: str = Field(default="", max_length=1000)


# ---- V3: rides ----------------------------------------------------------------------------


class DriverTermsIn(_Strict):
    day_rate_minor: int | None = Field(default=None, ge=1000, le=100000)
    airport_pickups: bool = True


class RideRequestIn(_Strict):
    kind: str = Field(pattern="^(ride|day|airport)$")
    destination: str = Field(min_length=2, max_length=80)
    trip_id: str | None = None
    pickup_name: str = Field(min_length=2, max_length=160)
    pickup_lat: float | None = Field(default=None, ge=33.0, le=34.8)
    pickup_lng: float | None = Field(default=None, ge=35.0, le=36.7)
    dropoff_name: str = Field(default="", max_length=160)
    dropoff_lat: float | None = Field(default=None, ge=33.0, le=34.8)
    dropoff_lng: float | None = Field(default=None, ge=35.0, le=36.7)
    starts_at: datetime
    hours: int | None = Field(default=None, ge=2, le=14)
    party_size: int = Field(default=1, ge=1, le=16)
    luggage: int = Field(default=0, ge=0, le=20)
    flight_number: str = Field(default="", max_length=12)
    notes: str = Field(default="", max_length=1000)


class RideQuoteIn(_Strict):
    vehicle_id: str
    price_minor: int = Field(ge=100, le=200000)
    note: str = Field(default="", max_length=500)


class RideCancelIn(_Strict):
    reason: str = Field(default="", max_length=500)


class RideFinishIn(_Strict):
    outcome: str = Field(pattern="^(completed|no_show)$")


class RideReviewIn(_Strict):
    rating: int = Field(ge=1, le=5)
    body: str = Field(default="", max_length=2000)


class RideReportIn(_Strict):
    ride_id: str
    category: str = Field(pattern="^(safety|wrong_driver|wrong_plate|unsafe_vehicle|overcharge|no_show|conduct|other)$")
    details: str = Field(min_length=10, max_length=4000)


# ---- V4: money changers ---------------------------------------------------------------------


class LicenceIn(_Strict):
    bdl_number: str = Field(min_length=1, max_length=20)
    category: str = Field(pattern="^[ABab]$")
    legal_name: str = Field(min_length=2, max_length=160)


class OfficeIn(_Strict):
    id: str | None = None
    branch_name: str = Field(min_length=2, max_length=120)
    address: str = Field(min_length=4, max_length=240)
    lat: float = Field(ge=33.0, le=34.8)
    lng: float = Field(ge=35.0, le=36.7)
    destination: str = Field(min_length=2, max_length=80)
    hours: dict[str, list[list[str]]] = Field(default_factory=dict)
    phone: str = Field(default="", max_length=20)
    active: bool = True

    @field_validator("hours")
    @classmethod
    def hours_shape(cls, value: dict[str, list[list[str]]]) -> dict[str, list[list[str]]]:
        import re

        for day, spans in value.items():
            if day not in {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}:
                raise ValueError("opening hours use mon to sun")
            for span in spans:
                if len(span) != 2 or not all(re.fullmatch(r"\d{2}:\d{2}", part) for part in span) or span[0] >= span[1]:
                    raise ValueError("each opening span is [open, close], for example ['09:00', '18:00']")
        return value


class RateIn(_Strict):
    base: str = Field(pattern="^(USD|EUR)$")
    buy: float = Field(gt=0, le=10_000_000)
    sell: float = Field(gt=0, le=10_000_000)


class RatesIn(_Strict):
    office_id: str
    rates: list[RateIn] = Field(min_length=1, max_length=2)


class ExchangeReportIn(_Strict):
    office_id: str
    category: str = Field(pattern="^(rate_different|counterfeit|refused_receipt|conduct|other)$")
    details: str = Field(min_length=10, max_length=4000)


class RegisterEntryIn(_Strict):
    bdl_number: str = Field(min_length=1, max_length=20)
    category: str = Field(pattern="^[ABab]$")
    name: str = Field(default="", max_length=200)
    address: str = Field(default="", max_length=300)


class RegisterLoadIn(_Strict):
    published_on: date
    source_url: str = Field(pattern=r"^https://", max_length=500)
    entries: list[RegisterEntryIn] = Field(min_length=1, max_length=5000)


class OfficeCheckIn(_Strict):
    kind: str = Field(pattern="^(visit|video_call)$")
    notes: str = Field(min_length=10, max_length=2000)


class RateDecisionIn(_Strict):
    decision: str = Field(pattern="^(live|rejected)$")


# ---- V5/V6: restaurants and stays ------------------------------------------------------------


_HTTPS = r"^(https://.*)?$"


class ListingDetailsIn(_Strict):
    listing_kind: str = Field(pattern="^(experience|attraction|restaurant|hotel)$")
    licence_number: str = Field(default="", max_length=60)
    licence_authority: str = Field(default="", max_length=120)
    licence_expires_on: date | None = None
    cuisines: list[str] = Field(default_factory=list, max_length=8)
    price_level: int | None = Field(default=None, ge=1, le=4)
    reservation_phone: str = Field(default="", max_length=20)
    reservation_whatsapp: str = Field(default="", max_length=20)
    reservation_url: str = Field(default="", max_length=500, pattern=_HTTPS)
    stay_type: str | None = Field(default=None, pattern="^(hotel|guesthouse|hostel|apartment)$")
    stars: int | None = Field(default=None, ge=1, le=5)
    rooms: int | None = Field(default=None, ge=1, le=2000)
    check_in: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    check_out: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    price_from_minor: int | None = Field(default=None, gt=0)
    booking_url: str = Field(default="", max_length=500, pattern=_HTTPS)
    accepts_requests: bool = False
    amenities: list[str] = Field(default_factory=list, max_length=20)
    accessibility: list[str] = Field(default_factory=list, max_length=10)


class PlaceTypesIn(_Strict):
    """What kinds of place a listing is (migration 045). The first is the main one.

    ``meal_services`` and ``schedule_note`` are optional: leave them out to keep what is set,
    send an empty list or text to clear them.
    """

    place_types: list[Annotated[str, Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=40)]] = Field(
        min_length=1, max_length=6
    )
    meal_services: list[Literal["breakfast", "brunch", "lunch", "dinner", "late"]] | None = Field(
        default=None, max_length=5
    )
    schedule_note: str | None = Field(default=None, max_length=280)
    #: A restaurant's own typical spend per person, in cents: what the planner prices a meal with.
    typical_spend_minor: int | None = Field(default=None, ge=100, le=100_000_000)


class PlaceFactsIn(_Strict):
    """Facts about a place travellers filter on (migration 049). Leave a fact out when you do not know it."""

    halal: bool | None = None
    vegetarian: bool | None = None
    vegan: bool | None = None
    gluten_free: bool | None = None
    serves_alcohol: bool | None = None
    wheelchair_access: bool | None = None
    step_free: bool | None = None
    accessible_toilet: bool | None = None
    parking: bool | None = None
    kids_friendly: bool | None = None
    stroller_friendly: bool | None = None
    outdoor_seating: bool | None = None
    accepts_card: bool | None = None
    accepts_usd_cash: bool | None = None
    accepts_lbp_cash: bool | None = None
    min_age: int | None = Field(default=None, ge=0, le=25)
    views: list[Literal["sea", "mountain", "city", "valley", "sunset"]] = Field(default_factory=list, max_length=5)
    languages: list[str] = Field(default_factory=list, max_length=8)
    dress_code: str = Field(default="", max_length=120)


class LeadDecisionIn(_Strict):
    decision: Literal["checking", "rejected", "duplicate"]
    reason: str = Field(default="", max_length=500)


class LeadPublishIn(_Strict):
    description: str = Field(min_length=20, max_length=4000)
    notes: str = Field(min_length=10, max_length=2000)
    destination: str | None = Field(default=None, max_length=80)
    place_type: str | None = Field(default=None, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    setting: Literal["indoor", "outdoor", "mixed"] | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=720)
    address: str | None = Field(default=None, max_length=300)


class LeadsImportIn(_Strict):
    leads: list[dict[str, Any]] = Field(min_length=1, max_length=5000)


class ClaimIn(_Strict):
    slug: str = Field(min_length=2, max_length=200)
    note: str = Field(min_length=10, max_length=1000)


class CheckedVenueIn(_Strict):
    listing_kind: str = Field(pattern="^(restaurant|hotel)$")
    name: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=20, max_length=4000)
    destination: str = Field(min_length=2, max_length=80)
    address: str = Field(default="", max_length=240)
    lat: float = Field(ge=33.0, le=34.8)
    lng: float = Field(ge=35.0, le=36.7)
    notes: str = Field(min_length=10, max_length=2000)
    cuisines: list[str] = Field(default_factory=list, max_length=8)
    price_level: int | None = Field(default=None, ge=1, le=4)
    reservation_phone: str = Field(default="", max_length=20)
    stay_type: str | None = Field(default=None, pattern="^(hotel|guesthouse|hostel|apartment)$")
    stars: int | None = Field(default=None, ge=1, le=5)
    price_from_minor: int | None = Field(default=None, gt=0)
    booking_url: str = Field(default="", max_length=500, pattern=_HTTPS)
    amenities: list[str] = Field(default_factory=list, max_length=20)


class VenueCheckIn(_Strict):
    level: str = Field(pattern="^(licensed_claimed|checked_by_mshwar)$")
    checked_on: date | None = None
    notes: str = Field(min_length=10, max_length=2000)


class ClaimDecisionIn(_Strict):
    decision: str = Field(pattern="^(approved|rejected)$")
    reason: str = Field(default="", max_length=500)
