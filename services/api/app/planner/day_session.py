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

import time
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.planner.defaults import apply_defaults
from app.planner.explanations import explain_plan
from app.planner.intent.catalogue import destination_terms, resolve_anchors
from app.planner.persist import get_session, persist_plan, rag_chunks, upsert_session
from app.planner.schemas import AssumedDefault, CandidateRecord, DayScript, ExtractedConstraints
from app.planner.script import parse_day_script, read_day_script, script_questions
from app.planner.script.day import DayPlan
from app.planner.script.extract import DAY_SCRIPT_PROMPT_VERSION
from app.planner.script.fill import build_day

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
    from app.planner.pipeline import _session_payload

    started = time.monotonic()
    script, degraded = read_day_script(raw, locale, terms=terms)
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
    start_at_first_stop = start_assumed and (script.transport == "driver" or script.pickup_requested)
    day, candidates = await build_day(
        db, script, merged, start_at_first_stop=start_at_first_stop, exclude_ids=exclude_ids or ()
    )
    merged.window_start, merged.return_by = day.window_start, day.return_by
    assumed = _retime_defaults(assumed, day, start_at_first_stop)
    questions = script_questions(script)
    extra: dict[str, Any] = {
        "day": day.outcomes_json(),
        "day_script": script.model_dump(mode="json", exclude={"constraints"}),
        "driver_request": _driver_request(script, day),
        "injection_logged": bool(injection),
    }
    status = "degraded" if degraded else "planned"
    if day.plan.infeasible:
        session_uuid = await upsert_session(
            db,
            user_id,
            session_id,
            locale=merged.locale,
            raw_text=raw,
            status="infeasible",
            round_number=round_number,
            constraints=merged,
            assumed=assumed,
            degraded=degraded,
            trip_id=UUID(str(trip_id)) if trip_id else None,
        )
        return _session_payload(
            session_id=session_uuid,
            status="infeasible",
            degraded=degraded,
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
        trip_id=UUID(str(trip_id)) if trip_id else None,
        title=raw.strip()[:80] or "My day",
        origin="ai",
        retrieved_ids=retrieved,
        assumed=assumed,
        degraded=degraded,
        ranked=_run_candidates(day),
        latency_ms=int((time.monotonic() - started) * 1000),
        run_status="infeasible" if day.plan.needs_budget_approval else ("fallback" if degraded else "succeeded"),
        extra_constraints={"day": extra["day"], "day_script": extra["day_script"]},
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
        raw_text=raw,
        status=status,
        round_number=round_number,
        constraints=merged,
        assumed=assumed,
        degraded=degraded,
        trip_id=UUID(str(doc["trip_id"])),
        version_id=UUID(str(doc["version_id"])),
    )
    return _session_payload(
        session_id=session_uuid,
        status=status,
        degraded=degraded,
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


__all__ = ["MIN_DAY_STEPS", "catalogue_terms", "plan_day_session", "reads_as_day"]
