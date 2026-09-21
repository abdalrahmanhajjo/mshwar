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

from datetime import datetime
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


def suggest_order(
    candidates: list[CandidateRecord], start_lat: float | None, start_lng: float | None
) -> list[CandidateRecord]:
    """Nearest-neighbour from the start point. Cheap, deterministic, no provider calls."""
    if start_lat is None or start_lng is None or len(candidates) < 3:
        return list(candidates)
    remaining = list(candidates)
    ordered: list[CandidateRecord] = []
    lat, lng = start_lat, start_lng
    while remaining:
        nearest = min(remaining, key=lambda item: road_distance_m(lat, lng, item.lat, item.lng))
        remaining.remove(nearest)
        ordered.append(nearest)
        lat, lng = nearest.lat, nearest.lng
    return ordered


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

    suggested = suggest_order(candidates, constraints.start_lat, constraints.start_lng)
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
    "suggest_order",
]
