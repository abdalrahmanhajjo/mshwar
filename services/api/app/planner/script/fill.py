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

from app.planner.persist import retrieve_changers, retrieve_step
from app.planner.schemas import DayScript, ExtractedConstraints, StepCandidate, StepSpec
from app.planner.script.day import DayPlan, DayPools, PoolEntry, assemble_day
from app.planner.script.retrieval import Near, step_query, without_avoided

#: How far to look for a step the destination cannot fill.
FALLBACK_RADIUS_M = 60_000
POOL_SIZE = 8


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


async def gather_pools(
    db: AsyncSession,
    script: DayScript,
    constraints: ExtractedConstraints,
    *,
    exclude_ids: Iterable[UUID] = (),
) -> DayPools:
    """Trusted candidates per step: the destination first, then nearby places marked ``outside``."""
    excluded = list(exclude_ids)
    pools = DayPools()
    scoped = script.model_copy(update={"constraints": constraints})
    for step in script.steps:
        if step.role == "exchange":
            pools.offices[step.order] = await _changers(db, step, scoped)
            continue
        found = await retrieve_step(db, step_query(step, scoped, exclude_ids=excluded, limit=POOL_SIZE))
        pools.places[step.order] = [PoolEntry(candidate) for candidate in without_avoided(found, script.avoid_tags)]
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
    return pools


async def build_day(
    db: AsyncSession,
    script: DayScript,
    constraints: ExtractedConstraints,
    *,
    start_at_first_stop: bool = False,
    exclude_ids: Iterable[UUID] = (),
) -> tuple[DayPlan, list[StepCandidate]]:
    """The assembled day, and every candidate considered (the entity-id contract for persistence)."""
    pools = await gather_pools(db, script, constraints, exclude_ids=exclude_ids)
    day = assemble_day(script, constraints, pools, start_at_first_stop=start_at_first_stop)
    return day, pools.candidates()


__all__ = ["FALLBACK_RADIUS_M", "build_day", "gather_pools"]
