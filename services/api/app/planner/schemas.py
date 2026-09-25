from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

LOCALES = frozenset({"ar", "ar-LB", "en", "fr", "mixed"})
INTENSITY = frozenset({"relaxed", "moderate", "active", "strenuous"})
PRICE_KINDS = frozenset({"fixed", "estimate", "quote"})
FORBIDDEN_LLM_KEYS = frozenset(
    {
        "total",
        "total_minor",
        "price",
        "amount",
        "book",
        "booking",
        "payment",
        "pay",
        "charge",
        "stop_ids",
        "experience_ids",
        "places",
    }
)


class ExtractedConstraints(BaseModel):
    """LLM-facing intent object. Extra keys are rejected (injection / hallucination)."""

    model_config = ConfigDict(extra="forbid")

    locale: str = "en"
    destination_slugs: list[str] = Field(default_factory=list)
    category_slugs: list[str] = Field(default_factory=list)
    kind_slugs: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    intensity: str | None = None
    party_size: int | None = Field(default=None, ge=1, le=20)
    window_start: datetime | None = None
    return_by: datetime | None = None
    start_lat: float | None = None
    start_lng: float | None = None
    budget_minor: int | None = Field(default=None, ge=0)
    currency: str = "USD"
    strict_budget: bool | None = None
    max_travel_minutes: int | None = Field(default=None, ge=15, le=720)
    dietary: list[str] = Field(default_factory=list)
    accessibility: list[str] = Field(default_factory=list)
    query: str = ""

    @field_validator("locale")
    @classmethod
    def locale_supported(cls, value: str) -> str:
        if value not in LOCALES:
            return "mixed"
        return value

    @field_validator("intensity")
    @classmethod
    def intensity_controlled(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in INTENSITY:
            raise ValueError("invalid intensity")
        return value

    @field_validator("currency")
    @classmethod
    def currency_iso(cls, value: str) -> str:
        code = (value or "USD").strip().upper()
        if len(code) != 3 or not code.isalpha():
            return "USD"
        return code


STEP_ROLES = frozenset({"exchange", "meal", "sight", "activity", "stay", "service"})
MEALS = frozenset({"breakfast", "brunch", "lunch", "dinner", "snack"})
TIMES_OF_DAY = frozenset({"morning", "midday", "afternoon", "evening", "night"})
TRANSPORT_MODES = frozenset({"own", "driver", "public", "walk"})
SEQUENCES = frozenset({"fixed", "flexible"})
MAX_SCRIPT_STEPS = 12


def _controlled(value: str | None, allowed: frozenset[str], label: str) -> str | None:
    if value is None or value == "":
        return None
    if value not in allowed:
        raise ValueError(f"invalid {label}")
    return value


class StepSpec(BaseModel):
    """One thing the traveller asked to do, in the order they asked for it.

    A step names a *kind* of place (role + tags), never a business: the planner
    fills it from trusted catalogue rows later. ``named_place`` keeps a name the
    traveller wrote so it can be looked up - it is never trusted on its own.
    """

    model_config = ConfigDict(extra="forbid")

    order: int = Field(ge=1, le=MAX_SCRIPT_STEPS)
    role: str
    tags: list[str] = Field(default_factory=list, max_length=8)
    meal: str | None = None
    named_place: str | None = Field(default=None, max_length=120)
    destination_slug: str | None = Field(default=None, max_length=80)
    at: time | None = None
    time_of_day: str | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=720)
    sequence: str = "fixed"
    optional: bool = False
    text: str = Field(default="", max_length=300)

    @field_validator("role")
    @classmethod
    def role_controlled(cls, value: str) -> str:
        if value not in STEP_ROLES:
            raise ValueError("invalid step role")
        return value

    @field_validator("tags")
    @classmethod
    def tags_known(cls, value: list[str]) -> list[str]:
        # Unknown tags are dropped, not guessed: a tag only narrows a search.
        from app.planner.script.vocabulary import STEP_TAGS

        seen: list[str] = []
        for tag in value:
            if tag in STEP_TAGS and tag not in seen:
                seen.append(tag)
        return seen

    @field_validator("meal")
    @classmethod
    def meal_controlled(cls, value: str | None) -> str | None:
        return _controlled(value, MEALS, "meal")

    @field_validator("time_of_day")
    @classmethod
    def time_of_day_controlled(cls, value: str | None) -> str | None:
        return _controlled(value, TIMES_OF_DAY, "time of day")

    @field_validator("sequence")
    @classmethod
    def sequence_controlled(cls, value: str) -> str:
        if value not in SEQUENCES:
            raise ValueError("invalid sequence")
        return value


