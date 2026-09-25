"""The planner session for a trip told step by step (trip builder v2, phases 3-6).

``pipeline.start_or_continue`` hands a request here when it reads as two or
more steps ("a changer, then breakfast at a sweets place, then ... a hotel"),
or as several days ("day 1: ... day 2: ..."). A single day is a trip of one day.
Everything the classic path guarantees still holds:

* the language model only reads the text; places, prices and totals come from
  the database, and every saved stop is one of the retrieved candidates;
* defaults are applied and shown (``assumed_defaults``), with each day's window
  widened for breakfasts, dinners, nights out and nights away;
* the version is sealed by ``app.planner_persist_version``.

The full trip - every step of every day, including money-changer stops and
steps no trusted place could fill - is saved with the version
(``constraints.day``, each step with its ``day``) and returned as ``day``, so
the traveller sees every step they asked for, never a shorter trip.
"""

from __future__ import annotations

import json
import math
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sql import fetch_json
from app.planner.defaults import apply_defaults
from app.planner.explanations import explain_plan
from app.planner.intent.catalogue import destination_terms, resolve_anchors
from app.planner.persist import get_session, get_version, persist_plan, rag_chunks, record_step_gaps, upsert_session
from app.planner.schemas import AssumedDefault, CandidateRecord, DayDriverRequest, DayScript, ExtractedConstraints
from app.planner.script import parse_day_script, read_day_script, script_questions
from app.planner.script.extract import DAY_SCRIPT_PROMPT_VERSION
from app.planner.script.fill import build_trip, step_alternatives
from app.planner.script.learning import record_misses, refresh_phrases
from app.planner.script.patch import PatchResult, patch_day
from app.planner.script.pricing import stop_price
from app.planner.script.retrieval import Near
from app.planner.script.trip import TripPlan, split_days

BEIRUT = ZoneInfo("Asia/Beirut")
#: A request is a "day" when it names at least this many steps (or several days).
MIN_DAY_STEPS = 2
DAY_OPTIMIZER_VERSION = "day-beam-v1"

#: Where a step is: (day, order) - day 1 for a single day.
StepKey = tuple[int, int]


async def catalogue_terms(db: AsyncSession) -> list[tuple[str, str, int]]:
    return await destination_terms(db)


def reads_as_day(raw: str, locale: str, terms: list[tuple[str, str, int]]) -> bool:
    """Cheap, model-free check: does the request describe several steps, or several days?"""
    if len(split_days(raw)) > 1:
        return True
    return len(parse_day_script(raw, locale, terms=terms).steps) >= MIN_DAY_STEPS


def _driver_request(scripts: list[DayScript], trip: TripPlan) -> dict[str, Any] | None:
    """A ride request the traveller can send to verified drivers. Never sent by the planner."""
    if not any(script.transport == "driver" for script in scripts):
        return None
    visited = [outcome for outcome in trip.outcomes if outcome.status in {"filled", "office"}]
    return {
        "kind": "day",
        "days": len(trip.days),
        "destination_slug": next(iter(scripts[0].constraints.destination_slugs), None),
        "pickup": scripts[0].pickup_place or "first_stop",
        "starts_at": trip.window_start.isoformat(),
        "ends_at": trip.return_by.isoformat(),
        "stops": [
            {
                "day": outcome.day,
                "order": outcome.order,
                "title": outcome.title or (outcome.office or {}).get("branch_name"),
                "at": outcome.starts_at.isoformat() if outcome.starts_at else None,
            }
            for outcome in visited
        ],
    }


def _retime_defaults(assumed: list[AssumedDefault], trip: TripPlan, start_at_first_stop: bool) -> list[AssumedDefault]:
    """Show the window the trip actually uses, not the generic default it replaced."""
    kept = [item for item in assumed if item.field not in {"window_start", "return_by"}]
    kept.append(
        AssumedDefault(
            field="window_start",
            value=trip.window_start.isoformat(),
            label=f"Starts {trip.window_start.strftime('%a %H:%M')} Beirut",
        )
    )
    ends = "Trip ends" if len(trip.days) > 1 else "Day ends"
    kept.append(
        AssumedDefault(
            field="return_by",
            value=trip.return_by.isoformat(),
            label=f"{ends} by {trip.return_by.strftime('%a %H:%M')} Beirut",
        )
    )
    if start_at_first_stop:
        kept = [item for item in kept if item.field != "start_location"]
        kept.append(
            AssumedDefault(
                field="start_location", value="first_stop", label="Your driver picks you up at the first stop"
            )
        )
    return kept


