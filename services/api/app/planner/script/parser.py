"""Deterministic reader for multi-step days: text -> ``DayScript``.

This is the fallback (and CI) path of the v2 trip builder. It never calls a
model and never looks a business up; it only decides *what kinds of places*
the traveller asked for, in which order, and what surrounds the day (a driver,
a pickup, a return, a night away).

How a request is read:

1. It is split into clauses at punctuation and sequence words ("then",
   "بعدين", "ba3den", "ensuite") - see ``text.split_clauses``.
2. Each clause is matched against the concept vocabulary. Food words collapse
   into one meal step ("breakfast at a sweets place" is one step); places get
   a step each, unless they only describe the meal ("dinner by the sea").
3. "before" / "after" inside a clause reorder its steps, and can anchor on a
   step from an earlier clause ("... dinner. Before the cinema, a drink").
4. Times, durations, "maybe" and negations ("no hotel") annotate the steps.

Anything no rule understands is kept in ``DayScript.unparsed`` so the caller
can ask about it - it is never guessed.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import time

from app.planner.intent.catalogue import fold, match_destinations
from app.planner.intent.extractor import DESTINATION_CUES
from app.planner.schemas import MAX_SCRIPT_STEPS, DayScript, ExtractedConstraints, StepSpec
from app.planner.script.text import Hit, find_hits, find_phrase, is_joiner, split_clauses, token_forms, words
from app.planner.script.vocabulary import (
    ACCESSIBILITY_CUES,
    AFTER_WORDS,
    AIRPORT_CUES,
    BEFORE_WORDS,
    DIETARY_CUES,
    EVERYTHING_WORDS,
    FILLER_WORDS,
    FLEXIBLE_JOINERS,
    OPTIONAL_CUES,
)

#: When a meal is only mentioned as a moment ("after lunch, the museum").
_MEAL_MOMENT = {"breakfast": "morning", "brunch": "morning", "lunch": "afternoon", "dinner": "night"}
_MEAL_START = {"breakfast": time(10, 0), "brunch": time(12, 0), "lunch": time(14, 0), "dinner": time(21, 0)}
#: The part of the day a meal implies when the traveller gives no time.
_MEAL_TIME_OF_DAY = {"breakfast": "morning", "brunch": "morning", "lunch": "midday", "dinner": "evening"}
_LATE_MOMENTS = frozenset({"afternoon", "evening", "night"})
_ARRIVAL_WORDS = frozenset({"land", "landing", "arrive", "arriving", "start", "starting", "from", "pick", "pickup"})

_TIME_PREPOSITIONS = frozenset(
    {"at", "around", "by", "from", "until", "till", "before", "after", "vers", "a", "sa3a", "الساعة", "الساعه", "ع"}
)
_TIME_RE = re.compile(r"(?<![\d:])(\d{1,2})(?:[:h.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|h\b)?", re.IGNORECASE)
_NOT_A_TIME = re.compile(
    r"^\s*(people|persons?|pax|kids?|children|adults?|of us|hours?|hrs?|min|mins|minutes|days?|nights?|km|"
    r"\$|usd|dollars?|lbp|euros?|اشخاص|أشخاص|ساعات|ساعة|دولار|ولاد|personnes|heures|jours)",
    re.IGNORECASE,
)
_DURATION_RE = re.compile(
    r"(\d+(?:\.5)?|an?|one|two|three|half an?)\s*(hours?|hrs?|heures?|ساعات|ساعة|ساعه|minutes?|mins?|دقيقة|دقايق)",
    re.IGNORECASE,
)
_DURATION_WORDS = {"a": 1.0, "an": 1.0, "one": 1.0, "two": 2.0, "three": 3.0, "half a": 0.5, "half an": 0.5}
_QUICK_CUES = ("quick", "quickly", "short", "سريع", "سريعة", "rapide")
_PROPER_NAME_RE = re.compile(r"(?<![\w'’])([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,3})")
_NAMED_PLACE_RE = re.compile(
    r"(?<![\w])(?:at|chez|called|named)\s+((?:[A-Z][\w'’&-]*)(?:\s+(?:[A-Z][\w'’&-]*|al|el|de|du|la|le)){0,3})"
)


@dataclass
class _Draft:
    role: str
    position: int
    text: str
    tags: list[str] = field(default_factory=list)
    meal: str | None = None
    joined_before: bool = False
    destination_slug: str | None = None
    named_place: str | None = None
    at: time | None = None
    time_of_day: str | None = None
    duration_minutes: int | None = None
    sequence: str = "fixed"
    optional: bool = False

    def add_tags(self, *tags: str | None) -> None:
        for tag in tags:
            if tag and tag not in self.tags:
                self.tags.append(tag)

    def same_step(self, other: _Draft) -> bool:
        """Two drafts name the same step ("dinner" again, "the cinema" again)."""
        if self.role != other.role:
            return False
        if self.role == "meal" and self.meal and other.meal:
            return self.meal == other.meal
        return not self.tags or not other.tags or bool(set(self.tags) & set(other.tags))


@dataclass
class _Clause:
    text: str
    tokens: list[str]
    hits: list[Hit]
    destinations: list[str]
    drafts: list[_Draft] = field(default_factory=list)


@dataclass
class _Day:
    steps: list[_Draft] = field(default_factory=list)
    transport: str | None = None
    pickup_requested: bool = False
    pickup_place: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    return_destination: str | None = None
    no_overnight: bool = False
    avoid_tags: list[str] = field(default_factory=list)
    unparsed: list[str] = field(default_factory=list)
    destinations: list[str] = field(default_factory=list)

    def avoid(self, tag: str | None) -> None:
        if tag and tag not in self.avoid_tags:
            self.avoid_tags.append(tag)

    def find(self, draft: _Draft) -> int | None:
        for index, existing in enumerate(self.steps):
            if existing.same_step(draft):
                return index
        return None


# ---- Clause analysis ----


def _clause_destinations(clause: str, terms: list[tuple[str, str, int]] | None) -> list[str]:
    if terms:
        return match_destinations(clause, terms)
    forms = [token_forms(token) for token in words(clause)]
    return [slug for slug, cues in DESTINATION_CUES.items() if find_phrase(forms, tuple(cues)) is not None]


def _meal_draft(hits: list[Hit], clause: _Clause, day: _Day) -> _Draft | None:
    draft: _Draft | None = None
    for hit in hits:
        concept = hit.concept
        if concept.kind not in {"meal", "food"}:
            continue
        if hit.negated:
            day.avoid(concept.tag)
            continue
        if draft is None:
            draft = _Draft(role="meal", position=hit.start, text=clause.text, joined_before=hit.joined_before)
        if concept.meal and draft.meal is None:
            draft.meal = concept.meal
        draft.add_tags(concept.tag)
    return draft


def _joined_between(clause: _Clause, first: int, second: int) -> bool:
    low, high = sorted((first, second))
    return any(is_joiner(clause.tokens, position, FLEXIBLE_JOINERS) for position in range(low + 1, high + 1))


def _describes_meal(hit: Hit, clause: _Clause, meal: _Draft | None) -> bool:
    """ "Dinner by the sea" - the sea describes the dinner. "Lunch and the beach" - two steps."""
    return (
        meal is not None
        and hit.concept.modifier_tag is not None
        and not _joined_between(clause, meal.position, hit.start)
    )


def _merges_into(previous: _Draft | None, hit: Hit) -> bool:
    """Words for one place: "film at the cinema", "hike in the Qadisha valley", "hotel ... sleep"."""
    if previous is None:
        return False
    if previous.role == "stay" and hit.concept.kind == "stay":
        return True
    return not hit.joined_before and {previous.role, hit.concept.role or ""} <= {"sight", "activity"}


def _place_drafts(hits: list[Hit], clause: _Clause, meal: _Draft | None, day: _Day) -> list[_Draft]:
    """A step per place, merging words that describe the same place."""
    drafts: list[_Draft] = []
    for hit in hits:
        concept = hit.concept
        if concept.kind not in {"place", "exchange", "stay"}:
            continue
        if hit.negated:
            day.avoid(concept.tag)
            day.no_overnight = day.no_overnight or concept.kind == "stay"
            continue
        if _describes_meal(hit, clause, meal):
            assert meal is not None
            meal.add_tags(concept.modifier_tag)
            continue
        previous = drafts[-1] if drafts else None
        if previous is not None and _merges_into(previous, hit):
            if concept.role == "activity":
                previous.role = "activity"
            previous.add_tags(concept.tag, *concept.extra_tags)
            continue
        draft = _Draft(role=concept.role or "sight", position=hit.start, text=clause.text)
        draft.joined_before = hit.joined_before
        draft.add_tags(concept.tag, *concept.extra_tags)
        drafts.append(draft)
    return drafts


def _mark_flexible(drafts: list[_Draft]) -> None:
    for index, draft in enumerate(drafts):
        if index > 0 and draft.joined_before:
            draft.sequence = "flexible"
            drafts[index - 1].sequence = "flexible"


def _resolve_hour(hour: int, suffix: str, context: str | None) -> int:
    marker = suffix.replace(".", "").casefold()
    if marker == "pm" and hour < 12:
        return hour + 12
    if marker == "am":
        return 0 if hour == 12 else hour
    if hour < 12 and context in _LATE_MOMENTS and (hour <= 11):
        return hour + 12
    if hour <= 6 and context != "morning":
        return hour + 12
    return hour


def _clause_time(text: str, context: str | None) -> time | None:
    for match in _TIME_RE.finditer(text):
        hour, minutes, suffix = int(match.group(1)), match.group(2), match.group(3) or ""
        before = words(text[: match.start()])
        after = text[match.end() :]
        explicit = bool(minutes or suffix)
        if _NOT_A_TIME.match(after) or not (explicit or (before and before[-1] in _TIME_PREPOSITIONS)):
            continue
        if hour > 23 or (minutes and int(minutes) > 59):
            continue
        return time(_resolve_hour(hour, suffix, context) % 24, int(minutes or 0))
    return None


def _duration_minutes(text: str) -> int | None:
    folded = text.casefold()
    if "ساعتين" in folded:
        return 120
    if "نص ساعة" in folded or "نص ساعه" in folded:
        return 30
    match = _DURATION_RE.search(folded)
    if match:
        amount_text, unit = match.group(1), match.group(2)
        amount = _DURATION_WORDS.get(amount_text)
        value = amount if amount is not None else float(amount_text)
        minutes = value if unit.startswith(("min", "دق")) else value * 60
        return max(10, min(720, int(minutes)))
    if any(f" {cue} " in f" {folded} " for cue in _QUICK_CUES):
        return 30
    return None


def _time_of_day(hits: list[Hit]) -> str | None:
    for hit in hits:
        if hit.concept.kind == "time" and not hit.negated:
            return hit.concept.slug.removeprefix("time-")
    return None


def _annotate(clause: _Clause) -> None:
    """Times, durations, "maybe" and named places for the steps of one clause."""
    drafts = clause.drafts
    moment = _time_of_day(clause.hits)
    forms = [token_forms(token) for token in clause.tokens]
    optional = find_phrase(forms, OPTIONAL_CUES) is not None
    duration = _duration_minutes(clause.text)
    for draft in drafts:
        draft.time_of_day = moment or _MEAL_TIME_OF_DAY.get(draft.meal or "")
        draft.optional = optional
        draft.duration_minutes = duration
        if len(clause.destinations) == 1:
            draft.destination_slug = clause.destinations[0]
    if drafts:
        drafts[0].at = _clause_time(clause.text, drafts[0].time_of_day)


def _named_place(text: str, terms: list[tuple[str, str, int]] | None) -> tuple[str, int, int] | None:
    """A name the traveller gave ("at Al Soussi"), with its token span. Destinations are not names."""
    for match in _NAMED_PLACE_RE.finditer(text):
        name = match.group(1).strip()
        folded = fold(name).strip()
        if not folded or folded in FILLER_WORDS or _clause_destinations(name, terms):
            continue
        start = len(words(text[: match.start(1)]))
        return name[:120], start, start + len(words(name))
    return None


def _outside_name(hits: list[Hit], span: tuple[str, int, int] | None) -> list[Hit]:
    """Words inside a name ("Souk" in "Tawlet Souk el Tayeb") are not steps of their own -
    unless the name is all the clause says ("at Jeita Grotto"), where they describe it."""
    if span is None:
        return hits
    _name, start, end = span
    outside = [hit for hit in hits if not (start <= hit.start and hit.end <= end)]
    return outside if any(hit.concept.kind in _STEP_KINDS for hit in outside) else hits


def _attach_named_place(clause: _Clause, span: tuple[str, int, int] | None) -> None:
    if span is None or not clause.drafts:
        return
    name, _start, end = span
    owners = [draft for draft in clause.drafts if draft.position < end] or clause.drafts
    owners[-1].named_place = name


# ---- Day-wide signals ----


def _getting_around(clause: _Clause, day: _Day, kinds: set[str]) -> None:
    """Driver, pickup and airport: how the day starts, not a stop in it."""
    transport = next(
        (hit.concept.tag for hit in clause.hits if hit.concept.kind == "transport" and not hit.negated), None
    )
    if day.transport is None and transport:
        day.transport = transport
    if "pickup" in kinds:
        day.pickup_requested = True
    forms = [token_forms(token) for token in clause.tokens]
    if find_phrase(forms, AIRPORT_CUES) is not None:
        day.pickup_place = "airport"


def _day_times(clause: _Clause, day: _Day, kinds: set[str]) -> None:
    """A time outside any step: when the day starts, or - with "back" - when it ends."""
    if clause.drafts:
        return
    returning = "return" in kinds
    # "Back by 7" means the evening; a return is never planned for the early morning.
    at = _clause_time(clause.text, "evening" if returning else _time_of_day(clause.hits))
    if at is None:
        return
    if returning:
        day.end_time = at
    elif day.start_time is None or set(clause.tokens) & _ARRIVAL_WORDS:
        day.start_time = at


def _day_signals(clause: _Clause, day: _Day) -> None:
    kinds: set[str] = {hit.concept.kind for hit in clause.hits if not hit.negated}
    _getting_around(clause, day, kinds)
    _day_times(clause, day, kinds)
    if "return" in kinds:
        day.no_overnight = True
        if clause.destinations and not clause.drafts:
            day.return_destination = clause.destinations[0]
        return
    if not clause.drafts:
        day.destinations.extend(slug for slug in clause.destinations if slug not in day.destinations)


def _free_text_step(clause: _Clause) -> _Draft | None:
    """A clause that only names a place we have no word for ("the Corniche") becomes a sight to look up."""
    if clause.hits or clause.destinations:
        return None
    for match in _PROPER_NAME_RE.finditer(clause.text):
        name = match.group(1)
        if all(word in FILLER_WORDS for word in words(name)):
            continue
        position = len(words(clause.text[: match.start()]))
        if position == 0 and len(words(name)) == 1:
            continue  # A capital at the start of a sentence is not a name.
        return _Draft(role="sight", position=position, text=clause.text, named_place=name[:120])
    return None


def _is_unparsed(clause: _Clause) -> bool:
    if clause.hits or clause.destinations or clause.drafts:
        return False
    forms = [token_forms(token) for token in clause.tokens]
    if find_phrase(forms, AIRPORT_CUES) is not None or _clause_time(clause.text, None) is not None:
        return False
    content = [token for token in clause.tokens if token not in FILLER_WORDS and not token.isdigit() and len(token) > 1]
    return len(content) >= 2


# ---- Ordering ----


def _relation(clause: _Clause) -> tuple[str, int, bool] | None:
    """A "before" / "after" word outside any matched phrase, its position, and "before *everything*"."""
    covered = {position for hit in clause.hits for position in range(hit.start, hit.end)}
    for position, token in enumerate(clause.tokens):
        if position in covered:
            continue
        forms = token_forms(token)
        kind = "before" if forms & BEFORE_WORDS else "after" if forms & AFTER_WORDS else None
        if kind is None:
            continue
        following = clause.tokens[position + 1 : position + 4]
        everything = any(token_forms(item) & EVERYTHING_WORDS for item in following)
        return kind, position, everything
    return None


def _insert(day: _Day, index: int, drafts: list[_Draft]) -> None:
    day.steps[index:index] = drafts


def _place_after_anchor(day: _Day, anchor: _Draft, movers: list[_Draft], is_first_clause: bool) -> None:
    existing = day.find(anchor)
    if existing is not None:
        _insert(day, existing + 1, movers)
        return
    if anchor.role == "meal" and anchor.meal in _MEAL_MOMENT and movers:
        # "After lunch, the museum": the meal is a moment, not a stop to plan.
        for mover in movers:
            mover.time_of_day = mover.time_of_day or _MEAL_MOMENT[anchor.meal]
        if is_first_clause and day.start_time is None:
            day.start_time = _MEAL_START[anchor.meal]
        day.steps.extend(movers)
        return
    day.steps.extend([anchor, *movers])


def _place_before_anchor(day: _Day, anchor: _Draft, movers: list[_Draft]) -> None:
    existing = day.find(anchor)
    if existing is not None:
        _insert(day, existing, movers)
        return
    day.steps.extend([*movers, anchor])


def _add_clause(day: _Day, clause: _Clause, is_first_clause: bool) -> None:
    drafts = clause.drafts
    relation = _relation(clause) if drafts else None
    if relation is None:
        day.steps.extend(drafts)
        return
    kind, position, everything = relation
    if everything:
        if kind == "before":
            day.steps[0:0] = drafts
        else:
            day.steps.extend(drafts)
        return
    earlier = [draft for draft in drafts if draft.position < position]
    later = [draft for draft in drafts if draft.position > position]
    if not later:
        day.steps.extend(drafts)
        return
    anchor, rest = later[0], later[1:]
    if kind == "before":
        _place_before_anchor(day, anchor, earlier + rest)
    else:
        _place_after_anchor(day, anchor, earlier + rest, is_first_clause)


# ---- Assembly ----

_STEP_KINDS = frozenset({"meal", "food", "place", "exchange", "stay"})
_PARTY_RE = re.compile(
    r"(?:family|group|party|famille|groupe)\s+(?:of|de)\s+(\d{1,2})|(\d{1,2})\s*(?:of us|people|persons|adults|pax|"
    r"personnes|أشخاص|اشخاص|شخص)",
    re.IGNORECASE,
)


def _starts_with_relation(clause: str) -> bool:
    tokens = words(clause)
    return bool(tokens) and bool(token_forms(tokens[0]) & (BEFORE_WORDS | AFTER_WORDS))


def _join_leading_relations(clauses: list[str]) -> list[str]:
    """ "Before the museum, a coffee": the comma must not cut the relation from its step."""
    joined: list[str] = []
    index = 0
    while index < len(clauses):
        current = clauses[index]
        step_hits = [hit for hit in find_hits(words(current), FLEXIBLE_JOINERS) if hit.concept.kind in _STEP_KINDS]
        if index + 1 < len(clauses) and _starts_with_relation(current) and len(step_hits) <= 1:
            current = f"{current} {clauses[index + 1]}"
            index += 1
        joined.append(current)
        index += 1
    return joined


def _analyse(text: str, terms: list[tuple[str, str, int]] | None, day: _Day) -> _Clause:
    tokens = words(text)
    named = _named_place(text, terms)
    hits = _outside_name(find_hits(tokens, FLEXIBLE_JOINERS), named)
    clause = _Clause(text=text, tokens=tokens, hits=hits, destinations=_clause_destinations(text, terms))
    meal = _meal_draft(hits, clause, day)
    places = _place_drafts(hits, clause, meal, day)
    clause.drafts = sorted([*([meal] if meal else []), *places], key=lambda draft: draft.position)
    free_text = _free_text_step(clause)
    if free_text is not None:
        clause.drafts = [free_text]
    _mark_flexible(clause.drafts)
    _annotate(clause)
    _attach_named_place(clause, named)
    return clause


def _cues_in(forms: list[frozenset[str]], table: dict[str, tuple[str, ...]]) -> list[str]:
    return [slug for slug, cues in table.items() if find_phrase(forms, cues) is not None]


def prefer_locale_hint(detected: str, hint: str) -> str:
    """The app's locale wins over a coarse guess: "en" by default, or "ar" when the app says "ar-LB"."""
    if detected == "en" and hint in {"ar", "ar-LB", "fr", "mixed"}:
        return hint
    if detected == "ar" and hint == "ar-LB":
        return hint
    return detected


