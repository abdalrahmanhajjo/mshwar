"""Assemble a whole day from the steps a traveller asked for (trip builder v2, phase 3).

Input: a ``DayScript`` (what to do, in which order) and, per step, the trusted
places that could fill it (``fill.gather_pools``). Output: a timed day in which
every step is either filled by a real place, served by a registered money
changer, or left as an honest empty slot with the reason - never silently
dropped and never invented.

How the day is put together:

* **The window.** A day with a dinner, an evening step or a night away runs
  late; a breakfast starts early; the traveller's own "we land at 10" or
  "back by 7" always wins.
* **Each step's time.** A meal is planned inside its meal hours, "evening" in
  the evening, "at 9" at nine. Waiting for a place to open is allowed; opening
  hours that run past midnight are understood.
* **Choosing places.** A small beam search walks the steps in order and keeps
  the best few partial days, scoring each by how well its places match, how
  much time is spent driving or waiting, and whether a step had to go outside
  the destination. Steps the traveller joined with "and" may be swapped.
* **The end.** A night away ends at the hotel. Otherwise the drive back to the
  start must fit before the day ends.

Totals are only summed here for the budget check; the stored total is summed
in Postgres, as for every plan.
"""

from __future__ import annotations

import itertools
from collections import Counter
from dataclasses import dataclass, field, replace
from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from app.core.config import settings
from app.planner.eligibility import opening_hours_for, travel_leg, unit_price_minor
from app.planner.routing import RouteLeg
from app.planner.schemas import (
    AssembledLeg,
    AssembledPlan,
    AssembledStop,
    DayScript,
    ExtractedConstraints,
    StepCandidate,
    StepSpec,
)

BEIRUT = ZoneInfo("Asia/Beirut")
BEAM_WIDTH = 6
CANDIDATES_PER_STEP = 8
MAX_ORDERINGS = 24
EXCHANGE_MINUTES = 15
#: Being later than the time the traveller gave is tolerated this long.
AT_TOLERANCE_MINUTES = 45
LONG_WAIT_MINUTES = 45
#: Opening hours past midnight belong to the evening before, up to this hour.
SERVICE_DAY_ROLLOVER = timedelta(hours=4)

_M = 60  # minutes per hour, for readable windows
#: Minutes after midnight of the plan's day. Values past 1440 are after midnight.
MEAL_WINDOWS: dict[str, tuple[int, int]] = {
    "breakfast": (7 * _M, 11 * _M),
    "brunch": (10 * _M, 13 * _M + 30),
    "lunch": (12 * _M, 15 * _M + 30),
    "dinner": (18 * _M + 30, 22 * _M + 30),
}
MOMENT_WINDOWS: dict[str, tuple[int, int]] = {
    "morning": (7 * _M, 12 * _M),
    "midday": (11 * _M + 30, 14 * _M + 30),
    "afternoon": (13 * _M, 18 * _M),
    "evening": (17 * _M + 30, 22 * _M + 30),
    "night": (20 * _M, 26 * _M),
}
EARLY_START = time(8, 0)
EARLIEST_DEPARTURE = time(5, 0)
LATE_END = time(23, 30)
#: The last activity of a night away may end this late; then the hotel.
OVERNIGHT_END = time(2, 0)


# ---- What comes out ----


class StepOutcome(BaseModel):
    """One step of the day as planned: filled, served by an office, skipped, or empty with a reason."""

    order: int
    role: str
    tags: list[str] = Field(default_factory=list)
    meal: str | None = None
    text: str = ""
    status: str  # filled | office | empty | skipped
    reason: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    travel_minutes: int | None = None
    distance_m: int | None = None
    wait_minutes: int = 0
    experience_id: UUID | None = None
    slug: str | None = None
    title: str | None = None
    destination_slug: str | None = None
    office: dict[str, Any] | None = None
    estimated_minor: int = 0
    price_kind: str | None = None
    trust: dict[str, Any] = Field(default_factory=dict)
    flags: list[str] = Field(default_factory=list)
    named_place: str | None = None


@dataclass(frozen=True)
class PoolEntry:
    """A place that could fill a step. ``outside`` = found near the day, not in the destination asked for."""

    candidate: StepCandidate
    outside: bool = False


