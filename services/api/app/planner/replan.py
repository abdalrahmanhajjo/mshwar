from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime

from app.planner.optimizer import OptimizeResult, OptimizeStop, optimize_route
from app.planner.routing import RoutingService


@dataclass
class ReplanDiff:
    removed: list[str]
    added: list[str]
    unchanged: list[str]
    time_delta_seconds: int | None
    cost_delta_minor: int


@dataclass
class ReplanResult:
    feasible: bool
    applied: bool
    message: str
    before: OptimizeResult | None
    after: OptimizeResult | None
    diff: ReplanDiff | None
    bookings_mutated: bool
    booking_statuses: dict[str, str]


def _ids(result: OptimizeResult) -> list[str]:
    return [stop.id for stop in result.ordered]


def replan_affected(
    start_lat: float,
    start_lng: float,
    stops: list[OptimizeStop],
    affected_ids: list[str],
    candidates: list[OptimizeStop],
    window_start: datetime,
    return_by: datetime,
    mode: str = "driving",
    plan_id: str = "anon",
    timeout_ms: int = 2000,
    routing: RoutingService | None = None,
    booking_statuses: dict[str, str] | None = None,
) -> ReplanResult:
    """Rebuild only weather-affected stops. Bookings are never mutated."""
    original_status = dict(booking_statuses or {})
    snapshot = dict(original_status)
    service = routing or RoutingService()
    before = optimize_route(
        start_lat,
        start_lng,
        stops,
        window_start,
        return_by,
        mode=mode,
        plan_id=plan_id,
        timeout_ms=timeout_ms,
        routing=service,
    )
    affected = set(affected_ids)
    if not affected:
        return ReplanResult(
            feasible=True,
            applied=False,
            message="No weather-affected stops to rebuild.",
            before=before,
            after=None,
            diff=None,
            bookings_mutated=snapshot != original_status,
            booking_statuses=snapshot,
        )

    kept: list[OptimizeStop] = []
    for index, stop in enumerate(stops, start=1):
        if stop.id in affected and not stop.locked:
            continue
        copy = replace(stop)
        if stop.id not in affected:
            copy.locked = True
            copy.position = copy.position or index
        kept.append(copy)

    replacements = [replace(item) for item in candidates if item.id not in {stop.id for stop in kept}]
    locked_affected = [stop for stop in kept if stop.locked and stop.id in affected]
    pool = kept + replacements
    # Deduplicate by id, preserving first (locked/unaffected win).
    seen: set[str] = set()
    rebuilt: list[OptimizeStop] = []
    for stop in pool:
        if stop.id in seen:
            continue
        seen.add(stop.id)
        rebuilt.append(stop)

    if not replacements and locked_affected:
        return ReplanResult(
            feasible=False,
            applied=False,
            message="No feasible alternative keeps locked stops and return-by. The current plan was left unchanged.",
            before=before,
            after=None,
            diff=None,
            bookings_mutated=snapshot != original_status,
            booking_statuses=snapshot,
        )

    after = optimize_route(
        start_lat,
        start_lng,
        rebuilt,
        window_start,
        return_by,
        mode=mode,
        plan_id=plan_id,
        timeout_ms=timeout_ms,
        routing=service,
    )
    if not after.feasible:
        return ReplanResult(
            feasible=False,
            applied=False,
            message=after.reason
            or "No feasible alternative keeps locked stops and return-by. The current plan was left unchanged.",
            before=before,
            after=None,
            diff=None,
            bookings_mutated=snapshot != original_status,
            booking_statuses=snapshot,
        )

    before_ids = _ids(before) if before.feasible else [stop.id for stop in stops]
    after_ids = _ids(after)
    removed = [item for item in before_ids if item not in after_ids]
    added = [item for item in after_ids if item not in before_ids]
    unchanged = [item for item in after_ids if item in before_ids]
    time_delta = None
    if (
        before.metrics_available
        and after.metrics_available
        and before.total_duration_seconds is not None
        and after.total_duration_seconds is not None
    ):
        time_delta = after.total_duration_seconds - before.total_duration_seconds
    cost_delta = sum(stop.estimated_minor for stop in after.ordered) - sum(
        stop.estimated_minor for stop in (before.ordered if before.feasible else [])
    )
    return ReplanResult(
        feasible=True,
        applied=True,
        message="Weather-affected segment rebuilt. Locked and unaffected stops kept their place.",
        before=before,
        after=after,
        diff=ReplanDiff(
            removed=removed,
            added=added,
            unchanged=unchanged,
            time_delta_seconds=time_delta,
            cost_delta_minor=cost_delta,
        ),
        bookings_mutated=snapshot != original_status,
        booking_statuses=snapshot,
    )
