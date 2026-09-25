"""From a step the traveller asked for to a catalogue query.

A ``StepSpec`` says what kind of place fills a step; this module turns it into
the payload ``app.planner_retrieve_step`` (migration 045) understands, and
applies the traveller's exclusions to what comes back. The database does the
trust gating - published, visible, verified organisation, checked venue for a
meal or a night - so nothing here can widen what the planner may use.

Money changers are offices, not listings: an ``exchange`` step is read with
``persist.retrieve_changers`` instead.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.planner.schemas import DayScript, StepCandidate, StepSpec

#: The traveller's needs (``constraints.dietary`` / ``accessibility``) as place facts (migration 049).
DIETARY_NEEDS = {"halal": "halal", "vegetarian": "vegetarian", "vegan": "vegan", "gluten-free": "gluten_free"}
ACCESS_NEEDS = {"wheelchair": "wheelchair_access", "step-free": "step_free"}
DEFAULT_RADIUS_M = 25_000
DEFAULT_LIMIT = 8


@dataclass(frozen=True)
class Near:
    """Look around a point (the previous stop, or the pickup), within a radius."""

    lat: float
    lng: float
    radius_m: int = DEFAULT_RADIUS_M


def step_query(
    step: StepSpec,
    script: DayScript,
    *,
    near: Near | None = None,
    exclude_ids: Iterable[UUID] = (),
    limit: int = DEFAULT_LIMIT,
) -> dict[str, Any]:
    """The ``planner_retrieve_step`` payload for one step of the traveller's day."""
    if step.role == "exchange":
        raise ValueError("an exchange step is filled from money changers, not listings")
    destinations = [step.destination_slug] if step.destination_slug else list(script.constraints.destination_slugs)
    query: dict[str, Any] = {
        "role": step.role,
        "tags": list(step.tags),
        "meal": step.meal,
        "destination_slugs": destinations,
        "party_size": script.constraints.party_size,
        # A name the traveller wrote only ranks; it never makes a place trusted.
        "query": step.named_place or "",
        "exclude_ids": [str(item) for item in exclude_ids],
        "limit": limit,
    }
    needs = step_needs(step, script)
    if needs:
        query["needs"] = dict.fromkeys(needs, True)
    if near is not None:
        query["near"] = {"lat": near.lat, "lng": near.lng, "radius_m": near.radius_m}
    return query


def step_needs(step: StepSpec, script: DayScript) -> list[str]:
    """Facts a place must not contradict: diet for meals, access for every step."""
    needs = [ACCESS_NEEDS[item] for item in script.constraints.accessibility if item in ACCESS_NEEDS]
    if step.role == "meal":
        needs += [DIETARY_NEEDS[item] for item in script.constraints.dietary if item in DIETARY_NEEDS]
    return list(dict.fromkeys(needs))


def without_avoided(candidates: list[StepCandidate], avoid_tags: Iterable[str]) -> list[StepCandidate]:
    """Drop places the traveller ruled out ("no seafood", "no hotel")."""
    avoided = set(avoid_tags)
    if not avoided:
        return candidates
    return [candidate for candidate in candidates if not avoided & set(candidate.place_types)]


__all__ = ["DEFAULT_LIMIT", "DEFAULT_RADIUS_M", "Near", "step_needs", "step_query", "without_avoided"]
