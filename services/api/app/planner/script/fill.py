"""Fetching the trusted places that could fill each step of a day, then assembling it.

For each step the destination the traveller named is searched first. When it
has nothing of that kind, the search widens to places near the rest of the day
and marks them ``outside`` - "no checked bowling in Batroun; the nearest is in
Jbeil" - instead of leaving the traveller with nothing or inventing a place.
Money-changer steps read registered changers' offices (migration 042).
"""

from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.planner.persist import retrieve_changers, retrieve_driver_rates, retrieve_step
from app.planner.schemas import DayScript, ExtractedConstraints, StepCandidate, StepSpec
from app.planner.script.day import DayPlan, DayPools, PoolEntry, assemble_day
from app.planner.script.retrieval import Near, step_query, without_avoided
from app.planner.script.trip import TripPlan, assemble_trip

#: How far to look for a step the destination cannot fill.
FALLBACK_RADIUS_M = 60_000
POOL_SIZE = 8
#: How many trusted options a traveller can pick from for one step.
MAX_ALTERNATIVES = 24


def _destinations(step: StepSpec, script: DayScript) -> list[str]:
    return [step.destination_slug] if step.destination_slug else list(script.constraints.destination_slugs)


def _anchor(pools: DayPools, constraints: ExtractedConstraints) -> Near | None:
    """The middle of what the day already found, else where the day starts."""
    points = [(entry.candidate.lat, entry.candidate.lng) for entries in pools.places.values() for entry in entries]
    if points:
        return Near(
            lat=sum(lat for lat, _lng in points) / len(points),
            lng=sum(lng for _lat, lng in points) / len(points),
            radius_m=FALLBACK_RADIUS_M,
        )
    if constraints.start_lat is None or constraints.start_lng is None:
        return None
    return Near(lat=constraints.start_lat, lng=constraints.start_lng, radius_m=FALLBACK_RADIUS_M)


async def _changers(db: AsyncSession, step: StepSpec, script: DayScript) -> list[dict[str, object]]:
    for slug in _destinations(step, script):
        found = await retrieve_changers(db, slug)
        if found:
            return found[:POOL_SIZE]
    return []


async def _pin(db: AsyncSession, pools: DayPools, step: StepSpec, scoped: DayScript, wanted: UUID) -> None:
    """Keep only the place the traveller chose for this step - if it is still a trusted candidate for it."""
    entries = [entry for entry in pools.places.get(step.order, []) if entry.candidate.id == wanted]
    if not entries:
        found = await retrieve_step(db, step_query(step, scoped, limit=MAX_ALTERNATIVES))
        entries = [PoolEntry(candidate) for candidate in found if candidate.id == wanted]
        if not entries:
            wider = step.model_copy(update={"destination_slug": None})
            unscoped = scoped.model_copy(
                update={"constraints": scoped.constraints.model_copy(update={"destination_slugs": []})}
            )
            found = await retrieve_step(db, step_query(wider, unscoped, limit=MAX_ALTERNATIVES))
            entries = [PoolEntry(candidate, outside=True) for candidate in found if candidate.id == wanted]
    if entries:
        pools.places[step.order] = entries


