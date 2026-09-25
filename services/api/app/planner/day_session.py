"""The planner session for a day told step by step (trip builder v2, phase 3).

``pipeline.start_or_continue`` hands a request here when it reads as two or
more steps ("a changer, then breakfast at a sweets place, then ... a hotel").
Everything the classic path guarantees still holds:

* the language model only reads the text; places, prices and totals come from
  the database, and every saved stop is one of the retrieved candidates;
* defaults are applied and shown (``assumed_defaults``), with the day's window
  widened for breakfasts, dinners, nights out and nights away;
* the version is sealed by ``app.planner_persist_version``.

The full day - including money-changer stops and steps no trusted place could
fill - is saved with the version (``constraints.day``) and returned as
``day``, so the traveller sees every step they asked for, never a shorter day.
"""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from datetime import datetime
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
from app.planner.script.day import DayPlan
from app.planner.script.extract import DAY_SCRIPT_PROMPT_VERSION
from app.planner.script.fill import build_day, step_alternatives
from app.planner.script.learning import record_misses, refresh_phrases
from app.planner.script.patch import patch_day
from app.planner.script.pricing import stop_price
from app.planner.script.retrieval import Near

BEIRUT = ZoneInfo("Asia/Beirut")
#: A request is a "day" when it names at least this many steps.
MIN_DAY_STEPS = 2
DAY_OPTIMIZER_VERSION = "day-beam-v1"


async def catalogue_terms(db: AsyncSession) -> list[tuple[str, str, int]]:
    return await destination_terms(db)


def reads_as_day(raw: str, locale: str, terms: list[tuple[str, str, int]]) -> bool:
    """Cheap, model-free check: does the request describe several steps?"""
    return len(parse_day_script(raw, locale, terms=terms).steps) >= MIN_DAY_STEPS


def _driver_request(script: DayScript, day: DayPlan) -> dict[str, Any] | None:
    """A ride request the traveller can send to verified drivers. Never sent by the planner."""
    if script.transport != "driver":
        return None
    visited = [outcome for outcome in day.outcomes if outcome.status in {"filled", "office"}]
    return {
        "kind": "day",
        "destination_slug": next(iter(script.constraints.destination_slugs), None),
        "pickup": script.pickup_place or "first_stop",
        "starts_at": day.window_start.isoformat(),
        "ends_at": day.return_by.isoformat(),
        "stops": [
            {
                "order": outcome.order,
                "title": outcome.title or (outcome.office or {}).get("branch_name"),
                "at": outcome.starts_at.isoformat() if outcome.starts_at else None,
            }
            for outcome in visited
        ],
    }


