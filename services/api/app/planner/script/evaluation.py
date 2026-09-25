"""Scoring a DayScript reader against the labelled eval set.

Three numbers, as the v2 plan defines them (section 3.9):

* **case accuracy** - every expectation of a case holds (the release gate);
* **step accuracy** - share of expected steps read with the right role, meal and tags;
* **order accuracy** - share of cases whose sequence of roles is exactly right.

Expectations are partial on purpose: a case lists only what it tests, and a
step's ``tags`` must be *included* in what was read (a reader may add a tag).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

from app.planner.schemas import DayScript, StepSpec

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "day_scripts.json"
DEFAULT_THRESHOLD = 0.9

_STEP_FIELDS = ("role", "meal", "at", "time_of_day", "sequence", "optional", "duration_minutes", "named_place")
_SCRIPT_FIELDS = (
    "transport",
    "pickup_requested",
    "pickup_place",
    "start_time",
    "end_time",
    "return_destination",
    "ends_overnight",
)

Reader = Callable[[str, str], DayScript]


@dataclass
class EvalReport:
    cases: int = 0
    passed: int = 0
    steps_expected: int = 0
    steps_correct: int = 0
    order_correct: int = 0
    failures: list[str] = field(default_factory=list)

    @property
    def case_accuracy(self) -> float:
        return self.passed / self.cases if self.cases else 0.0

    @property
    def step_accuracy(self) -> float:
        return self.steps_correct / self.steps_expected if self.steps_expected else 0.0

    @property
    def order_accuracy(self) -> float:
        return self.order_correct / self.cases if self.cases else 0.0


def load_cases(path: Path = FIXTURE_PATH) -> dict[str, Any]:
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))


def _plain(value: Any) -> Any:
    return value.isoformat() if hasattr(value, "isoformat") else value


def step_matches(step: StepSpec, expected: dict[str, Any]) -> bool:
    for key in _STEP_FIELDS:
        if key in expected and _plain(getattr(step, key)) != expected[key]:
            return False
    return set(expected.get("tags", [])) <= set(step.tags)


def _script_problems(script: DayScript, expected: dict[str, Any]) -> list[str]:
    problems = [
        f"{key}={_plain(getattr(script, key))!r}"
        for key in _SCRIPT_FIELDS
        if key in expected and _plain(getattr(script, key)) != expected[key]
    ]
    constraints = script.constraints
    checks = {
        "destinations": set(expected.get("destinations", [])) <= set(constraints.destination_slugs),
        "dietary": set(expected.get("dietary", [])) <= set(constraints.dietary),
        "accessibility": set(expected.get("accessibility", [])) <= set(constraints.accessibility),
        "avoid_tags": set(expected.get("avoid_tags", [])) <= set(script.avoid_tags),
        "party_size": "party_size" not in expected or constraints.party_size == expected["party_size"],
        "unparsed_count": "unparsed_count" not in expected or len(script.unparsed) == expected["unparsed_count"],
    }
    problems.extend(name for name, ok in checks.items() if not ok)
    return problems


def _describe(script: DayScript) -> str:
    return " | ".join(f"{step.role}{'/' + step.meal if step.meal else ''}{step.tags}" for step in script.steps)


def score_case(script: DayScript, expected: dict[str, Any], report: EvalReport, case_id: str) -> None:
    wanted = expected.get("steps", [])
    report.cases += 1
    report.steps_expected += len(wanted)
    report.steps_correct += sum(
        1 for index, step in enumerate(wanted) if index < len(script.steps) and step_matches(script.steps[index], step)
    )
    if [step.role for step in script.steps] == [step["role"] for step in wanted]:
        report.order_correct += 1
    problems = _script_problems(script, expected)
    steps_ok = len(script.steps) == len(wanted) and all(
        step_matches(step, want) for step, want in zip(script.steps, wanted, strict=True)
    )
    if not steps_ok:
        problems.insert(0, f"steps: {_describe(script)}")
    if problems:
        report.failures.append(f"{case_id}: " + "; ".join(problems))
    else:
        report.passed += 1


def evaluate(reader: Reader, path: Path = FIXTURE_PATH) -> tuple[EvalReport, float]:
    payload = load_cases(path)
    report = EvalReport()
    for case in payload["cases"]:
        script = reader(case["prompt"], case.get("locale", "en"))
        score_case(script, case["expected"], report, case["id"])
    return report, float(payload.get("threshold", DEFAULT_THRESHOLD))


__all__ = ["DEFAULT_THRESHOLD", "EvalReport", "evaluate", "load_cases", "score_case", "step_matches"]