async def _explain(db: AsyncSession, trip: TripPlan, constraints: ExtractedConstraints) -> None:
    """One sentence per stop, built only from that place's own facts."""
    by_id: dict[UUID, CandidateRecord] = dict(trip.by_id)
    chunks = {stop.experience_id: await rag_chunks(db, stop.experience_id) for stop in trip.plan.stops}
    explain_plan(trip.plan.stops, by_id, constraints, chunks)


async def record_gaps(db: AsyncSession, scripts: list[DayScript] | DayScript, trip: Any) -> None:
    """What travellers asked for that no trusted place could fill: guides what staff check next.

    Only the kind of place, where and why - never the traveller's own words.
    """
    days = scripts if isinstance(scripts, list) else [scripts]
    destination: dict[StepKey, str | None] = {}
    for number, script in enumerate(days, start=1):
        fallback = next(iter(script.constraints.destination_slugs), None)
        for step in script.steps:
            destination[(number, step.order)] = step.destination_slug or fallback
    gaps = [
        {
            "destination_slug": destination.get((outcome.day, outcome.order)),
            "role": outcome.role,
            "tags": outcome.tags,
            "meal": outcome.meal,
            "reason": outcome.reason or "no_trusted_match",
        }
        for outcome in trip.outcomes
        if outcome.status == "empty"
    ]
    await record_step_gaps(db, gaps)


def _run_candidates(trip: TripPlan) -> list[dict[str, Any]]:
    chosen = {stop.experience_id for stop in trip.plan.stops}
    rows: list[dict[str, Any]] = []
    for rank, candidate in enumerate(trip.by_id.values(), start=1):
        rows.append(
            {
                "experience_id": str(candidate.id),
                "rank": rank,
                "score": float(candidate.hybrid or 0),
                "eligible": True,
                "sponsored": candidate.sponsored,
                "reasons": {"notes": ["chosen for a step"] if candidate.id in chosen else [], "flags": []},
            }
        )
    return rows


@dataclass
class _DayRun:
    """Everything a trip is planned from; the same for a new request and for a re-plan."""

    raw: str
    scripts: list[DayScript]
    constraints: ExtractedConstraints
    assumed: list[AssumedDefault]
    degraded: bool
    round_number: int
    trip_id: UUID | None
    start_at_first_stop: bool
    injection: str | None = None


def _for_day(script: DayScript, trip_constraints: ExtractedConstraints) -> DayScript:
    """A day's steps with the trip's constraints, keeping the day's own destination if it named one."""
    own = [slug for slug in script.constraints.destination_slugs if slug]
    constraints = trip_constraints.model_copy(update={"destination_slugs": own or trip_constraints.destination_slugs})
    return script.model_copy(update={"constraints": constraints})


async def _read_trip(
    db: AsyncSession, user_id: UUID, raw: str, locale: str, terms: list[tuple[str, str, int]]
) -> tuple[list[DayScript], ExtractedConstraints, bool]:
    """Each day's steps (the model reads each day), and the trip-wide constraints from the whole text."""
    segments = split_days(raw)
    scripts: list[DayScript] = []
    degraded = False
    for segment in segments:
        script, day_degraded = read_day_script(segment, locale, terms=terms)
        scripts.append(script)
        degraded = degraded or day_degraded
        await record_misses(db, user_id, script.unparsed, locale)
    if len(scripts) == 1:
        return scripts, scripts[0].constraints, degraded
    whole = parse_day_script(raw, locale, terms=terms)
    transport = next((script.transport for script in scripts if script.transport), whole.transport)
    scripts = [script.model_copy(update={"transport": script.transport or transport}) for script in scripts]
    return scripts, whole.constraints, degraded