def _retime_defaults(assumed: list[AssumedDefault], day: DayPlan, start_at_first_stop: bool) -> list[AssumedDefault]:
    """Show the window the day actually uses, not the generic default it replaced."""
    kept = [item for item in assumed if item.field not in {"window_start", "return_by"}]
    kept.append(
        AssumedDefault(
            field="window_start",
            value=day.window_start.isoformat(),
            label=f"Starts {day.window_start.strftime('%a %H:%M')} Beirut",
        )
    )
    kept.append(
        AssumedDefault(
            field="return_by",
            value=day.return_by.isoformat(),
            label=f"Day ends by {day.return_by.strftime('%a %H:%M')} Beirut",
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


async def _explain(db: AsyncSession, day: DayPlan, constraints: ExtractedConstraints) -> None:
    """One sentence per stop, built only from that place's own facts."""
    by_id: dict[UUID, CandidateRecord] = dict(day.by_id)
    chunks = {stop.experience_id: await rag_chunks(db, stop.experience_id) for stop in day.plan.stops}
    explain_plan(day.plan.stops, by_id, constraints, chunks)


async def record_gaps(db: AsyncSession, script: DayScript, day: DayPlan) -> None:
    """What travellers asked for that no trusted place could fill: guides what staff check next.

    Only the kind of place, where and why - never the traveller's own words.
    """
    fallback = next(iter(script.constraints.destination_slugs), None)
    destination = {step.order: step.destination_slug for step in script.steps}
    gaps = [
        {
            "destination_slug": destination.get(outcome.order) or fallback,
            "role": outcome.role,
            "tags": outcome.tags,
            "meal": outcome.meal,
            "reason": outcome.reason or "no_trusted_match",
        }
        for outcome in day.outcomes
        if outcome.status == "empty"
    ]
    await record_step_gaps(db, gaps)


def _run_candidates(day: DayPlan) -> list[dict[str, Any]]:
    chosen = {stop.experience_id for stop in day.plan.stops}
    rows: list[dict[str, Any]] = []
    for rank, candidate in enumerate(day.by_id.values(), start=1):
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
    """Everything a day is planned from; the same for a new request and for a re-plan."""

    raw: str
    script: DayScript
    constraints: ExtractedConstraints
    assumed: list[AssumedDefault]
    degraded: bool
    round_number: int
    trip_id: UUID | None
    start_at_first_stop: bool
    injection: str | None = None


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
    """Plan a new day from the traveller's words."""
    started = time.monotonic()
    await refresh_phrases(db)
    script, degraded = read_day_script(raw, locale, terms=terms)
    await record_misses(db, user_id, script.unparsed, locale)
    constraints = await resolve_anchors(db, raw, script.constraints)
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
    script = script.model_copy(update={"constraints": merged})
    start_assumed = any(item.field == "start_location" for item in assumed)
    run = _DayRun(
        raw=raw,
        script=script,
        constraints=merged,
        assumed=assumed,
        degraded=degraded,
        round_number=round_number,
        trip_id=UUID(str(trip_id)) if trip_id else None,
        start_at_first_stop=start_assumed and (script.transport == "driver" or script.pickup_requested),
        injection=injection,
    )
    return await _plan_and_seal(db, user_id, session_id, run, started, exclude_ids=exclude_ids or set())


async def saved_day(
    db: AsyncSession, user_id: UUID, session_id: UUID
) -> tuple[dict[str, Any], dict[str, Any] | None, DayScript | None]:
    """The session, its current version, and the day's steps as saved (None if not a day session)."""
    stored = await get_session(db, user_id, session_id)
    version_id = stored.get("current_version_id")
    version = await get_version(db, user_id, UUID(str(version_id)), False) if version_id else None
    kept = ((version or {}).get("constraints") or {}).get("day_script")
    if not isinstance(kept, dict):
        return stored, version, None
    constraints = ExtractedConstraints.model_validate(stored.get("constraints") or {})
    return stored, version, DayScript.model_validate({**kept, "constraints": constraints.model_dump()})


def current_places(version: dict[str, Any] | None) -> dict[int, UUID]:
    """Which listing fills each step of the saved day, by step order."""
    day = ((version or {}).get("constraints") or {}).get("day") or []
    return {
        int(step["order"]): UUID(str(step["experience_id"]))
        for step in day
        if isinstance(step, dict) and step.get("status") == "filled" and step.get("experience_id")
    }


async def replan_day_session(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    *,
    script: DayScript | None = None,
    exclude_ids: set[UUID] | None = None,
    pins: dict[int, UUID] | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """Plan a saved day again: after an edit, a choice of place for one step, or a regenerate."""
    started = time.monotonic()
    stored, _version, saved = await saved_day(db, user_id, session_id)
    day_script = script or saved
    if day_script is None:
        raise ValueError("this plan was not made step by step")
    assumed = [AssumedDefault.model_validate(item) for item in (stored.get("assumed_defaults") or [])]
    if note:
        assumed.append(AssumedDefault(field="edit", value=note, label=note))
    run = _DayRun(
        raw=str(stored.get("raw_text") or ""),
        script=day_script,
        constraints=day_script.constraints,
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
    pins: dict[int, UUID] | None = None,
) -> dict[str, Any]:
    from app.planner.pipeline import _session_payload

    merged, script = run.constraints, run.script
    day, candidates = await build_day(
        db, script, merged, start_at_first_stop=run.start_at_first_stop, exclude_ids=exclude_ids, pins=pins
    )
    await record_gaps(db, script, day)
    merged.window_start, merged.return_by = day.window_start, day.return_by
    assumed = _retime_defaults(run.assumed, day, run.start_at_first_stop)
    questions = script_questions(script)
    extra: dict[str, Any] = {
        "day": day.outcomes_json(),
        "day_script": script.model_dump(mode="json", exclude={"constraints"}),
        "driver_request": _driver_request(script, day),
        "pricing": day.pricing.model_dump(mode="json"),
        "injection_logged": bool(run.injection),
    }
    status = "degraded" if run.degraded else "planned"
    if day.plan.infeasible:
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
            extra={**extra, "reason": day.plan.infeasible_reason},
        )
    await _explain(db, day, merged)
    retrieved = [str(candidate.id) for candidate in candidates]
    doc = await persist_plan(
        db,
        user_id,
        merged,
        day.plan,
        trip_id=run.trip_id,
        title=run.raw.strip()[:80] or "My day",
        origin="ai",
        retrieved_ids=retrieved,
        assumed=assumed,
        degraded=run.degraded,
        ranked=_run_candidates(day),
        latency_ms=int((time.monotonic() - started) * 1000),
        run_status="infeasible" if day.plan.needs_budget_approval else ("fallback" if run.degraded else "succeeded"),
        extra_constraints={"day": extra["day"], "day_script": extra["day_script"], "pricing": extra["pricing"]},
        run_versions={"prompt_version": DAY_SCRIPT_PROMPT_VERSION, "optimizer_version": DAY_OPTIMIZER_VERSION},
    )
    for stop in day.plan.stops:
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
            "budget_warning": day.plan.budget_warning,
            "needs_budget_approval": day.plan.needs_budget_approval,
            "explanations": [stop.explanation for stop in day.plan.stops],
        },
    )


