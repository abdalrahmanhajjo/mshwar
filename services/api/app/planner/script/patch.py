"""Editing a planned day one step at a time (trip builder v2, phase 6).

"Swap bowling for karting", "move the cinema before dinner", "add lunch after
the mountain", "remove the hotel" - in English, Lebanese Arabic, Arabizi or
French. Each edit names steps the way the traveller would, and is matched to the
steps of the saved day by kind (role, meal, tags), never by guessing. An edit we
cannot match is reported as not understood; nothing else changes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from app.planner.schemas import MAX_SCRIPT_STEPS, DayScript, StepSpec
from app.planner.script.parser import parse_day_script

Op = Literal["add", "remove", "replace", "move"]

_BEFORE = r"before|قبل|avant|abel|2abel"
_AFTER = r"after|بعد|après|apres|ba3d"
_RAW_PATTERNS: tuple[tuple[Op, str], ...] = (
    ("replace", r"^(?:swap|replace|change|switch)\s+(?P<a>.+?)\s+(?:for|with|to|by|into)\s+(?P<b>.+)$"),
    ("replace", r"^(?P<b>.+?)\s+instead of\s+(?P<a>.+)$"),
    ("replace", r"^(?:remplace|remplacer|change|changer)\s+(?P<a>.+?)\s+par\s+(?P<b>.+)$"),
    ("replace", r"^(?:بدل|بدّل|غير|غيّر)\s+(?P<a>.+?)\s+(?:ب|بـ|حط|حطّ|و حط)\s*(?P<b>.+)$"),
    ("replace", r"^(?:badel|ghayer|ghayyer)\s+(?P<a>.+?)\s+(?:b|bi|7ot)\s+(?P<b>.+)$"),
    ("move", rf"^(?:move|put|do)\s+(?P<a>.+?)\s+(?P<rel>{_BEFORE}|{_AFTER})\s+(?P<b>.+)$"),
    ("move", rf"^(?:mets|mettre|déplace|deplace|déplacer)\s+(?P<a>.+?)\s+(?P<rel>{_BEFORE}|{_AFTER})\s+(?P<b>.+)$"),
    ("move", rf"^(?:حط|حطّ|خلي|خلّي|نقل)\s+(?P<a>.+?)\s+(?P<rel>{_BEFORE}|{_AFTER})\s+(?P<b>.+)$"),
    ("add", rf"^(?:add|also|include|plus|and)\s+(?P<a>.+?)\s+(?P<rel>{_BEFORE}|{_AFTER})\s+(?P<b>.+)$"),
    ("add", rf"^(?:ajoute|ajouter|rajoute)\s+(?P<a>.+?)\s+(?P<rel>{_BEFORE}|{_AFTER})\s+(?P<b>.+)$"),
    ("add", rf"^(?:زيد|زيّد|ضيف|ضيّف|أضف|اضف)\s+(?P<a>.+?)\s+(?P<rel>{_BEFORE}|{_AFTER})\s+(?P<b>.+)$"),
    ("add", r"^(?:add|also|include|plus|ajoute|ajouter|rajoute|زيد|زيّد|ضيف|ضيّف|أضف|اضف|zid|dayef)\s+(?P<a>.+)$"),
    ("remove", r"^(?:remove|drop|skip|delete|cancel|no|without|forget)\s+(?:the\s+)?(?P<a>.+)$"),
    ("remove", r"^(?:enlève|enleve|enlever|supprime|supprimer|retire|retirer|pas de|sans)\s+(?P<a>.+)$"),
    ("remove", r"^(?:شيل|شيلي|بلا|بدون|ألغي|الغي|إلغ|ما بدي)\s+(?P<a>.+)$"),
    ("remove", r"^(?:shil|bala|bidoun|ma badde)\s+(?P<a>.+)$"),
)
_PATTERNS: tuple[tuple[Op, re.Pattern[str]], ...] = tuple(
    (op, re.compile(pattern, re.IGNORECASE)) for op, pattern in _RAW_PATTERNS
)
_NEW_STEP_ORDER = 1000
_SPLIT = re.compile(r"\s*(?:;|,|\bthen\b|\band then\b|\bpuis\b|\bensuite\b|بعدين|ثم)\s*", re.IGNORECASE)


@dataclass(frozen=True)
class StepPatch:
    op: Op
    target: int | None = None  # order of the step edited (remove, replace, move) or the anchor (add)
    relation: Literal["before", "after"] | None = None
    anchor: int | None = None
    step: StepSpec | None = None  # the new step (add, replace)
    summary: str = ""


@dataclass
class PatchResult:
    understood: bool
    script: DayScript
    patches: list[StepPatch] = field(default_factory=list)
    not_understood: list[str] = field(default_factory=list)

    @property
    def summary(self) -> str:
        return "; ".join(patch.summary for patch in self.patches)


def _probe(phrase: str) -> StepSpec | None:
    """The step a few words describe ("the cinema", "a sweets breakfast"), read like any request."""
    steps = parse_day_script(phrase).steps
    return steps[0] if steps else None


def _matches(step: StepSpec, probe: StepSpec) -> bool:
    if step.role != probe.role:
        return False
    if probe.meal and step.meal:
        return probe.meal == step.meal
    return not probe.tags or bool(set(step.tags) & set(probe.tags))


def _find(script: DayScript, phrase: str) -> int | None:
    probe = _probe(phrase)
    if probe is None:
        return None
    return next((step.order for step in script.steps if _matches(step, probe)), None)


def _label(step: StepSpec) -> str:
    return step.meal or (step.tags[0].replace("-", " ") if step.tags else step.role)


def _relation(word: str | None) -> Literal["before", "after"] | None:
    if word is None:
        return None
    return "before" if re.fullmatch(_BEFORE, word, re.IGNORECASE) else "after"


def _read_one(clause: str, script: DayScript) -> StepPatch | None:
    for op, pattern in _PATTERNS:
        match = pattern.match(clause.strip())
        if match is None:
            continue
        groups = match.groupdict()
        relation = _relation(groups.get("rel"))
        if op == "remove":
            target = _find(script, groups["a"])
            return StepPatch("remove", target=target, summary=f"removed {groups['a'].strip()}") if target else None
        if op == "replace":
            target, new = _find(script, groups["a"]), _probe(groups["b"])
            if target is None or new is None:
                return None
            return StepPatch("replace", target=target, step=new, summary=f"{groups['a'].strip()} → {_label(new)}")
        if op == "move":
            target, anchor = _find(script, groups["a"]), _find(script, groups["b"])
            if target is None or anchor is None or target == anchor or relation is None:
                return None
            return StepPatch(
                "move",
                target=target,
                relation=relation,
                anchor=anchor,
                summary=f"moved {groups['a'].strip()} {relation} {groups['b'].strip()}",
            )
        new = _probe(groups["a"])
        if new is None:
            return None
        anchor = _find(script, groups["b"]) if groups.get("b") else None
        if groups.get("b") and anchor is None:
            return None
        return StepPatch("add", step=new, relation=relation, anchor=anchor, summary=f"added {_label(new)}")
    return None


def _apply(steps: list[StepSpec], patch: StepPatch) -> list[StepSpec]:
    by_order = {step.order: step for step in steps}
    if patch.op == "remove":
        return [step for step in steps if step.order != patch.target]
    if patch.op == "replace":
        assert patch.step is not None
        return [
            patch.step.model_copy(update={"order": step.order}) if step.order == patch.target else step
            for step in steps
        ]
    moved = by_order.get(patch.target or 0) if patch.op == "move" else patch.step
    assert moved is not None
    if patch.op == "add":
        # A number no other step has while edits are applied; everything is renumbered at the end.
        moved = moved.model_copy(update={"order": _NEW_STEP_ORDER + len(steps)})
    rest = [step for step in steps if patch.op != "move" or step.order != patch.target]
    if patch.anchor is None:
        # "Add a museum": at the end of the day, before a night away (the schema keeps a stay last).
        return [*rest, moved]
    index = next(i for i, step in enumerate(rest) if step.order == patch.anchor)
    at = index if patch.relation == "before" else index + 1
    return [*rest[:at], moved, *rest[at:]]


def patch_day(script: DayScript, text: str) -> PatchResult:
    """Apply the step edits in ``text`` to a saved day. Understood only if every edit matched a step."""
    patches: list[StepPatch] = []
    missed: list[str] = []
    for clause in (piece for piece in _SPLIT.split(text or "") if piece.strip()):
        patch = _read_one(clause, script)
        if patch is None:
            missed.append(clause.strip())
        else:
            patches.append(patch)
    if not patches or missed:
        return PatchResult(understood=False, script=script, not_understood=missed or [text.strip()])
    steps = list(script.steps)
    for patch in patches:
        steps = _apply(steps, patch)
    if len(steps) > MAX_SCRIPT_STEPS:
        return PatchResult(
            understood=False, script=script, not_understood=[f"a day has at most {MAX_SCRIPT_STEPS} steps"]
        )
    # Renumber in the new order; a stay still ends the day, and no stay means no night away.
    renumbered = [step.model_copy(update={"order": index}) for index, step in enumerate(steps, start=1)]
    edited = DayScript.model_validate(
        {
            **script.model_dump(exclude={"steps", "ends_overnight"}),
            "steps": [step.model_dump() for step in renumbered],
            "ends_overnight": any(step.role == "stay" for step in renumbered),
        }
    )
    return PatchResult(understood=True, script=edited, patches=patches)


__all__ = ["PatchResult", "StepPatch", "patch_day"]
