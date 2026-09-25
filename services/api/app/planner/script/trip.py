"""Trips of several days, told day by day (trip builder v2, phase 6).

"Day 1: Byblos castle, then seafood, then a hotel. Day 2: the Cedars, then
lunch in Bsharri" - or "اليوم الأول … تاني يوم …", "jour 1 … le lendemain …".
Each day is read and planned like a single day; the next day starts where the
previous night was spent (its hotel), otherwise where the trip started. The
trip is saved as one version: every stop in order across the days, one
price for the whole trip, and every step tagged with its day.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from app.planner.schemas import (
    AssembledLeg,
    AssembledPlan,
    AssembledStop,
    CostItem,
    DayScript,
    ExtractedConstraints,
    StepCandidate,
)
from app.planner.script.day import DayPlan, DayPools, StepOutcome, assemble_day
from app.planner.script.pricing import DayPrice, price_day

MAX_DAYS = 7
_STRIP = " ,.;:\n،؛"

_ORDINALS = {
    "first": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "premier": 1, "deuxième": 2, "deuxieme": 2, "troisième": 3, "troisieme": 3, "quatrième": 4, "quatrieme": 4,
    "الأول": 1, "الاول": 1, "التاني": 2, "الثاني": 2, "التالت": 3, "الثالث": 3, "الرابع": 4,
    "awal": 1, "tene": 2, "tani": 2, "tenye": 2, "telet": 3,
}  # fmt: skip
#: Words that open a new day, with or without a number: "day 2", "second day", "the next day", "jour 3",
#: "اليوم التاني", "تاني يوم", "nhar el tene", "le lendemain".
_DAY_MARKER = re.compile(
    r"(?:^|[\s,.;:!?\n])(?P<marker>"
    r"(?:on\s+)?day\s+(?P<n1>\d|one|two|three|four|five|six|seven)"
    r"|(?:on\s+)?(?:the\s+)?(?P<n2>first|second|third|fourth|fifth|sixth|seventh)\s+day"
    r"|(?:the\s+)?next\s+day|the\s+day\s+after"
    r"|jour\s+(?P<n3>\d)|(?:le\s+)?(?P<n4>premier|deuxi[eè]me|troisi[eè]me|quatri[eè]me)\s+jour|le\s+lendemain"
    r"|(?:اليوم|نهار|يوم)\s+(?P<n5>الأول|الاول|التاني|الثاني|التالت|الثالث|الرابع|\d)"
    r"|(?P<n6>أول|اول|تاني|ثاني|تالت|ثالث)\s+يوم|(?:تاني|تانى)\s+نهار|اليوم\s+اللي\s+بعده|تاني\s+يوم"
    r"|(?:nhar|yom)\s+(?:el\s+)?(?P<n7>awal|tene|tani|tenye|telet|\d)"
    r")(?=[\s,.;:!?\n]|$)",
    re.IGNORECASE,
)
_AR_ORDINAL = {"أول": 1, "اول": 1, "تاني": 2, "ثاني": 2, "تالت": 3, "ثالث": 3}


def _day_number(match: re.Match[str]) -> int | None:
    for group in ("n1", "n2", "n3", "n4", "n5", "n7"):
        value = match.group(group)
        if value:
            return int(value) if value.isdigit() else _ORDINALS.get(value.casefold(), _ORDINALS.get(value))
    value = match.group("n6")
    return _AR_ORDINAL.get(value) if value else None


def split_days(text: str) -> list[str]:
    """The text of each day, in order - or one item when the request is a single day.

    Numbered days ("day 2") go where their number says; "the next day" follows the day before.
    """
    matches = list(_DAY_MARKER.finditer(text or ""))
    if not matches:
        return [text]
    lead = text[: matches[0].start("marker")].strip(_STRIP)
    days: dict[int, str] = {}
    previous = 0
    preamble = ""
    if lead:
        if _day_number(matches[0]) in {None, 2}:
            # "Museum then dinner. The next day, the beach": what comes first is day 1.
            days[1], previous = lead, 1
        else:
            # "We are 4, with a driver: day 1 ... day 2 ...": words for the whole trip.
            preamble = lead
    for index, match in enumerate(matches):
        end = matches[index + 1].start("marker") if index + 1 < len(matches) else len(text)
        body = text[match.end("marker") : end].strip(_STRIP)
        number = _day_number(match) or previous + 1
        if number < 1 or number > MAX_DAYS or not body:
            continue
        days[number] = f"{days[number]}, {body}" if number in days else body
        previous = number
    if len(days) < 2:
        return [text]
    ordered = [days[number] for number in sorted(days)]
    if preamble:
        ordered[0] = f"{preamble}: {ordered[0]}"
    return ordered


@dataclass
class TripPlan:
    days: list[DayPlan]
    outcomes: list[StepOutcome]
    plan: AssembledPlan
    pricing: DayPrice
    window_start: datetime
    return_by: datetime

    @property
    def by_id(self) -> dict[UUID, StepCandidate]:
        merged: dict[UUID, StepCandidate] = {}
        for day in self.days:
            merged.update(day.by_id)
        return merged

    def outcomes_json(self) -> list[dict[str, object]]:
        return [outcome.model_dump(mode="json") for outcome in self.outcomes]


def day_constraints(base: ExtractedConstraints, index: int, start: tuple[float, float] | None) -> ExtractedConstraints:
    """Day ``index`` (0-based): the same hours on a later date, starting where the last night was spent."""
    shift = timedelta(days=index)
    update: dict[str, object] = {}
    if base.window_start is not None:
        update["window_start"] = base.window_start + shift
    if base.return_by is not None:
        update["return_by"] = base.return_by + shift
    if start is not None:
        update["start_lat"], update["start_lng"] = start
    return base.model_copy(update=update)


def night_point(day: DayPlan) -> tuple[float, float] | None:
    """Where a day's night is spent, if it ends at a stay."""
    for outcome in reversed(day.outcomes):
        if (
            outcome.role == "stay"
            and outcome.status == "filled"
            and outcome.lat is not None
            and outcome.lng is not None
        ):
            return outcome.lat, outcome.lng
    return None