@dataclass
class DayPools:
    places: dict[int, list[PoolEntry]] = field(default_factory=dict)
    offices: dict[int, list[dict[str, Any]]] = field(default_factory=dict)

    def candidates(self) -> list[StepCandidate]:
        seen: dict[UUID, StepCandidate] = {}
        for entries in self.places.values():
            for entry in entries:
                seen.setdefault(entry.candidate.id, entry.candidate)
        return list(seen.values())


@dataclass
class DayPlan:
    outcomes: list[StepOutcome]
    plan: AssembledPlan
    window_start: datetime
    return_by: datetime
    by_id: dict[UUID, StepCandidate]

    def outcomes_json(self) -> list[dict[str, Any]]:
        return [outcome.model_dump(mode="json") for outcome in self.outcomes]


# ---- The day's window ----


def _at(day: date, clock: time) -> datetime:
    return datetime.combine(day, clock, tzinfo=BEIRUT)


def _runs_past_midnight(script: DayScript) -> bool:
    return any(step.time_of_day == "night" or (step.at is not None and step.at.hour >= 22) for step in script.steps)


def _runs_late(script: DayScript) -> bool:
    return any(
        step.role == "stay" or step.meal == "dinner" or step.time_of_day in {"evening", "night"}
        for step in script.steps
    )


def day_window(script: DayScript, constraints: ExtractedConstraints) -> tuple[datetime, datetime, list[str]]:
    """When the day starts and must end, and what was assumed to get there."""
    assert constraints.window_start is not None and constraints.return_by is not None
    start = constraints.window_start.astimezone(BEIRUT)
    end = constraints.return_by.astimezone(BEIRUT)
    day = start.date()
    notes: list[str] = []
    if script.start_time is not None:
        start = _at(day, script.start_time)
    elif any(step.meal == "breakfast" for step in script.steps) and start.time() > EARLY_START:
        start = _at(day, EARLY_START)
        notes.append("starts_early_for_breakfast")
    if script.end_time is not None:
        end = _at(day, script.end_time)
    elif script.ends_overnight:
        end = _at(day + timedelta(days=1), OVERNIGHT_END)
        notes.append("ends_at_the_hotel")
    elif _runs_past_midnight(script) and end.date() == day:
        end = _at(day + timedelta(days=1), OVERNIGHT_END)
        notes.append("runs_into_the_night")
    elif _runs_late(script) and end.time() < LATE_END and end.date() == day:
        end = _at(day, LATE_END)
        notes.append("runs_into_the_evening")
    if end <= start:
        end = end + timedelta(days=1)
    return start, end, notes


# ---- Placing one step ----


@dataclass(frozen=True)
class _Point:
    lat: float
    lng: float


@dataclass(frozen=True)
class _Visit:
    step: StepSpec
    arrive: datetime
    leave: datetime
    travel_minutes: int
    distance_m: int
    route: RouteLeg | None
    wait_minutes: int
    point: _Point
    amount_minor: int = 0
    price_kind: str | None = None
    entry: PoolEntry | None = None
    office: dict[str, Any] | None = None
    flags: tuple[str, ...] = ()


@dataclass(frozen=True)
class _Gap:
    step: StepSpec
    status: str  # empty | skipped
    reason: str


@dataclass(frozen=True)
class _State:
    cursor: datetime
    point: _Point
    remaining_minor: int
    score: float
    items: tuple[_Visit | _Gap, ...]
    used: frozenset[UUID]


class _Travel:
    """Travel times for the whole assembly, fetched once per pair and hour."""

    def __init__(self) -> None:
        self._cache: dict[tuple[float, float, float, float, int], tuple[int, int, RouteLeg]] = {}

    def __call__(self, origin: _Point, target: _Point, departure: datetime) -> tuple[int, int, RouteLeg]:
        key = (
            round(origin.lat, 4),
            round(origin.lng, 4),
            round(target.lat, 4),
            round(target.lng, 4),
            departure.hour,
        )
        if key not in self._cache:
            self._cache[key] = travel_leg(origin.lat, origin.lng, target.lat, target.lng, departure_at=departure)
        return self._cache[key]


