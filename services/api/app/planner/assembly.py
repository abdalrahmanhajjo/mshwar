from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from app.core.config import settings
from app.planner.eligibility import hours_allow, travel_leg, unit_price_minor
from app.planner.schemas import (
    AssembledLeg,
    AssembledPlan,
    AssembledStop,
    CandidateRecord,
    ExtractedConstraints,
    RankedCandidate,
)

MAX_STOPS = 4


def _price_snapshot(candidate: CandidateRecord, party_size: int) -> dict[str, object]:
    amount, kind = unit_price_minor(candidate, party_size)
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
        "party_size": party_size,
        "line_minor": amount,
        "price_kind": kind,
        "sponsored": candidate.sponsored,
        "sponsored_label": candidate.sponsored_label if candidate.sponsored else None,
        "facts": candidate.facts,
    }


def assemble_plan(
    ranked: list[RankedCandidate],
    constraints: ExtractedConstraints,
    *,
    locked_ids: set[UUID] | None = None,
    exclude_ids: set[UUID] | None = None,
    max_stops: int = MAX_STOPS,
) -> AssembledPlan:
    locked_ids = locked_ids or set()
    exclude_ids = exclude_ids or set()
    start = constraints.window_start
    end = constraints.return_by
    if start is None or end is None or constraints.start_lat is None or constraints.start_lng is None:
        return AssembledPlan(stops=[], legs=[], total_minor=0, infeasible=True, infeasible_reason="missing_window")
    party = constraints.party_size or 2
    budget = constraints.budget_minor or 0
    cursor = start
    lat = constraints.start_lat
    lng = constraints.start_lng
    used: set[UUID] = set()
    stops: list[AssembledStop] = []
    legs: list[AssembledLeg] = []
    remaining = budget
    forced: list[str] = []

    locked_ranked = [row for row in ranked if row.candidate.id in locked_ids]
    unlocked = [row for row in ranked if row.candidate.id not in locked_ids and row.candidate.id not in exclude_ids]
    sequence = locked_ranked + unlocked

    for row in sequence:
        if len(stops) >= max_stops:
            break
        candidate = row.candidate
        if candidate.id in used:
            continue
        minutes, distance, route = travel_leg(lat, lng, candidate.lat, candidate.lng, departure_at=cursor)
        if not route.available:
            if candidate.id in locked_ids:
                forced.append(f"{candidate.slug} could not stay locked — travel time is unavailable.")
            continue
        arrive = cursor + timedelta(minutes=minutes)
        leave = arrive + timedelta(minutes=candidate.duration_minutes)
        if leave > end:
            if candidate.id in locked_ids:
                forced.append(f"{candidate.slug} could not stay locked — it no longer fits the remaining window.")
            continue
        ok_hours, hours_code = hours_allow(candidate, arrive, leave)
        if not ok_hours:
            if candidate.id in locked_ids:
                forced.append(f"{candidate.slug} could not stay locked — {hours_code.replace('_', ' ')}.")
            continue
        amount, kind = unit_price_minor(candidate, party)
        if constraints.strict_budget and amount > remaining:
            if candidate.id in locked_ids:
                forced.append(f"{candidate.slug} could not stay locked — it would break the strict budget.")
            continue
        fetched = route.fetched_at or datetime.now(start.tzinfo)
        legs.append(
            AssembledLeg(
                position=len(stops),
                provider=route.provider,
                fetched_at=fetched,
                expires_at=fetched + timedelta(seconds=max(settings.routing_cache_ttl_seconds, 60)),
                distance_m=distance,
                duration_seconds=minutes * 60,
                estimated_minor=0,
                status="available" if route.available else "unavailable",
            )
        )
        flags = list(row.flags)
        if hours_code == "hours_unknown":
            flags.append("hours_unknown")
        if kind == "quote":
            flags.append("quote_required")
        elif kind == "estimate":
            flags.append("estimated_price")
        snapshot = _price_snapshot(candidate, party)
        stops.append(
            AssembledStop(
                experience_id=candidate.id,
                position=len(stops) + 1,
                starts_at=arrive,
                ends_at=leave,
                estimated_minor=amount,
                price_kind=kind,
                locked=candidate.id in locked_ids,
                snapshot=snapshot,
                flags=flags,
            )
        )
        used.add(candidate.id)
        remaining -= amount
        cursor = leave
        lat = candidate.lat
        lng = candidate.lng

    total = sum(stop.estimated_minor for stop in stops) + sum(leg.estimated_minor for leg in legs)
    warning = None
    needs_approval = False
    if constraints.strict_budget and total > budget:
        warning = "This draft exceeds the strict budget. Approve the overage to continue, or tighten the plan."
        needs_approval = True
    if not stops:
        return AssembledPlan(
            stops=[],
            legs=[],
            total_minor=0,
            infeasible=True,
            infeasible_reason="no_eligible_stops",
            forced_lock_changes=forced,
            budget_warning=warning,
            needs_budget_approval=needs_approval,
        )
    return AssembledPlan(
        stops=stops,
        legs=legs,
        total_minor=total,
        currency=constraints.currency,
        forced_lock_changes=forced,
        budget_warning=warning,
        needs_budget_approval=needs_approval,
    )


def plan_total_minor(plan: AssembledPlan) -> int:
    return (
        sum(stop.estimated_minor for stop in plan.stops)
        + sum(leg.estimated_minor for leg in plan.legs)
        + sum(item.amount_minor for item in plan.cost_items)
    )


def candidate_by_id(ranked: list[RankedCandidate], experience_id: UUID) -> CandidateRecord | None:
    for row in ranked:
        if row.candidate.id == experience_id:
            return row.candidate
    return None