def day_constraints(text: str, locale: str, destinations: list[str]) -> ExtractedConstraints:
    """Day-wide constraints (party, budget, diet, access) from the whole request."""
    from app.planner.fixtures import stub_response

    constraints = ExtractedConstraints.model_validate(json.loads(stub_response(text, "extract")))
    constraints.locale = prefer_locale_hint(constraints.locale, locale)
    forms = [token_forms(token) for token in words(text)]
    constraints.dietary = list(dict.fromkeys([*constraints.dietary, *_cues_in(forms, DIETARY_CUES)]))
    constraints.accessibility = list(dict.fromkeys([*constraints.accessibility, *_cues_in(forms, ACCESSIBILITY_CUES)]))
    if constraints.party_size is None:
        match = _PARTY_RE.search(text)
        if match:
            size = int(match.group(1) or match.group(2))
            constraints.party_size = size if 1 <= size <= 20 else None
    merged = list(dict.fromkeys([*destinations, *constraints.destination_slugs]))
    constraints.destination_slugs = merged[:4]
    return constraints


def _step(draft: _Draft, order: int) -> StepSpec:
    return StepSpec(
        order=order,
        role=draft.role,
        tags=draft.tags,
        meal=draft.meal,
        named_place=draft.named_place,
        destination_slug=draft.destination_slug,
        at=draft.at,
        time_of_day=draft.time_of_day,
        duration_minutes=draft.duration_minutes,
        sequence=draft.sequence,
        optional=draft.optional,
        text=draft.text[:300],
    )