def _minutes_into(day_start: datetime, moment: datetime) -> int:
    midnight = datetime.combine(day_start.astimezone(BEIRUT).date(), time(0), tzinfo=BEIRUT)
    return int((moment - midnight).total_seconds() // 60)


def _from_minutes(day_start: datetime, minutes: int) -> datetime:
    midnight = datetime.combine(day_start.astimezone(BEIRUT).date(), time(0), tzinfo=BEIRUT)
    return midnight + timedelta(minutes=minutes)


def step_window(step: StepSpec) -> tuple[int, int] | None:
    """Earliest and latest arrival for a step, in minutes after the plan day's midnight."""
    if step.at is not None:
        at = step.at.hour * _M + step.at.minute
        if step.time_of_day == "night" and at < 5 * _M:
            at += 24 * _M
        return at, at + AT_TOLERANCE_MINUTES
    if step.role == "meal" and step.meal in MEAL_WINDOWS:
        return MEAL_WINDOWS[step.meal]
    if step.time_of_day in MOMENT_WINDOWS:
        return MOMENT_WINDOWS[step.time_of_day]
    return None


def _open_span(candidate: StepCandidate, arrive: datetime, day_start: datetime) -> tuple[int, int] | None | str:
    """Opening span in plan-day minutes; None if unknown; "closed" if closed that day."""
    service_day = (arrive.astimezone(BEIRUT) - SERVICE_DAY_ROLLOVER).date()
    opens, closes, closed = opening_hours_for(candidate, _at(service_day, time(12)))
    if closed:
        return "closed"
    if opens is None or closes is None:
        return None
    offset = (service_day - day_start.astimezone(BEIRUT).date()).days * 24 * _M
    open_m = offset + opens.hour * _M + opens.minute
    close_m = offset + closes.hour * _M + closes.minute
    if close_m <= open_m:  # runs past midnight
        close_m += 24 * _M
    return open_m, close_m


@dataclass(frozen=True)
class _Context:
    constraints: ExtractedConstraints
    day_start: datetime
    day_end: datetime
    home: _Point
    overnight: bool
    party: int
    strict_budget: bool
    travel: _Travel
    #: A first step with a time of its own may start the day this early.
    earliest_start: datetime


def _departure(ctx: _Context, state: _State, step: StepSpec, minutes: int) -> datetime:
    """When to set off. Mid-day: straight after the last stop. For the first step: just in time -
    nobody waits at the start of their own day - and, for a time the traveller gave ("breakfast
    at 9"), early enough to make it, though never before the earliest start."""
    window = step_window(step)
    if state.items or window is None:
        return state.cursor
    just_in_time = _from_minutes(ctx.day_start, window[0]) - timedelta(minutes=minutes)
    floor = ctx.earliest_start if step.at is not None else state.cursor
    return max(just_in_time, floor)


def _arrival(
    ctx: _Context, state: _State, step: StepSpec, target: _Point
) -> tuple[datetime, int, int, int, RouteLeg] | str:
    minutes, distance, route = ctx.travel(state.point, target, state.cursor)
    if not route.available:
        return "travel_unavailable"
    reach = _departure(ctx, state, step, minutes) + timedelta(minutes=minutes)
    arrive = reach
    window = step_window(step)
    if window is not None:
        earliest, latest = (_from_minutes(ctx.day_start, value) for value in window)
        if reach > latest:
            return "too_late_for_the_time_asked"
        arrive = max(reach, earliest)
    wait = int((arrive - reach).total_seconds() // 60)
    return arrive, wait, minutes, distance, route


def _fits_end(ctx: _Context, step: StepSpec, leave: datetime, point: _Point) -> bool:
    if step.role == "stay":
        return True
    if leave > ctx.day_end:
        return False
    if ctx.overnight:
        return True
    home_minutes, _distance, home_route = ctx.travel(point, ctx.home, leave)
    return home_route.available and leave + timedelta(minutes=home_minutes) <= ctx.day_end


def _within_hours(
    ctx: _Context, step: StepSpec, candidate: StepCandidate, arrive: datetime, stay_minutes: int
) -> tuple[datetime, int, bool] | str:
    """Arrival moved to opening time if early, the extra wait, and whether hours were known; or why not."""
    span = _open_span(candidate, arrive, ctx.day_start)
    if span == "closed":
        return "closed_that_day"
    if span is None:
        return arrive, 0, False
    assert not isinstance(span, str)
    open_m, close_m = span
    extra_wait = 0
    arrive_m = _minutes_into(ctx.day_start, arrive)
    if arrive_m < open_m:
        window = step_window(step)
        if window is not None and open_m > window[1]:
            return "opens_too_late"
        extra_wait = open_m - arrive_m
        arrive = _from_minutes(ctx.day_start, open_m)
    if _minutes_into(ctx.day_start, arrive) + stay_minutes > close_m:
        return "closes_too_early"
    return arrive, extra_wait, True


def _listing_flags(entry: PoolEntry, price_kind: str, wait: int, hours_known: bool) -> tuple[str, ...]:
    candidate = entry.candidate
    flags = {
        "hours_unknown": not hours_known,
        "quote_required": price_kind == "quote",
        "estimated_price": price_kind == "estimate",
        "check_times": candidate.needs_schedule,
        "meal_unconfirmed": candidate.meal_unconfirmed,
        "outside_destination": entry.outside,
        "long_wait": wait >= LONG_WAIT_MINUTES,
    }
    return tuple(name for name, on in flags.items() if on)


def _place_listing(ctx: _Context, state: _State, step: StepSpec, entry: PoolEntry) -> _Visit | str:
    candidate = entry.candidate
    if candidate.id in state.used:
        return "already_in_the_day"
    point = _Point(candidate.lat, candidate.lng)
    reached = _arrival(ctx, state, step, point)
    if isinstance(reached, str):
        return reached
    arrive, wait, minutes, distance, route = reached
    stay_minutes = 0 if step.role == "stay" else (step.duration_minutes or candidate.duration_minutes)
    hours_known = True
    if step.role != "stay":  # a stay is where the day ends: check-in is the stay's own business
        timed = _within_hours(ctx, step, candidate, arrive, stay_minutes)
        if isinstance(timed, str):
            return timed
        arrive, extra_wait, hours_known = timed
        wait += extra_wait
    leave = arrive + timedelta(minutes=stay_minutes)
    if not _fits_end(ctx, step, leave, point):
        return "does_not_fit_the_day"
    amount, price_kind = unit_price_minor(candidate, ctx.party)
    if ctx.strict_budget and amount > state.remaining_minor:
        return "over_the_budget"
    return _Visit(
        step=step,
        arrive=arrive,
        leave=leave,
        travel_minutes=minutes,
        distance_m=distance,
        route=route,
        wait_minutes=wait,
        point=point,
        amount_minor=amount,
        price_kind=price_kind,
        entry=entry,
        flags=_listing_flags(entry, price_kind, wait, hours_known),
    )


def _place_office(ctx: _Context, state: _State, step: StepSpec, office: dict[str, Any]) -> _Visit | str:
    try:
        point = _Point(float(office["lat"]), float(office["lng"]))
    except (KeyError, TypeError, ValueError):
        return "office_without_location"
    reached = _arrival(ctx, state, step, point)
    if isinstance(reached, str):
        return reached
    arrive, wait, minutes, distance, route = reached
    leave = arrive + timedelta(minutes=step.duration_minutes or EXCHANGE_MINUTES)
    if not _fits_end(ctx, step, leave, point):
        return "does_not_fit_the_day"
    # Office hours are free text today, so they are shown, not checked.
    return _Visit(
        step=step,
        arrive=arrive,
        leave=leave,
        travel_minutes=minutes,
        distance_m=distance,
        route=route,
        wait_minutes=wait,
        point=point,
        office=office,
        flags=("hours_unknown",),
    )


def _gain(visit: _Visit) -> float:
    """How good a filled step is: filling matters most, then match, then little driving or waiting."""
    gain = 1.0 - visit.travel_minutes / 100 - visit.wait_minutes / 300
    if visit.entry is not None:
        candidate = visit.entry.candidate
        gain += 0.5 * float(candidate.hybrid or 0)
        if visit.entry.outside:
            gain -= 0.3
        if candidate.meal_unconfirmed:
            gain -= 0.1
    return gain


def _advance(state: _State, visit: _Visit) -> _State:
    used = (state.used | {visit.entry.candidate.id}) if visit.entry else state.used
    return _State(
        cursor=visit.leave,
        point=visit.point,
        remaining_minor=state.remaining_minor - visit.amount_minor,
        score=state.score + _gain(visit),
        items=(*state.items, visit),
        used=used,
    )


def _gap_reason(pool_empty: bool, failures: list[str]) -> str:
    if pool_empty:
        return "no_trusted_match"
    return Counter(failures).most_common(1)[0][0] if failures else "does_not_fit_the_day"


def _expand(ctx: _Context, state: _State, step: StepSpec, pools: DayPools) -> list[_State]:
    visits: list[_Visit] = []
    failures: list[str] = []
    if step.role == "exchange":
        offices = pools.offices.get(step.order, [])
        options: list[Any] = offices
        for office in offices:
            placed = _place_office(ctx, state, step, office)
            if isinstance(placed, str):
                failures.append(placed)
            else:
                visits.append(placed)
    else:
        options = pools.places.get(step.order, [])[:CANDIDATES_PER_STEP]
        for entry in options:
            placed_listing = _place_listing(ctx, state, step, entry)
            if isinstance(placed_listing, str):
                failures.append(placed_listing)
            else:
                visits.append(placed_listing)
    visits.sort(key=lambda visit: -_gain(visit))
    grown = [_advance(state, visit) for visit in visits[:CANDIDATES_PER_STEP]]
    if not grown or step.optional:
        gap = _Gap(step=step, status="skipped" if step.optional else "empty", reason=_gap_reason(not options, failures))
        grown.append(replace(state, items=(*state.items, gap)))
    return grown


def _state_key(state: _State) -> tuple[float, str]:
    trail = "|".join(
        str(item.entry.candidate.id) if isinstance(item, _Visit) and item.entry else "-" for item in state.items
    )
    return (-state.score, trail)


def _beam(ctx: _Context, steps: list[StepSpec], pools: DayPools, start: _State) -> _State:
    states = [start]
    for step in steps:
        grown = [child for state in states for child in _expand(ctx, state, step, pools)]
        states = sorted(grown, key=_state_key)[:BEAM_WIDTH]
    return states[0]


def orderings(steps: list[StepSpec]) -> list[list[StepSpec]]:
    """The traveller's order, plus swaps inside each run of steps joined by "and"."""
    runs: list[list[StepSpec]] = []
    for step in steps:
        if runs and step.sequence == "flexible" and runs[-1][-1].sequence == "flexible":
            runs[-1].append(step)
        else:
            runs.append([step])
    choices = [list(itertools.permutations(run)) if len(run) > 1 else [tuple(run)] for run in runs]
    result: list[list[StepSpec]] = []
    for combination in itertools.product(*choices):
        result.append([step for run in combination for step in run])
        if len(result) >= MAX_ORDERINGS:
            break
    return result


# ---- The day ----


def _outcome(item: _Visit | _Gap) -> StepOutcome:
    step = item.step
    base: dict[str, Any] = {
        "order": step.order,
        "role": step.role,
        "tags": step.tags,
        "meal": step.meal,
        "text": step.text,
        "named_place": step.named_place,
    }
    if isinstance(item, _Gap):
        return StepOutcome(**base, status=item.status, reason=item.reason)
    common: dict[str, Any] = {
        "starts_at": item.arrive,
        "ends_at": item.leave,
        "travel_minutes": item.travel_minutes,
        "distance_m": item.distance_m,
        "wait_minutes": item.wait_minutes,
        "flags": list(item.flags),
    }
    if item.office is not None:
        destination = item.office.get("destination") or {}
        return StepOutcome(
            **base, **common, status="office", office=item.office, destination_slug=destination.get("slug")
        )
    assert item.entry is not None
    candidate = item.entry.candidate
    return StepOutcome(
        **base,
        **common,
        status="filled",
        experience_id=candidate.id,
        slug=candidate.slug,
        title=candidate.title,
        destination_slug=candidate.destination_slug,
        estimated_minor=item.amount_minor,
        price_kind=item.price_kind,
        trust=candidate.trust,
    )


def _snapshot(visit: _Visit, party: int) -> dict[str, Any]:
    assert visit.entry is not None
    candidate = visit.entry.candidate
    price = candidate.price or {}
    return {
        "experience_id": str(candidate.id),
        "slug": candidate.slug,
        "title": candidate.title,
        "destination_slug": candidate.destination_slug,
        "duration_minutes": candidate.duration_minutes,
        "price_type": price.get("type"),
        "price_source": price.get("source"),
        "currency": price.get("currency") or "USD",
        "unit": price.get("unit") or "person",
        "unit_amount_minor": price.get("amount_minor"),
        "party_size": party,
        "line_minor": visit.amount_minor,
        "price_kind": visit.price_kind,
        "sponsored": candidate.sponsored,
        "sponsored_label": candidate.sponsored_label if candidate.sponsored else None,
        "facts": candidate.facts,
        "trust": candidate.trust,
        "place_types": candidate.place_types,
        "schedule_note": candidate.schedule_note,
        "step": {"order": visit.step.order, "role": visit.step.role, "tags": visit.step.tags, "meal": visit.step.meal},
    }


def _assembled(best: _State, ctx: _Context) -> AssembledPlan:
    stops: list[AssembledStop] = []
    legs: list[AssembledLeg] = []
    for item in best.items:
        if not isinstance(item, _Visit) or item.entry is None:
            continue
        fetched = (item.route.fetched_at if item.route else None) or datetime.now(BEIRUT)
        legs.append(
            AssembledLeg(
                position=len(stops),
                provider=item.route.provider if item.route else "stub",
                fetched_at=fetched,
                expires_at=fetched + timedelta(seconds=max(settings.routing_cache_ttl_seconds, 60)),
                distance_m=item.distance_m,
                duration_seconds=item.travel_minutes * 60,
            )
        )
        stops.append(
            AssembledStop(
                experience_id=item.entry.candidate.id,
                position=len(stops) + 1,
                starts_at=item.arrive,
                ends_at=item.leave if item.leave > item.arrive else item.arrive + timedelta(minutes=1),
                estimated_minor=item.amount_minor,
                price_kind=item.price_kind or "estimate",
                snapshot=_snapshot(item, ctx.party),
                flags=list(item.flags),
            )
        )
    total = sum(stop.estimated_minor for stop in stops)
    budget = ctx.constraints.budget_minor or 0
    needs_approval = bool(ctx.strict_budget and total > budget)
    return AssembledPlan(
        stops=stops,
        legs=legs,
        total_minor=total,
        currency=ctx.constraints.currency,
        budget_warning=(
            "This draft exceeds the strict budget. Approve the overage to continue, or tighten the plan."
            if needs_approval
            else None
        ),
        needs_budget_approval=needs_approval,
        infeasible=not stops,
        infeasible_reason=None if stops else "no_step_could_be_filled",
    )


def _first_stop_point(script: DayScript, pools: DayPools) -> _Point | None:
    """Where the first step will most likely be: a driver picks the traveller up there."""
    for step in script.steps:
        offices = pools.offices.get(step.order) or []
        for office in offices:
            try:
                return _Point(float(office["lat"]), float(office["lng"]))
            except (KeyError, TypeError, ValueError):
                continue
        entries = pools.places.get(step.order) or []
        if entries:
            return _Point(entries[0].candidate.lat, entries[0].candidate.lng)
    return None


def assemble_day(
    script: DayScript,
    constraints: ExtractedConstraints,
    pools: DayPools,
    *,
    start_at_first_stop: bool = False,
) -> DayPlan:
    """The best day the trusted places allow, in the traveller's order (swapping only "and" steps).

    ``start_at_first_stop``: the start point was only assumed and a driver picks the traveller up,
    so the day starts where its first step is rather than with a drive from the assumed start.
    """
    if constraints.start_lat is None or constraints.start_lng is None:
        raise ValueError("the day needs a start point")
    start, end, _notes = day_window(script, constraints)
    home = _Point(constraints.start_lat, constraints.start_lng)
    if start_at_first_stop:
        home = _first_stop_point(script, pools) or home
    ctx = _Context(
        constraints=constraints,
        day_start=start,
        day_end=end,
        home=home,
        overnight=script.ends_overnight,
        party=constraints.party_size or 2,
        strict_budget=bool(constraints.strict_budget),
        travel=_Travel(),
        earliest_start=min(start, _at(start.date(), EARLIEST_DEPARTURE)),
    )
    origin = _State(
        cursor=start,
        point=home,
        remaining_minor=constraints.budget_minor or 0,
        score=0.0,
        items=(),
        used=frozenset(),
    )
    finals = [_beam(ctx, ordering, pools, origin) for ordering in orderings(script.steps)]
    best = sorted(finals, key=_state_key)[0]
    first = next((item for item in best.items if isinstance(item, _Visit)), None)
    set_off = first.arrive - timedelta(minutes=first.travel_minutes + first.wait_minutes) if first else start
    return DayPlan(
        outcomes=[_outcome(item) for item in best.items],
        plan=_assembled(best, ctx),
        window_start=min(start, set_off) if first and first.step.at is not None else max(start, set_off),
        return_by=end,
        by_id={candidate.id: candidate for candidate in pools.candidates()},
    )


__all__ = [
    "DayPlan",
    "DayPools",
    "PoolEntry",
    "StepOutcome",
    "assemble_day",
    "day_window",
    "orderings",
    "step_window",
]
