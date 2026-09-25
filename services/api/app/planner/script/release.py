"""The release gate for the language dataset (plan, section 3.9; migration 050).

Before a set of approved phrases becomes a release (``intent-data-vN``), both
eval sets are read with those phrases loaded. A release is refused when either
falls below its gate, so a batch of approvals can never quietly make the
planner understand people worse.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.planner.script.evaluation import FIXTURE_PATH, evaluate
from app.planner.script.generated_eval import FIXTURE_PATH as GENERATED_PATH
from app.planner.script.parser import parse_day_script

STEP_GATE = 0.92
ORDER_GATE = 0.95


@dataclass(frozen=True)
class SetResult:
    name: str
    cases: int
    case_accuracy: float
    step_accuracy: float
    order_accuracy: float
    threshold: float
    failures: tuple[str, ...]

    @property
    def passes(self) -> bool:
        return (
            self.case_accuracy >= self.threshold
            and self.step_accuracy >= STEP_GATE
            and self.order_accuracy >= ORDER_GATE
        )


def _measure(name: str, path: Path) -> SetResult:
    report, threshold = evaluate(lambda prompt, locale: parse_day_script(prompt, locale), path)
    return SetResult(
        name=name,
        cases=report.cases,
        case_accuracy=round(report.case_accuracy, 4),
        step_accuracy=round(report.step_accuracy, 4),
        order_accuracy=round(report.order_accuracy, 4),
        threshold=threshold,
        failures=tuple(report.failures[:10]),
    )


def measure() -> tuple[bool, dict[str, Any]]:
    """Both eval sets with the phrases the reader holds now; (passes, metrics for the release row)."""
    results = [_measure("hand_written", FIXTURE_PATH), _measure("generated", GENERATED_PATH)]
    metrics = {
        result.name: {
            "cases": result.cases,
            "case_accuracy": result.case_accuracy,
            "step_accuracy": result.step_accuracy,
            "order_accuracy": result.order_accuracy,
            "passes": result.passes,
            "failures": list(result.failures),
        }
        for result in results
    }
    return all(result.passes for result in results), metrics


__all__ = ["ORDER_GATE", "STEP_GATE", "measure"]