def parse_day_script(text: str, locale: str = "en", *, terms: list[tuple[str, str, int]] | None = None) -> DayScript:
    """Read a whole day from free text, without a model.

    ``terms`` is the catalogue's destination index (``destination_terms``); without it
    only the built-in destination names are recognised.
    """
    day = _Day()
    for index, raw_clause in enumerate(_join_leading_relations(split_clauses(text))):
        clause = _analyse(raw_clause, terms, day)
        _day_signals(clause, day)
        _add_clause(day, clause, is_first_clause=index == 0)
        for draft in clause.drafts:
            if draft.destination_slug and draft.destination_slug not in day.destinations:
                day.destinations.append(draft.destination_slug)
        if _is_unparsed(clause) and len(day.unparsed) < 8:
            day.unparsed.append(raw_clause[:120])
    if day.transport == "driver" and day.pickup_place is None:
        day.pickup_requested = True
    steps = [_step(draft, order) for order, draft in enumerate(day.steps[:MAX_SCRIPT_STEPS], start=1)]
    script = DayScript(
        constraints=day_constraints(text, locale, day.destinations),
        steps=steps,
        transport=day.transport,
        pickup_requested=day.pickup_requested,
        pickup_place=day.pickup_place,
        start_time=day.start_time,
        end_time=day.end_time,
        return_destination=day.return_destination,
        avoid_tags=day.avoid_tags,
        unparsed=day.unparsed,
    )
    if day.no_overnight and not any(step.role == "stay" for step in script.steps):
        script.ends_overnight = False
    return script


__all__ = ["day_constraints", "parse_day_script", "prefer_locale_hint"]