async def plan_day_session(
    db: AsyncSession,
    user_id: UUID,
    raw: str,
    locale: str,
    session_id: UUID | None,
    trip_id: UUID | None,
    *,
    answers: dict[str, Any] | None,
    approve_budget: bool,
    injection: str | None,
    terms: list[tuple[str, str, int]],
    exclude_ids: set[UUID] | None = None,
) -> dict[str, Any]:
    """Plan a new day - or several - from the traveller's words."""
    started = time.monotonic()
    await refresh_phrases(db)
    scripts, trip_constraints, degraded = await _read_trip(db, user_id, raw, locale, terms)
    constraints = await resolve_anchors(db, raw, trip_constraints)
    round_number = 0
    if session_id:
        stored = await get_session(db, user_id, session_id)
        round_number = int(stored.get("clarification_round") or 0)
        trip_id = trip_id or stored.get("trip_id")
    merged, assumed = apply_defaults(constraints, answers)
    if approve_budget:
        merged.strict_budget = False
        assumed.append(
            AssumedDefault(field="strict_budget", value=False, label="You approved exceeding the strict budget")
        )
    scripts = [_for_day(script, merged) for script in scripts]
    first = scripts[0]
    start_assumed = any(item.field == "start_location" for item in assumed)
    run = _DayRun(
        raw=raw,
        scripts=scripts,
        constraints=merged,
        assumed=assumed,
        degraded=degraded,
        round_number=round_number,
        trip_id=UUID(str(trip_id)) if trip_id else None,
        start_at_first_stop=start_assumed and (first.transport == "driver" or first.pickup_requested),
        injection=injection,
    )
    return await _plan_and_seal(db, user_id, session_id, run, started, exclude_ids=exclude_ids or set())


async def saved_day(
    db: AsyncSession, user_id: UUID, session_id: UUID
) -> tuple[dict[str, Any], dict[str, Any] | None, list[DayScript] | None]:
    """The session, its current version, and each day's steps as saved (None if not a step-by-step trip)."""
    stored = await get_session(db, user_id, session_id)
    version_id = stored.get("current_version_id")
    version = await get_version(db, user_id, UUID(str(version_id)), False) if version_id else None
    kept_constraints = (version or {}).get("constraints") or {}
    kept = kept_constraints.get("day_scripts") or (
        [kept_constraints["day_script"]] if isinstance(kept_constraints.get("day_script"), dict) else None
    )
    if not kept:
        return stored, version, None
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    scripts = [
        DayScript.model_validate({**item, "constraints": constraints.model_dump()})
        for item in kept
        if isinstance(item, dict)
    ]
    return stored, version, scripts or None


def current_places(version: dict[str, Any] | None) -> dict[StepKey, UUID]:
    """Which listing fills each step of the saved trip, by (day, order)."""
    day = ((version or {}).get("constraints") or {}).get("day") or []
    return {
        (int(step.get("day") or 1), int(step["order"])): UUID(str(step["experience_id"]))
        for step in day
        if isinstance(step, dict) and step.get("status") == "filled" and step.get("experience_id")
    }