# ---- Phase 6: editing a day step by step ----


async def day_refine_preview(
    db: AsyncSession, user_id: UUID, session_id: UUID, text_value: str
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Step edits for a day session: (preview, pending) - or None to fall back to preference refine."""
    stored, _version, saved = await saved_day(db, user_id, session_id)
    if saved is None:
        return None
    result = patch_day(saved, text_value)
    if not result.understood:
        return None
    preview = {
        "understood": True,
        "summary": result.summary,
        "clarification": None,
        "kind": "day_patch",
        "steps": [step.model_dump(mode="json") for step in result.script.steps],
    }
    pending = {
        "kind": "day_patch",
        "summary": result.summary,
        "script": result.script.model_dump(mode="json", exclude={"constraints"}),
    }
    return preview, pending


async def day_refine_apply(
    db: AsyncSession, user_id: UUID, session_id: UUID, pending: dict[str, Any]
) -> dict[str, Any]:
    """Re-plan the day with the edited steps the traveller previewed."""
    stored, _version, saved = await saved_day(db, user_id, session_id)
    if saved is None:
        raise ValueError("this plan was not made step by step")
    edited = DayScript.model_validate({**(pending.get("script") or {}), "constraints": saved.constraints.model_dump()})
    return await replan_day_session(db, user_id, session_id, script=edited, note=str(pending.get("summary") or ""))


async def day_constraints_refine(
    db: AsyncSession, user_id: UUID, session_id: UUID, constraints: ExtractedConstraints, note: str
) -> dict[str, Any] | None:
    """A preference change ("cheaper", "less driving") on a day session keeps its steps."""
    _stored, _version, saved = await saved_day(db, user_id, session_id)
    if saved is None:
        return None
    return await replan_day_session(
        db, user_id, session_id, script=saved.model_copy(update={"constraints": constraints}), note=note
    )


async def regenerate_day(
    db: AsyncSession, user_id: UUID, session_id: UUID, *, exclude_unlocked: bool
) -> dict[str, Any] | None:
    """Fresh places for every step that is not locked. None if this is not a day session."""
    _stored, version, saved = await saved_day(db, user_id, session_id)
    if saved is None:
        return None
    locked = {UUID(str(stop["experience_id"])) for stop in (version or {}).get("stops") or [] if stop.get("locked")}
    places = current_places(version)
    pins = {order: place for order, place in places.items() if place in locked}
    exclude = {place for place in places.values() if place not in locked} if exclude_unlocked else set()
    return await replan_day_session(db, user_id, session_id, exclude_ids=exclude, pins=pins)


def _previous_point(day: list[dict[str, Any]], order: int) -> Near | None:
    for step in reversed([step for step in day if isinstance(step, dict) and int(step.get("order", 0)) < order]):
        office = step.get("office") or {}
        lat, lng = step.get("lat") or office.get("lat"), step.get("lng") or office.get("lng")
        if lat is not None and lng is not None:
            return Near(float(lat), float(lng))
    return None


async def alternatives_for_step(db: AsyncSession, user_id: UUID, session_id: UUID, order: int) -> list[dict[str, Any]]:
    """Trusted options for one step of a saved day, near the step before it, with their published prices."""
    _stored, version, saved = await saved_day(db, user_id, session_id)
    if saved is None:
        raise ValueError("this plan was not made step by step")
    step = next((item for item in saved.steps if item.order == order), None)
    if step is None or step.role == "exchange":
        raise ValueError("step not found")
    day = ((version or {}).get("constraints") or {}).get("day") or []
    current = current_places(version).get(order)
    entries = await step_alternatives(
        db, saved, step, near=_previous_point(day, order), exclude_ids=[current] if current else []
    )
    party = saved.constraints.party_size or 1
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
    db: AsyncSession, user_id: UUID, session_id: UUID, order: int, experience_id: UUID
) -> dict[str, Any]:
    """The traveller picks one of a step's alternatives; the other steps keep their places."""
    options = await alternatives_for_step(db, user_id, session_id, order)
    if str(experience_id) not in {option["experience_id"] for option in options}:
        raise ValueError("that place is not a trusted option for this step")
    _stored, version, _saved = await saved_day(db, user_id, session_id)
    pins = {**current_places(version), order: experience_id}
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
    day = [step for step in constraints.get("day") or [] if isinstance(step, dict)]
    visited = [step for step in day if step.get("status") in {"filled", "office"} and step.get("starts_at")]
    if not visited:
        raise ValueError("this plan has no stops for a driver yet")
    destination = next((step.get("destination_slug") for step in visited if step.get("destination_slug")), None)
    destination = destination or next(iter(constraints.get("destination_slugs") or []), None)
    if not destination:
        raise ValueError("choose where the day is spent")
    starts = datetime.fromisoformat(str(version.get("window_start") or visited[0]["starts_at"]))
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