async def gather_pools(
    db: AsyncSession,
    script: DayScript,
    constraints: ExtractedConstraints,
    *,
    exclude_ids: Iterable[UUID] = (),
    pins: dict[int, UUID] | None = None,
) -> DayPools:
    """Trusted candidates per step: the destination first, then nearby places marked ``outside``.

    ``pins`` keeps a chosen place for a step (the traveller picked an alternative, or kept the rest
    of the day as it was); a pinned place that is no longer a trusted candidate is simply not kept.
    """
    pinned = pins or {}
    excluded = [item for item in exclude_ids if item not in set(pinned.values())]
    pools = DayPools()
    scoped = script.model_copy(update={"constraints": constraints})
    for step in script.steps:
        if step.role == "exchange":
            pools.offices[step.order] = await _changers(db, step, scoped)
            continue
        found = await retrieve_step(db, step_query(step, scoped, exclude_ids=excluded, limit=POOL_SIZE))
        pools.places[step.order] = [PoolEntry(candidate) for candidate in without_avoided(found, script.avoid_tags)]
    if script.transport == "driver" and constraints.destination_slugs:
        pools.driver_rates = await retrieve_driver_rates(
            db, constraints.destination_slugs[0], constraints.party_size or 1
        )
    anchor = _anchor(pools, constraints)
    for step in script.steps:
        if step.role == "exchange" or pools.places.get(step.order) or not _destinations(step, scoped) or anchor is None:
            continue
        wider = step.model_copy(update={"destination_slug": None})
        unscoped = scoped.model_copy(update={"constraints": constraints.model_copy(update={"destination_slugs": []})})
        found = await retrieve_step(db, step_query(wider, unscoped, near=anchor, exclude_ids=excluded, limit=POOL_SIZE))
        pools.places[step.order] = [
            PoolEntry(candidate, outside=True) for candidate in without_avoided(found, script.avoid_tags)
        ]
    for step in script.steps:
        if step.order in pinned and step.role != "exchange":
            await _pin(db, pools, step, scoped, pinned[step.order])
    return pools


async def build_day(
    db: AsyncSession,
    script: DayScript,
    constraints: ExtractedConstraints,
    *,
    start_at_first_stop: bool = False,
    exclude_ids: Iterable[UUID] = (),
    pins: dict[int, UUID] | None = None,
) -> tuple[DayPlan, list[StepCandidate]]:
    """The assembled day, and every candidate considered (the entity-id contract for persistence)."""
    pools = await gather_pools(db, script, constraints, exclude_ids=exclude_ids, pins=pins)
    day = assemble_day(script, constraints, pools, start_at_first_stop=start_at_first_stop)
    return day, pools.candidates()


async def step_alternatives(
    db: AsyncSession,
    script: DayScript,
    step: StepSpec,
    *,
    near: Near | None = None,
    exclude_ids: Iterable[UUID] = (),
) -> list[PoolEntry]:
    """Trusted options for one step: in the destination, else nearby (marked ``outside``)."""
    found = await retrieve_step(
        db, step_query(step, script, near=near, exclude_ids=exclude_ids, limit=MAX_ALTERNATIVES)
    )
    entries = [PoolEntry(candidate) for candidate in without_avoided(found, script.avoid_tags)]
    if entries or not _destinations(step, script) or near is None:
        return entries
    wider = step.model_copy(update={"destination_slug": None})
    unscoped = script.model_copy(
        update={"constraints": script.constraints.model_copy(update={"destination_slugs": []})}
    )
    found = await retrieve_step(
        db, step_query(wider, unscoped, near=Near(near.lat, near.lng, FALLBACK_RADIUS_M), exclude_ids=exclude_ids)
    )
    return [PoolEntry(candidate, outside=True) for candidate in without_avoided(found, script.avoid_tags)]


async def build_trip(
    db: AsyncSession,
    scripts: list[DayScript],
    constraints: ExtractedConstraints,
    *,
    start_at_first_stop: bool = False,
    exclude_ids: Iterable[UUID] = (),
    pins: dict[tuple[int, int], UUID] | None = None,
) -> tuple[TripPlan, list[StepCandidate]]:
    """Every day's pools, the assembled trip, and every candidate considered (the entity-id contract)."""
    excluded = list(exclude_ids)
    pools: list[DayPools] = []
    seen: dict[UUID, StepCandidate] = {}
    for number, script in enumerate(scripts, start=1):
        day_pins = {order: place for (day, order), place in (pins or {}).items() if day == number}
        day_pools = await gather_pools(db, script, script.constraints, exclude_ids=excluded, pins=day_pins)
        pools.append(day_pools)
        for candidate in day_pools.candidates():
            seen.setdefault(candidate.id, candidate)
    trip = assemble_trip(scripts, constraints, pools, start_at_first_stop=start_at_first_stop)
    return trip, list(seen.values())


__all__ = ["FALLBACK_RADIUS_M", "MAX_ALTERNATIVES", "build_day", "build_trip", "gather_pools", "step_alternatives"]