def merge_days(
    days: list[DayPlan], *, currency: str, party: int, budget: int | None, strict_budget: bool = False
) -> TripPlan:
    """One trip from its days: stops renumbered across days, legs and costs kept, one price."""
    stops: list[AssembledStop] = []
    legs: list[AssembledLeg] = []
    costs: list[CostItem] = []
    outcomes: list[StepOutcome] = []
    lines = []
    for number, day in enumerate(days, start=1):
        offset = len(stops)
        legs.extend(leg.model_copy(update={"position": leg.position + offset}) for leg in day.plan.legs)
        for stop in day.plan.stops:
            snapshot = {**stop.snapshot, "step": {**stop.snapshot.get("step", {}), "day": number}}
            stops.append(stop.model_copy(update={"position": len(stops) + 1, "snapshot": snapshot}))
        costs.extend(
            item.model_copy(update={"label": f"Day {number}: {item.label}"}) if len(days) > 1 else item
            for item in day.plan.cost_items
        )
        for outcome in day.outcomes:
            outcomes.append(outcome.model_copy(update={"day": number}))
        for line in day.pricing.lines:
            lines.append(line.model_copy(update={"day": number}))
    total = sum(stop.estimated_minor for stop in stops) + sum(item.amount_minor for item in costs)
    # The budget is for the whole trip, so a strict one is checked against the trip's total.
    needs_approval = bool(strict_budget and budget is not None and total > budget)
    plan = AssembledPlan(
        stops=stops,
        legs=legs,
        cost_items=costs,
        total_minor=total,
        currency=currency,
        budget_warning=(
            "This draft exceeds the strict budget. Approve the overage to continue, or tighten the plan."
            if needs_approval
            else None
        ),
        needs_budget_approval=needs_approval,
        infeasible=not stops,
        infeasible_reason=None if stops else "no_step_could_be_filled",
    )
    return TripPlan(
        days=days,
        outcomes=outcomes,
        plan=plan,
        pricing=price_day(lines, currency=currency, party=party, budget=budget),
        window_start=days[0].window_start,
        return_by=days[-1].return_by,
    )


def assemble_trip(
    scripts: list[DayScript],
    constraints: ExtractedConstraints,
    pools: list[DayPools],
    *,
    start_at_first_stop: bool = False,
) -> TripPlan:
    """Plan each day in turn; a day after a night away starts at that night's stay."""
    days: list[DayPlan] = []
    start: tuple[float, float] | None = None
    for index, (script, day_pools) in enumerate(zip(scripts, pools, strict=True)):
        day_limits = day_constraints(constraints, index, start)
        day = assemble_day(
            script.model_copy(update={"constraints": day_limits}),
            day_limits,
            day_pools,
            start_at_first_stop=start_at_first_stop and index == 0,
        )
        days.append(day)
        start = night_point(day)
    return merge_days(
        days,
        currency=constraints.currency,
        party=constraints.party_size or 1,
        budget=constraints.budget_minor,
        strict_budget=bool(constraints.strict_budget),
    )


__all__ = ["MAX_DAYS", "TripPlan", "assemble_trip", "day_constraints", "merge_days", "night_point", "split_days"]
