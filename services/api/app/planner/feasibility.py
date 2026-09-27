"""Is this hand-built day actually doable?

The manual builder never silently drops a traveller's pick, so it needs a way to
say "these two places are three hours apart, not in one day". Everything here is
arithmetic over real coordinates, opening hours and routing legs — no model is
asked to judge whether a day is comfortable.

Three families of check:

* **Spread** — the straight-line-plus-road-factor distance between the two
  furthest picks. Saida and Tripoli sit ~135 road km apart, so a day holding
  both is reported as ``region_spread`` and is not feasible.
* **Pace** — how much of the window is spent driving, and whether any single
  transfer is long enough to ruin the day.
* **Hours** — whether each stop is reached while it is open, and how long the
  traveller would wait on the pavement if they arrive early.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field

from app.planner.eligibility import opening_hours_for
from app.planner.geo_math import road_distance_m
from app.planner.schemas import AssembledPlan, CandidateRecord, ExtractedConstraints

BEIRUT = ZoneInfo("Asia/Beirut")

#: Two picks further apart than this belong on different days.
SPREAD_LIMIT_M = 70_000
#: A single transfer longer than this is worth warning about even inside the limit.
LONG_TRANSFER_MINUTES = 75
#: Above this share of the day spent in the car the plan stops being a day out.
TRAVEL_SHARE_LIMIT = 0.45
#: Arriving more than this far before opening is dead time, not a pleasant wait.
LONG_WAIT_MINUTES = 45
#: Rough Lebanese mixed-road speed, for turning saved metres into saved minutes.
KMH = 40

BLOCKING = "blocking"
WARNING = "warning"
INFO = "info"


class DayIssue(BaseModel):
    """One reason a day is uncomfortable, in a shape the builder UI can render."""

    code: str
    severity: str
    positions: list[int] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    detail: dict[str, Any] = Field(default_factory=dict)


class StopTiming(BaseModel):
    """What the traveller would actually experience at one stop."""

    position: int
    slug: str
    title: str
    destination_slug: str
    destination_name: str = ""
    arrives_at: datetime
    leaves_at: datetime
    travel_minutes: int = 0
    travel_distance_m: int = 0
    travel_available: bool = True
    opens: str | None = None
    closes: str | None = None
    wait_minutes: int = 0
    flags: list[str] = Field(default_factory=list)


class FeasibilityReport(BaseModel):
    feasible: bool
    travel_minutes: int = 0
    travel_distance_m: int = 0
    day_minutes: int = 0
    travel_share: float = 0.0
    spread_m: int = 0
    destination_slugs: list[str] = Field(default_factory=list)
    issues: list[DayIssue] = Field(default_factory=list)
    suggested_order: list[str] = Field(default_factory=list)
    order_saves_minutes: int = 0
    #: The suggested order reaches more stops while they are open (less waiting,
    #: fewer closed doors), even when it drives the same or a little further.
    order_fixes_hours: bool = False


def _hhmm(value: Any) -> str | None:
    if value is None:
        return None
    return f"{value.hour:02d}:{value.minute:02d}"


def spread_metres(candidates: list[CandidateRecord]) -> tuple[int, tuple[str, str] | None]:
    """Road distance between the two furthest picks, and which pair they are."""
    worst = 0
    pair: tuple[str, str] | None = None
    for index, first in enumerate(candidates):
        for second in candidates[index + 1 :]:
            distance = road_distance_m(first.lat, first.lng, second.lat, second.lng)
            if distance > worst:
                worst = distance
                pair = (first.title, second.title)
    return worst, pair


#: Up to this many picks the order is solved exactly; above it, greedy plus 2-opt.
EXACT_ORDER_LIMIT = 8
#: Minutes of driving one hours conflict is worth: the solver drives up to this much
#: further rather than arrive at a closed door.
HOURS_PENALTY_MINUTES = 90


def _drive_minutes(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    return road_distance_m(a_lat, a_lng, b_lat, b_lng) / 1000 * 60 / KMH


def _visit(candidate: CandidateRecord, arrive: datetime) -> tuple[datetime, float]:
    """When the traveller leaves ``candidate`` after arriving at ``arrive``, and the
    penalty in minutes: waiting for it to open, plus a flat cost for a closed door
    or a visit that runs past closing."""
    opens, closes, closed = opening_hours_for(candidate, arrive)
    penalty = 0.0
    start = arrive
    if closed:
        penalty += HOURS_PENALTY_MINUTES
    elif opens is not None and closes is not None:
        local = arrive.astimezone(BEIRUT)
        opening = local.replace(hour=opens.hour, minute=opens.minute, second=0, microsecond=0)
        closing = local.replace(hour=closes.hour, minute=closes.minute, second=0, microsecond=0)
        if closing <= opening:
            # Open past midnight (a bowling alley closing at 01:00).
            closing += timedelta(days=1)
        if opening > local:
            wait = (opening - local).total_seconds() / 60
            penalty += wait
            start = arrive + (opening - local)
        if start + timedelta(minutes=candidate.duration_minutes) > closing:
            penalty += HOURS_PENALTY_MINUTES
    return start + timedelta(minutes=candidate.duration_minutes), penalty


def order_cost(
    candidates: list[CandidateRecord],
    start_lat: float | None,
    start_lng: float | None,
    window_start: datetime | None = None,
) -> tuple[float, float]:
    """(driving minutes, hours penalty minutes) for visiting ``candidates`` in this order."""
    drive = 0.0
    total = 0.0
    lat, lng = start_lat, start_lng
    clock = window_start
    for candidate in candidates:
        if lat is not None and lng is not None:
            drive += _drive_minutes(lat, lng, candidate.lat, candidate.lng)
        cost, clock = _step(lat, lng, candidate, clock)
        total += cost
        lat, lng = candidate.lat, candidate.lng
    return drive, total - drive


def _step(
    lat: float | None, lng: float | None, target: CandidateRecord, clock: datetime | None
) -> tuple[float, datetime | None]:
    """Cost of driving to ``target`` and visiting it, and the clock when it is left."""
    leg = _drive_minutes(lat, lng, target.lat, target.lng) if lat is not None and lng is not None else 0.0
    if clock is None:
        return leg, None
    leaves, penalty = _visit(target, clock + timedelta(minutes=leg))
    return leg + penalty, leaves


_State = tuple[float, datetime | None, int]


def _unwind(best: dict[tuple[int, int], _State], count: int) -> list[int]:
    full = (1 << count) - 1
    last = min(range(count), key=lambda item: (best[(full, item)][0], item))
    order: list[int] = []
    mask = full
    while last != -1:
        order.append(last)
        prev = best[(mask, last)][2]
        mask &= ~(1 << last)
        last = prev
    return order[::-1]


def _exact_order(
    candidates: list[CandidateRecord],
    start_lat: float | None,
    start_lng: float | None,
    window_start: datetime | None,
) -> list[int]:
    """Held-Karp over (visited set, last stop). Each state keeps its cheapest path and
    the clock at which that path leaves the last stop, so opening hours are judged on
    the real arrival time of the path being extended."""
    count = len(candidates)
    # best[(mask, last)] = (cost, clock leaving last, previous last)
    best: dict[tuple[int, int], _State] = {}
    for index, candidate in enumerate(candidates):
        cost, clock = _step(start_lat, start_lng, candidate, window_start)
        best[(1 << index, index)] = (cost, clock, -1)
    for mask in range(1, 1 << count):
        for last in range(count):
            state = best.get((mask, last))
            if state is None:
                continue
            here = candidates[last]
            for nxt in range(count):
                if mask & (1 << nxt):
                    continue
                cost, clock = _step(here.lat, here.lng, candidates[nxt], state[1])
                key = (mask | (1 << nxt), nxt)
                current = best.get(key)
                if current is None or state[0] + cost < current[0] - 1e-9:
                    best[key] = (state[0] + cost, clock, last)
    return _unwind(best, count)


def _greedy_order(
    candidates: list[CandidateRecord],
    start_lat: float | None,
    start_lng: float | None,
    window_start: datetime | None,
) -> list[CandidateRecord]:
    """Nearest-neighbour, then 2-opt until no reversal lowers the cost."""
    remaining = list(candidates)
    ordered: list[CandidateRecord] = []
    lat, lng = (
        (start_lat, start_lng)
        if start_lat is not None and start_lng is not None
        else (
            candidates[0].lat,
            candidates[0].lng,
        )
    )
    while remaining:
        nearest = min(remaining, key=lambda item: road_distance_m(lat, lng, item.lat, item.lng))
        remaining.remove(nearest)
        ordered.append(nearest)
        lat, lng = nearest.lat, nearest.lng

    def cost(order: list[CandidateRecord]) -> float:
        drive, penalty = order_cost(order, start_lat, start_lng, window_start)
        return drive + penalty

    current = cost(ordered)
    improved = True
    while improved:
        improved = False
        for i in range(len(ordered) - 1):
            for j in range(i + 1, len(ordered)):
                trial = ordered[:i] + ordered[i : j + 1][::-1] + ordered[j + 1 :]
                trial_cost = cost(trial)
                if trial_cost < current - 1e-9:
                    ordered, current, improved = trial, trial_cost, True
    return ordered


def suggest_order(
    candidates: list[CandidateRecord],
    start_lat: float | None,
    start_lng: float | None,
    window_start: datetime | None = None,
) -> list[CandidateRecord]:
    """The order with the least driving that also reaches each stop while it is open.

    Exact (Held-Karp) up to ``EXACT_ORDER_LIMIT`` picks, greedy plus 2-opt above it.
    Opening hours count only when ``window_start`` is known. Deterministic and free:
    straight-line road estimates, no provider calls. The traveller's order is kept
    unless the suggestion is strictly better, so ties never shuffle their day.
    """
    if len(candidates) < 2:
        return list(candidates)
    if len(candidates) <= EXACT_ORDER_LIMIT:
        suggested = [candidates[index] for index in _exact_order(candidates, start_lat, start_lng, window_start)]
    else:
        suggested = _greedy_order(candidates, start_lat, start_lng, window_start)
    mine = sum(order_cost(candidates, start_lat, start_lng, window_start))
    theirs = sum(order_cost(suggested, start_lat, start_lng, window_start))
    return suggested if theirs < mine - 0.5 else list(candidates)


def _driving_metres(candidates: list[CandidateRecord], start_lat: float | None, start_lng: float | None) -> int:
    if start_lat is None or start_lng is None:
        return 0
    total = 0
    lat, lng = start_lat, start_lng
    for candidate in candidates:
        total += road_distance_m(lat, lng, candidate.lat, candidate.lng)
        lat, lng = candidate.lat, candidate.lng
    return total


def stop_timings(candidates: list[CandidateRecord], plan: AssembledPlan) -> list[StopTiming]:
    """Pair each assembled stop with the leg that reached it and its opening hours."""
    timings: list[StopTiming] = []
    for index, (candidate, stop) in enumerate(zip(candidates, plan.stops, strict=False)):
        leg = plan.legs[index] if index < len(plan.legs) else None
        opens, closes, closed = opening_hours_for(candidate, stop.starts_at)
        wait = 0
        if opens is not None:
            local = stop.starts_at.astimezone(BEIRUT)
            opening = local.replace(hour=opens.hour, minute=opens.minute, second=0, microsecond=0)
            if opening > local:
                wait = int((opening - local).total_seconds() // 60)
        flags = list(stop.flags)
        if closed and "closed_that_day" not in flags:
            flags.append("closed_that_day")
        if wait >= LONG_WAIT_MINUTES and "long_wait" not in flags:
            flags.append("long_wait")
        timings.append(
            StopTiming(
                position=stop.position,
                slug=candidate.slug,
                title=candidate.title,
                destination_slug=candidate.destination_slug,
                destination_name=candidate.destination_name,
                arrives_at=stop.starts_at,
                leaves_at=stop.ends_at,
                travel_minutes=int((leg.duration_seconds if leg else 0) // 60),
                travel_distance_m=leg.distance_m if leg else 0,
                travel_available=bool(leg is None or leg.status == "available"),
                opens=_hhmm(opens),
                closes=_hhmm(closes),
                wait_minutes=wait,
                flags=flags,
            )
        )
    return timings


def _hours_issues(timings: list[StopTiming]) -> list[DayIssue]:
    issues: list[DayIssue] = []
    for code, severity in (
        ("closed_that_day", BLOCKING),
        ("after_hours", WARNING),
        ("long_wait", WARNING),
        ("hours_unknown", INFO),
    ):
        hit = [item for item in timings if code in item.flags]
        if hit:
            issues.append(
                DayIssue(
                    code=code,
                    severity=severity,
                    positions=[item.position for item in hit],
                    labels=[item.title for item in hit],
                    detail={"wait_minutes": max((item.wait_minutes for item in hit), default=0)},
                )
            )
    return issues


def _travel_issues(timings: list[StopTiming]) -> list[DayIssue]:
    issues: list[DayIssue] = []
    for item in timings:
        if not item.travel_available:
            issues.append(
                DayIssue(code="route_unavailable", severity=INFO, positions=[item.position], labels=[item.title])
            )
        elif item.travel_minutes > LONG_TRANSFER_MINUTES:
            issues.append(
                DayIssue(
                    code="long_transfer",
                    severity=WARNING,
                    positions=[item.position],
                    labels=[item.title],
                    detail={"minutes": item.travel_minutes, "distance_m": item.travel_distance_m},
                )
            )
    return issues


def assess(
    candidates: list[CandidateRecord],
    plan: AssembledPlan,
    constraints: ExtractedConstraints,
) -> tuple[FeasibilityReport, list[StopTiming]]:
    """Judge an assembled manual day. Never mutates the plan — the traveller decides."""
    timings = stop_timings(candidates, plan)
    issues: list[DayIssue] = []

    spread, pair = spread_metres(candidates)
    if spread > SPREAD_LIMIT_M:
        issues.append(
            DayIssue(
                code="region_spread",
                severity=BLOCKING,
                labels=list(pair or ()),
                detail={"distance_m": spread, "limit_m": SPREAD_LIMIT_M},
            )
        )

    issues.extend(_travel_issues(timings))

    travel_minutes = sum(item.travel_minutes for item in timings)
    travel_distance = sum(item.travel_distance_m for item in timings)
    day_minutes = 0
    if constraints.window_start and constraints.return_by:
        day_minutes = max(int((constraints.return_by - constraints.window_start).total_seconds() // 60), 0)
    share = (travel_minutes / day_minutes) if day_minutes else 0.0
    if day_minutes and share > TRAVEL_SHARE_LIMIT:
        issues.append(
            DayIssue(
                code="travel_heavy",
                severity=WARNING,
                detail={"travel_minutes": travel_minutes, "day_minutes": day_minutes, "share": round(share, 2)},
            )
        )

    if timings and constraints.return_by and timings[-1].leaves_at > constraints.return_by:
        over_by = int((timings[-1].leaves_at - constraints.return_by).total_seconds() // 60)
        issues.append(
            DayIssue(
                code="day_overflow",
                severity=BLOCKING,
                positions=[timings[-1].position],
                labels=[timings[-1].title],
                detail={"over_by_minutes": over_by},
            )
        )

    issues.extend(_hours_issues(timings))

    suggested = suggest_order(candidates, constraints.start_lat, constraints.start_lng, constraints.window_start)
    _drive_now, penalty_now = order_cost(
        candidates, constraints.start_lat, constraints.start_lng, constraints.window_start
    )
    _drive_new, penalty_new = order_cost(
        suggested, constraints.start_lat, constraints.start_lng, constraints.window_start
    )
    saved_m = _driving_metres(candidates, constraints.start_lat, constraints.start_lng) - _driving_metres(
        suggested, constraints.start_lat, constraints.start_lng
    )
    report = FeasibilityReport(
        feasible=not any(issue.severity == BLOCKING for issue in issues),
        travel_minutes=travel_minutes,
        travel_distance_m=travel_distance,
        day_minutes=day_minutes,
        travel_share=round(share, 3),
        spread_m=spread,
        destination_slugs=list(dict.fromkeys(item.destination_slug for item in timings)),
        issues=issues,
        suggested_order=[item.slug for item in suggested],
        order_saves_minutes=max(int(saved_m / 1000 * 60 / KMH), 0) if saved_m > 0 else 0,
        order_fixes_hours=penalty_new < penalty_now - 0.5,
    )
    return report, timings


def day_split(candidates: list[CandidateRecord]) -> list[list[CandidateRecord]]:
    """Split picks that are too far apart into clusters, each of which fits one day."""
    clusters: list[list[CandidateRecord]] = []
    for candidate in candidates:
        for cluster in clusters:
            if all(
                road_distance_m(candidate.lat, candidate.lng, member.lat, member.lng) <= SPREAD_LIMIT_M
                for member in cluster
            ):
                cluster.append(candidate)
                break
        else:
            clusters.append([candidate])
    return clusters


__all__ = [
    "DayIssue",
    "FeasibilityReport",
    "StopTiming",
    "assess",
    "day_split",
    "spread_metres",
    "stop_timings",
    "order_cost",
    "suggest_order",
]