async def replan_day_session(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    *,
    scripts: list[DayScript] | None = None,
    exclude_ids: set[UUID] | None = None,
    pins: dict[StepKey, UUID] | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Plan a saved trip again: after an edit, a choice of place for one step, or a regenerate."""
    started = time.monotonic()
    stored, _version, saved = await saved_day(db, user_id, session_id)
    days = scripts or saved
    if not days:
        raise ValueError("this plan was not made step by step")
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    if note:
        assumed.append(AssumedDefault(field="edit", value=note, label=note))
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    if scripts:
        constraints = scripts[0].constraints
    run = _DayRun(
        raw=str(stored.get("raw_text") or ""),
        scripts=days,
        constraints=constraints,
        assumed=assumed,
        degraded=bool(stored.get("degraded")),
        round_number=int(stored.get("clarification_round") or 0),
        trip_id=UUID(str(stored["trip_id"])) if stored.get("trip_id") else None,
        start_at_first_stop=any(item.field == "start_location" and item.value == "first_stop" for item in assumed),
    )
    return await _plan_and_seal(db, user_id, session_id, run, started, exclude_ids=exclude_ids or set(), pins=pins)


async def _plan_and_seal(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID | None,
    run: _DayRun,
    started: float,
    *,
    exclude_ids: set[UUID],
    pins: dict[StepKey, UUID] | None = None,
) -> dict[str, Any]:
    from app.planner.pipeline import _session_payload

    merged, scripts = run.constraints, run.scripts
    trip, candidates = await build_trip(
        db, scripts, merged, start_at_first_stop=run.start_at_first_stop, exclude_ids=exclude_ids, pins=pins
    )
    await record_gaps(db, scripts, trip)
    merged.window_start, merged.return_by = trip.window_start, trip.return_by
    assumed = _retime_defaults(run.assumed, trip, run.start_at_first_stop)
    questions = [question for script in scripts for question in script_questions(script)][:2]
    kept_scripts = [script.model_dump(mode="json", exclude={"constraints"}) for script in scripts]
    extra: dict[str, Any] = {
        "day": trip.outcomes_json(),
        "days": len(scripts),
        "day_script": kept_scripts[0],
        "day_scripts": kept_scripts,
        "driver_request": _driver_request(scripts, trip),
        "pricing": trip.pricing.model_dump(mode="json"),
        "injection_logged": bool(run.injection),
    }
    status = "degraded" if run.degraded else "planned"
    if trip.plan.infeasible:
        session_uuid = await upsert_session(
            db,
            user_id,
            session_id,
            locale=merged.locale,
            raw_text=run.raw,
            status="infeasible",
            round_number=run.round_number,
            constraints=merged,
            assumed=assumed,
            degraded=run.degraded,
            trip_id=run.trip_id,
        )
        return _session_payload(
            session_id=session_uuid,
            status="infeasible",
            degraded=run.degraded,
            constraints=merged,
            assumed=assumed,
            questions=questions,
            extra={**extra, "reason": trip.plan.infeasible_reason},
        )
    await _explain(db, trip, merged)
    retrieved = [str(candidate.id) for candidate in candidates]
    doc = await persist_plan(
        db,
        user_id,
        merged,
        trip.plan,
        trip_id=run.trip_id,
        title=run.raw.strip()[:80] or "My day",
        origin="ai",
        retrieved_ids=retrieved,
        assumed=assumed,
        degraded=run.degraded,
        ranked=_run_candidates(trip),
        latency_ms=int((time.monotonic() - started) * 1000),
        run_status="infeasible" if trip.plan.needs_budget_approval else ("fallback" if run.degraded else "succeeded"),
        extra_constraints={key: extra[key] for key in ("day", "days", "day_script", "day_scripts", "pricing")},
        run_versions={"prompt_version": DAY_SCRIPT_PROMPT_VERSION, "optimizer_version": DAY_OPTIMIZER_VERSION},
    )
    for stop in trip.plan.stops:
        if str(stop.experience_id) not in retrieved:
            raise RuntimeError("entity-id contract violated")
    session_uuid = await upsert_session(
        db,
        user_id,
        session_id,
        locale=merged.locale,
        raw_text=run.raw,
        status=status,
        round_number=run.round_number,
        constraints=merged,
        assumed=assumed,
        degraded=run.degraded,
        trip_id=UUID(str(doc["trip_id"])),
        version_id=UUID(str(doc["version_id"])),
    )
    return _session_payload(
        session_id=session_uuid,
        status=status,
        degraded=run.degraded,
        constraints=merged,
        assumed=assumed,
        questions=questions,
        plan_doc=doc,
        extra={
            **extra,
            "budget_warning": trip.plan.budget_warning,
            "needs_budget_approval": trip.plan.needs_budget_approval,
            "explanations": [stop.explanation for stop in trip.plan.stops],
        },
    )


# ---- Phase 6: editing a trip step by step ----

_DAY_PREFIX = re.compile(
    r"^\s*(?:on\s+)?(?:day|jour|اليوم|يوم|nhar)\s*(?P<n>\d)\s*[:,\-–]?\s*(?P<rest>.+)$", re.IGNORECASE | re.DOTALL
)


def patch_trip(scripts: list[DayScript], text_value: str) -> tuple[int, PatchResult] | None:
    """Apply step edits to one day: the day named ("day 2: ..."), else the first day they all fit."""
    prefix = _DAY_PREFIX.match(text_value or "")
    if prefix:
        number = int(prefix.group("n"))
        if not 1 <= number <= len(scripts):
            return None
        result = patch_day(scripts[number - 1], prefix.group("rest"))
        return (number, result) if result.understood else None
    for number, script in enumerate(scripts, start=1):
        result = patch_day(script, text_value)
        if result.understood:
            return number, result
    return None


async def day_refine_preview(
    db: AsyncSession, user_id: UUID, session_id: UUID, text_value: str
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Step edits for a step-by-step trip: (preview, pending) - or None to fall back to preference refine."""
    _stored, _version, saved = await saved_day(db, user_id, session_id)
    if not saved:
        return None
    edited = patch_trip(saved, text_value)
    if edited is None:
        return None
    number, result = edited
    preview = {
        "understood": True,
        "summary": result.summary if len(saved) == 1 else f"Day {number}: {result.summary}",
        "clarification": None,
        "kind": "day_patch",
        "day": number,
        "steps": [step.model_dump(mode="json") for step in result.script.steps],
    }
    pending = {
        "kind": "day_patch",
        "day": number,
        "summary": preview["summary"],
        "script": result.script.model_dump(mode="json", exclude={"constraints"}),
    }
    return preview, pending


async def day_refine_apply(
    db: AsyncSession, user_id: UUID, session_id: UUID, pending: dict[str, Any]
) -> dict[str, Any]:
    """Re-plan the trip with the edited day the traveller previewed."""
    _stored, _version, saved = await saved_day(db, user_id, session_id)
    if not saved:
        raise ValueError("this plan was not made step by step")
    number = int(pending.get("day") or 1)
    if not 1 <= number <= len(saved):
        raise ValueError("that day is not in this plan")
    edited = DayScript.model_validate(
        {**(pending.get("script") or {}), "constraints": saved[number - 1].constraints.model_dump()}
    )
    scripts = [edited if index == number else script for index, script in enumerate(saved, start=1)]
    return await replan_day_session(db, user_id, session_id, scripts=scripts, note=str(pending.get("summary") or ""))


async def day_constraints_refine(
    db: AsyncSession, user_id: UUID, session_id: UUID, constraints: ExtractedConstraints, note: str
) -> dict[str, Any] | None:
    """A preference change ("cheaper", "less driving") on a step-by-step trip keeps its steps."""
    _stored, _version, saved = await saved_day(db, user_id, session_id)
    if not saved:
        return None
    scripts = [_for_day(script, constraints) for script in saved]
    return await replan_day_session(db, user_id, session_id, scripts=scripts, note=note)


async def regenerate_day(
    db: AsyncSession, user_id: UUID, session_id: UUID, *, exclude_unlocked: bool
) -> dict[str, Any] | None:
    """Fresh places for every step that is not locked. None if this is not a step-by-step trip."""
    _stored, version, saved = await saved_day(db, user_id, session_id)
    if not saved:
        return None
    locked = {UUID(str(stop["experience_id"])) for stop in (version or {}).get("stops") or [] if stop.get("locked")}
    places = current_places(version)
    pins = {key: place for key, place in places.items() if place in locked}
    exclude = {place for place in places.values() if place not in locked} if exclude_unlocked else set()
    return await replan_day_session(db, user_id, session_id, exclude_ids=exclude, pins=pins)


def _previous_point(outcomes: list[dict[str, Any]], day: int, order: int) -> Near | None:
    earlier = [
        step
        for step in outcomes
        if isinstance(step, dict) and int(step.get("day") or 1) == day and int(step.get("order", 0)) < order
    ]
    for step in reversed(earlier):
        if step.get("lat") is not None and step.get("lng") is not None:
            return Near(float(step["lat"]), float(step["lng"]))
    return None


async def alternatives_for_step(
    db: AsyncSession, user_id: UUID, session_id: UUID, order: int, day: int = 1
) -> list[dict[str, Any]]:
    """Trusted options for one step of a saved trip, near the step before it, with their published prices."""
    _stored, version, saved = await saved_day(db, user_id, session_id)
    if not saved:
        raise ValueError("this plan was not made step by step")
    if not 1 <= day <= len(saved):
        raise ValueError("step not found")
    script = saved[day - 1]
    step = next((item for item in script.steps if item.order == order), None)
    if step is None or step.role == "exchange":
        raise ValueError("step not found")
    outcomes = ((version or {}).get("constraints") or {}).get("day") or []
    current = current_places(version).get((day, order))
    entries = await step_alternatives(
        db, script, step, near=_previous_point(outcomes, day, order), exclude_ids=[current] if current else []
    )
    party = script.constraints.party_size or 1
    return [
        {
            "experience_id": str(entry.candidate.id),
            "slug": entry.candidate.slug,
            "title": entry.candidate.title,
            "destination_slug": entry.candidate.destination_slug,
            "place_types": entry.candidate.place_types,
            "trust": entry.candidate.trust,
            "distance_m": entry.candidate.distance_m,
            "outside_destination": entry.outside,
            "needs_schedule": entry.candidate.needs_schedule,
            "price": stop_price(entry.candidate, party, order=order, role=step.role).model_dump(mode="json"),
        }
        for entry in entries
    ]


async def choose_for_step(
    db: AsyncSession, user_id: UUID, session_id: UUID, order: int, experience_id: UUID, day: int = 1
) -> dict[str, Any]:
    """The traveller picks one of a step's alternatives; every other step keeps its place."""
    options = await alternatives_for_step(db, user_id, session_id, order, day)
    if str(experience_id) not in {option["experience_id"] for option in options}:
        raise ValueError("that place is not a trusted option for this step")
    _stored, version, _saved = await saved_day(db, user_id, session_id)
    pins = {**current_places(version), (day, order): experience_id}
    return await replan_day_session(db, user_id, session_id, pins=pins, note=f"You chose a place for step {order}")


# ---- Phase 4: a driver for the planned day ----

MIN_DRIVER_HOURS, MAX_DRIVER_HOURS = 2, 14
NOTES_LIMIT = 1000


def _clock(value: Any) -> str:
    try:
        return datetime.fromisoformat(str(value)).astimezone(BEIRUT).strftime("%H:%M")
    except ValueError:
        return ""


def _itinerary(day: list[dict[str, Any]]) -> list[str]:
    lines = []
    for step in day:
        if step.get("status") not in {"filled", "office"}:
            continue
        name = step.get("title") or (step.get("office") or {}).get("branch_name") or step.get("role")
        lines.append(f"{_clock(step.get('starts_at'))} {name}".strip())
    return lines


def ride_request_for(version: dict[str, Any], pickup: DayDriverRequest) -> dict[str, Any]:
    """The ``traveller_request_ride`` payload for a sealed day: where, when, how long, for whom, and the stops.

    Only what the day already holds; drivers still quote their own fixed price.
    """
    constraints = version.get("constraints") or {}
    number = pickup.day
    day = [
        step for step in constraints.get("day") or [] if isinstance(step, dict) and int(step.get("day") or 1) == number
    ]
    visited = [step for step in day if step.get("status") in {"filled", "office"} and step.get("starts_at")]
    if not visited:
        raise ValueError("this plan has no stops for a driver yet")
    destination = next((step.get("destination_slug") for step in visited if step.get("destination_slug")), None)
    destination = destination or next(iter(constraints.get("destination_slugs") or []), None)
    if not destination:
        raise ValueError("choose where the day is spent")
    trip_start = datetime.fromisoformat(str(version.get("window_start") or visited[0]["starts_at"]))
    # Day N of a trip starts at the same time of day, N-1 days later - or at its first stop if that is earlier.
    starts = min(
        trip_start + timedelta(days=number - 1),
        min(datetime.fromisoformat(str(step["starts_at"])) for step in visited),
    )
    last = max(datetime.fromisoformat(str(step.get("ends_at") or step["starts_at"])) for step in visited)
    hours = math.ceil((last - starts).total_seconds() / 3600)
    lines = _itinerary(day)
    if hours > MAX_DRIVER_HOURS:
        lines.append(f"The plan runs {hours} hours: agree the rest of the day with the driver.")
    notes = "Mshwar day plan:\n" + "\n".join(lines)
    if pickup.notes.strip():
        notes += "\n" + pickup.notes.strip()
    body: dict[str, Any] = {
        "kind": "day",
        "destination": destination,
        "starts_at": starts.isoformat(),
        "hours": max(MIN_DRIVER_HOURS, min(MAX_DRIVER_HOURS, hours)),
        "party_size": int(version.get("party_size") or 1),
        "pickup_name": pickup.pickup_name.strip(),
        "luggage": pickup.luggage,
        "notes": notes[:NOTES_LIMIT],
        "trip_id": version.get("trip_id"),
    }
    if pickup.pickup_lat is not None and pickup.pickup_lng is not None:
        body["pickup_lat"], body["pickup_lng"] = pickup.pickup_lat, pickup.pickup_lng
    return body


async def request_day_driver(
    db: AsyncSession, user_id: UUID, session_id: UUID, pickup: DayDriverRequest
) -> dict[str, Any]:
    """Send the traveller's planned day to the verified drivers covering it (041 rules apply)."""
    stored = await get_session(db, user_id, session_id)
    version_id = stored.get("current_version_id")
    if not version_id:
        raise ValueError("plan the day before asking for a driver")
    version = await get_version(db, user_id, UUID(str(version_id)), False)
    body = ride_request_for(version, pickup)
    created = await fetch_json(
        db,
        "SELECT app.traveller_request_ride(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": str(user_id), "body": json.dumps(body, default=str)},
    )
    if not isinstance(created, dict):
        raise TypeError("the ride request was not created")
    return created


__all__ = [
    "MIN_DAY_STEPS",
    "alternatives_for_step",
    "choose_for_step",
    "day_constraints_refine",
    "day_refine_apply",
    "day_refine_preview",
    "regenerate_day",
    "replan_day_session",
    "catalogue_terms",
    "plan_day_session",
    "reads_as_day",
    "request_day_driver",
    "ride_request_for",
]