class DayScript(BaseModel):
    """A whole day as the traveller described it: day-wide constraints plus ordered steps.

    LLM-facing like ``ExtractedConstraints``: extra keys are rejected, so a model
    cannot smuggle in an id, a price or a booking.
    """

    model_config = ConfigDict(extra="forbid")

    constraints: ExtractedConstraints = Field(default_factory=ExtractedConstraints)
    steps: list[StepSpec] = Field(default_factory=list, max_length=MAX_SCRIPT_STEPS)
    transport: str | None = None
    pickup_requested: bool = False
    pickup_place: str | None = Field(default=None, max_length=120)
    start_time: time | None = None
    end_time: time | None = None
    return_destination: str | None = Field(default=None, max_length=80)
    ends_overnight: bool = False
    avoid_tags: list[str] = Field(default_factory=list, max_length=16)
    unparsed: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("transport")
    @classmethod
    def transport_controlled(cls, value: str | None) -> str | None:
        return _controlled(value, TRANSPORT_MODES, "transport")

    @field_validator("avoid_tags")
    @classmethod
    def avoid_tags_known(cls, value: list[str]) -> list[str]:
        from app.planner.script.vocabulary import STEP_TAGS

        return [tag for tag in dict.fromkeys(value) if tag in STEP_TAGS]

    @model_validator(mode="after")
    def normalise_steps(self) -> DayScript:
        """Order is 1..n with no gaps, and a stay is where the day ends."""
        stays = [step for step in self.steps if step.role == "stay"]
        others = sorted((step for step in self.steps if step.role != "stay"), key=lambda step: step.order)
        ordered = others + stays[-1:]
        for position, step in enumerate(ordered, start=1):
            step.order = position
        self.steps = ordered
        if stays:
            self.ends_overnight = True
        return self


class ClarificationQuestion(BaseModel):
    field: str
    prompt: str
    required: bool = True
    #: Concepts the traveller can tap to answer ("bowling"), best first. Never applied without a tap.
    options: list[str] = Field(default_factory=list, max_length=3)


class AssumedDefault(BaseModel):
    field: str
    value: Any
    label: str


class RefinementIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    understood: bool
    summary: str = ""
    clarification: str | None = None
    prefer_less_driving: bool | None = None
    intensity: str | None = None
    interests_add: list[str] = Field(default_factory=list)
    interests_remove: list[str] = Field(default_factory=list)
    destination_slugs: list[str] = Field(default_factory=list)
    category_slugs: list[str] = Field(default_factory=list)
    budget_minor: int | None = Field(default=None, ge=0)
    strict_budget: bool | None = None
    party_size: int | None = Field(default=None, ge=1, le=20)
    max_travel_minutes: int | None = Field(default=None, ge=15, le=720)

    @field_validator("intensity")
    @classmethod
    def intensity_controlled(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if value not in INTENSITY:
            raise ValueError("invalid intensity")
        return value


class StopExplanationDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    experience_id: UUID
    text: str
    source_facts: list[str] = Field(default_factory=list)


class CandidateRecord(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str = ""
    status: str
    duration_minutes: int
    min_party: int = 1
    max_party: int = 8
    setting: str | None = None
    intensity: int | None = None
    listing_kind: str | None = None
    inventory_available: bool | None = None
    destination_slug: str
    destination_name: str = ""
    venue_id: UUID
    venue_name: str = ""
    lat: float
    lng: float
    fts: float = 0
    vec: float = 0
    hybrid: float = 0
    sponsored: bool = False
    sponsored_label: str | None = None
    category_slugs: list[str] = Field(default_factory=list)
    interest_slugs: list[str] = Field(default_factory=list)
    price: dict[str, Any] = Field(default_factory=dict)
    hours: list[dict[str, Any]] = Field(default_factory=list)
    exceptions: list[dict[str, Any]] = Field(default_factory=list)
    facts: list[Any] = Field(default_factory=list)


class StepCandidate(CandidateRecord):
    """A listing that can fill one step of a day (``app.planner_retrieve_step``, migration 045)."""

    place_types: list[str] = Field(default_factory=list)
    meal_services: list[str] = Field(default_factory=list)
    #: The meal was asked for but the place has not said which meals it serves.
    meal_unconfirmed: bool = False
    schedule_note: str = ""
    #: Times vary (films, concerts): the plan must say "check times", never show one.
    needs_schedule: bool = False
    distance_m: int | None = None
    trust: dict[str, Any] = Field(default_factory=dict)
    #: The listing's own details: typical spend, price per night, how to reserve or book (046).
    details: dict[str, Any] = Field(default_factory=dict)
    #: Checked facts (halal, wheelchair access, views, ...) in date; unknown ones absent (049).
    place_facts: dict[str, Any] = Field(default_factory=dict)
    #: Needs the traveller has that this place has not confirmed either way.
    unconfirmed_needs: list[str] = Field(default_factory=list)


class EligibilityResult(BaseModel):
    candidate: CandidateRecord
    eligible: bool
    blocked: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)


class RankedCandidate(BaseModel):
    candidate: CandidateRecord
    score: float
    eligible: bool
    sponsored: bool
    reasons: list[str] = Field(default_factory=list)
    flags: list[str] = Field(default_factory=list)


class AssembledStop(BaseModel):
    experience_id: UUID
    position: int
    starts_at: datetime
    ends_at: datetime
    estimated_minor: int
    price_kind: str
    locked: bool = False
    snapshot: dict[str, Any] = Field(default_factory=dict)
    flags: list[str] = Field(default_factory=list)
    explanation: str = ""


class AssembledLeg(BaseModel):
    position: int
    provider: str
    fetched_at: datetime
    expires_at: datetime
    distance_m: int
    duration_seconds: int
    estimated_minor: int = 0
    status: str = "available"


class CostItem(BaseModel):
    kind: str
    label: str
    amount_minor: int
    price_label: str = "fixed"


class AssembledPlan(BaseModel):
    stops: list[AssembledStop]
    legs: list[AssembledLeg]
    cost_items: list[CostItem] = Field(default_factory=list)
    total_minor: int
    currency: str = "USD"
    forced_lock_changes: list[str] = Field(default_factory=list)
    budget_warning: str | None = None
    needs_budget_approval: bool = False
    infeasible: bool = False
    infeasible_reason: str | None = None


class IntentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    locale: str = "en"
    session_id: UUID | None = None
    trip_id: UUID | None = None
    answers: dict[str, Any] = Field(default_factory=dict)
    approve_budget: bool = False
    fault_inject: str | None = None


class ManualPlanRequest(BaseModel):
    """Hand-picked itinerary: ordered published places plus basic day settings."""

    experience_slugs: list[str] = Field(min_length=1, max_length=12)
    destination_slugs: list[str] = Field(default_factory=list, max_length=8)
    party_size: int | None = Field(default=None, ge=1, le=20)
    window_start: datetime | None = None
    budget_minor: int | None = Field(default=None, ge=0)
    strict_budget: bool | None = None
    currency: str = "USD"
    start_lat: float | None = None
    start_lng: float | None = None
    title: str | None = Field(default=None, max_length=120)
    trip_id: UUID | None = None
    locale: str = "en"
    #: The traveller saw the comfort warnings and chose to save the day anyway.
    accept_warnings: bool = False


class ManualPreviewRequest(BaseModel):
    """Same picks as a manual save, costed and checked but never written."""

    experience_slugs: list[str] = Field(min_length=1, max_length=12)
    destination_slugs: list[str] = Field(default_factory=list, max_length=8)
    party_size: int | None = Field(default=None, ge=1, le=20)
    window_start: datetime | None = None
    budget_minor: int | None = Field(default=None, ge=0)
    strict_budget: bool | None = None
    currency: str = "USD"
    start_lat: float | None = None
    start_lng: float | None = None
    locale: str = "en"


class DayDriverRequest(BaseModel):
    """Send the planned day to verified drivers (trip builder v2, phase 4). Nothing else is booked."""

    model_config = ConfigDict(extra="forbid")

    pickup_name: str = Field(min_length=3, max_length=160)
    pickup_lat: float | None = Field(default=None, ge=33.0, le=34.8)
    pickup_lng: float | None = Field(default=None, ge=35.0, le=36.7)
    luggage: int = Field(default=0, ge=0, le=20)
    notes: str = Field(default="", max_length=300)
    #: Which day of a trip the driver is for (1 for a single day).
    day: int = Field(default=1, ge=1, le=7)


class ChooseStepRequest(BaseModel):
    """Pick one of a step's trusted alternatives; the rest of the day keeps its places."""

    model_config = ConfigDict(extra="forbid")

    experience_id: UUID


class IntentPhraseIn(BaseModel):
    """A phrase staff approve for one of the planner's concepts (migration 048)."""

    model_config = ConfigDict(extra="forbid")

    phrase: str = Field(min_length=1, max_length=80)
    concept: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    locale: str = Field(default="mixed", pattern="^(en|ar|ar-LB|arabizi|fr|mixed)$")


class MissDecisionIn(BaseModel):
    """Turn something the planner could not read into a phrase, or dismiss it."""

    model_config = ConfigDict(extra="forbid")

    decision: str = Field(pattern="^(phrase|dismiss)$")
    phrase: str | None = Field(default=None, max_length=80)
    concept: str | None = Field(default=None, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    locale: str | None = Field(default=None, pattern="^(en|ar|ar-LB|arabizi|fr|mixed)$")


class CandidateReviewIn(BaseModel):
    """Approve or reject candidate phrases in one go (migration 050)."""

    model_config = ConfigDict(extra="forbid")

    ids: list[UUID] = Field(min_length=1, max_length=1000)
    decision: Literal["approve", "reject"]


class ReleaseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: str = Field(default="", max_length=500)


class UnderstandRequest(BaseModel):
    """Read a request into steps for the "here is what I understood" chips. Never plans or stores."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=4000)
    locale: str = "en"


class SourcedPriceIn(BaseModel):
    """A price a place or an authority published, recorded by staff with its proof (migration 047)."""

    model_config = ConfigDict(extra="forbid")

    price_type: str = Field(pattern="^(fixed|from|range)$")
    amount_minor: int = Field(ge=0, le=100_000_000)
    max_amount_minor: int | None = Field(default=None, ge=0, le=100_000_000)
    currency: str = Field(default="USD", pattern="^[A-Z]{3}$")
    unit: str = Field(default="person", pattern="^(person|group)$")
    source_url: str = Field(min_length=10, max_length=500, pattern=r"^https://[^/\s]+")
    source_name: str = Field(min_length=2, max_length=120)
    checked_on: date
    review_by: date | None = None
    note: str = Field(default="", max_length=500)


class LockRequest(BaseModel):
    stop_id: UUID
    locked: bool = True


class RegenerateRequest(BaseModel):
    fault_inject: str | None = None


class ReplacePreviewRequest(BaseModel):
    stop_id: UUID
    experience_id: UUID


class ReplaceAcceptRequest(BaseModel):
    preview_id: str


class RefineRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    apply: bool = False


class LinkBookingRequest(BaseModel):
    booking_id: UUID


class RankerWeightsIn(BaseModel):
    version: str = Field(min_length=1, max_length=40)
    weights: dict[str, float]
    notes: str = ""
