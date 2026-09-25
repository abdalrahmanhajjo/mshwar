"""Build the planner's candidate phrases: a seed list plus generated spellings (migration 050).

Every row this produces is a *candidate*. The planner reads a phrase only after
staff approve it in the batch review at ``/admin/planner/language``; approving
is where native speakers keep what people really write and drop the rest.

Two sources:

* ``data/intent_seed_v1.json`` - phrases written per concept and locale for review.
* Generated spellings of those phrases and of the built-in cues - the ways the
  same word is typed in Lebanon: Arabizi digits and vowels (``7elwe``/``helwe``/
  ``7ilwe``), ``sh``/``ch``, Lebanese Arabic sounds (``ق`` said as ``أ``,
  ``ث`` as ``ت``/``س``, ``ذ`` as ``ز``/``د``, ``ظ`` as ``ض``), plurals.

A candidate is kept only when it adds something: the reader does not already
read it as that concept. One it already reads as *another* concept is kept
with a warning in its note, so the reviewer sees the clash.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any

from app.planner.script.evaluation import FIXTURE_PATH, EvalReport, load_cases, score_case
from app.planner.script.generated_eval import FIXTURE_PATH as GENERATED_PATH
from app.planner.script.parser import parse_day_script
from app.planner.script.text import find_hits, use_extra_phrases, words
from app.planner.script.vocabulary import (
    ALL_CONCEPTS,
    ARTICLES,
    FILLER_WORDS,
    FLEXIBLE_JOINERS,
    NEGATIONS,
    SEQUENCE_CONNECTORS,
    arabizi_variants,
)

SEED_PATH = Path(__file__).resolve().parent / "data" / "intent_seed_v1.json"
LOCALES = ("en", "ar-LB", "ar", "arabizi", "fr")

_ARABIZI_VOWELS = ("a", "e", "i")
_ARABIZI_DIGITS = frozenset("235789")
_ARABIZI_PAIRS = (("sh", "ch"), ("ou", "u"), ("ou", "o"), ("ee", "i"), ("kh", "5"), ("gh", "8"))
#: Never offered as a candidate, whatever it is a spelling of: words that are rude, or that the reader
#: must not take as a place ("boutique hotel" is not shopping). Reviewers can still add phrases by hand.
BLOCKED: frozenset[str] = frozenset(
    {"kis", "kes", "ks", "boutique", "air", "ayr", "zeb", "sharmouta", "manyak", "khara", "5ara", "tiz", "teez"}
)
#: Lebanese Arabic writes some letters as it says them.
_ARABIC_SOUNDS = (("ق", "أ"), ("ث", "ت"), ("ث", "س"), ("ذ", "ز"), ("ذ", "د"), ("ظ", "ض"))


def reads_as(phrase: str) -> set[str]:
    """The concepts the reader finds in a phrase today (seed vocabulary plus approved phrases)."""
    return {hit.concept.slug for hit in find_hits(words(phrase), FLEXIBLE_JOINERS)}


def _arabizi_spellings(phrase: str) -> set[str]:
    found = set(arabizi_variants(phrase))
    for a, b in _ARABIZI_PAIRS:
        for source, target in ((a, b), (b, a)):
            if source in phrase:
                found.add(phrase.replace(source, target, 1))
    # One vowel changed at a time, only inside a clearly Arabizi word (one with a digit, 5 letters or more):
    # "mat7af" -> "mit7af", "ka3ke" -> "ke3ke". English words in the phrase are left alone.
    parts = phrase.split(" ")
    for position, word in enumerate(parts):
        if len(word) < 5 or not _ARABIZI_DIGITS & set(word):
            continue
        for index, char in enumerate(word):
            if char in _ARABIZI_VOWELS and 0 < index < len(word) - 1:
                for other in _ARABIZI_VOWELS:
                    if other != char:
                        changed = word[:index] + other + word[index + 1 :]
                        found.add(" ".join([*parts[:position], changed, *parts[position + 1 :]]))
    return found


def _arabic_spellings(phrase: str, *, spoken: bool) -> set[str]:
    """``spoken``: Lebanese Arabic, written as it is said. Standard Arabic keeps its letters."""
    found: set[str] = set()
    for letter, sound in _ARABIC_SOUNDS if spoken else ():
        if letter in phrase:
            found.add(phrase.replace(letter, sound))
    parts = phrase.split()
    if len(parts) == 1:
        found.add(phrase[2:] if phrase.startswith("ال") and len(phrase) > 4 else f"ال{phrase}")
    return found


def _latin_spellings(phrase: str) -> set[str]:
    found: set[str] = set()
    if " " not in phrase and phrase.isalpha():  # plurals of single words only: not "drop us backs"
        found.add(phrase[:-1] if phrase.endswith("s") and len(phrase) > 4 else f"{phrase}s")
    for a, b in (("theatre", "theater"), ("'", " "), ("-", " ")):
        if a in phrase:
            found.add(phrase.replace(a, b))
    return found


def spellings(phrase: str, locale: str) -> set[str]:
    """Other ways the same phrase is typed, in its locale. Never includes the phrase itself."""
    if locale == "arabizi":
        found = _arabizi_spellings(phrase)
    elif locale in {"ar", "ar-LB"}:
        found = _arabic_spellings(phrase, spoken=locale == "ar-LB")
    else:
        found = _latin_spellings(phrase)
    return {
        item.strip()
        for item in found
        if item.strip() != phrase and len(item.strip()) >= 3 and not BLOCKED & set(item.casefold().split())
    }


def _locale_of_cue(cue: str) -> str | None:
    """The built-in cues mix English and French, so only Arabic script and Arabizi get spellings."""
    if any("\u0600" <= char <= "\u06ff" for char in cue):
        return "ar-LB"
    return "arabizi" if any(char.isdigit() for char in cue) else None


def seed_phrases(path: Path = SEED_PATH) -> Iterator[tuple[str, str, str]]:
    """(phrase, concept, locale) from the reviewed-for-writing seed file."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    for concept, by_locale in payload["concepts"].items():
        for locale, phrases in by_locale.items():
            for phrase in phrases:
                yield phrase.strip(), concept, locale


def _row(phrase: str, concept: str, locale: str, source: str, batch: str, origin: str, how: str) -> dict[str, Any]:
    others = sorted(reads_as(phrase) - {concept})
    note = how
    if others:
        note = f"{how}; also reads as {', '.join(others)}".strip("; ")
    return {
        "phrase": phrase,
        "concept": concept,
        "locale": locale,
        "source": source,
        "batch": batch,
        "variant_of": origin if source == "generated_variant" else "",
        "note": note[:200],
    }


def _adds_coverage(phrase: str, concept: str) -> bool:
    return concept not in reads_as(phrase)


def build_candidates(
    batch: str = "seed-v1", seeds: Iterable[tuple[str, str, str]] | None = None, *, with_cues: bool = True
) -> list[dict[str, Any]]:
    """Every candidate worth a reviewer's time: new to the reader for its concept, deduplicated.

    ``with_cues``: also spell out the built-in cues (the full build); tests pass False for speed.
    """
    rows: dict[tuple[str, str], dict[str, Any]] = {}
    written = list(seeds if seeds is not None else seed_phrases())
    for phrase, concept, locale in written:
        if _adds_coverage(phrase, concept) and not BLOCKED & set(phrase.casefold().split()):
            rows.setdefault((phrase.casefold(), concept), _row(phrase, concept, locale, "seed", batch, "", ""))
    # Spellings of what was written and of the built-in cues.
    cues = ((cue, concept.slug, _locale_of_cue(cue)) for concept in ALL_CONCEPTS for cue in concept.cues)
    sources = [*written, *((cue, slug, locale) for cue, slug, locale in cues if locale and with_cues)]
    for phrase, concept, locale in sources:
        for variant in sorted(spellings(phrase, locale)):
            key = (variant.casefold(), concept)
            if key in rows or not _adds_coverage(variant, concept):
                continue
            rows[key] = _row(variant, concept, locale, "generated_variant", batch, phrase, f"spelling of {phrase}")
    return sorted(rows.values(), key=lambda row: (row["concept"], row["locale"], row["source"], row["phrase"]))


def _function_word(phrase: str) -> bool:
    """A phrase made only of little words ("the", "on", "et") would fire on almost every request."""
    little = FILLER_WORDS | ARTICLES | FLEXIBLE_JOINERS | NEGATIONS | frozenset(SEQUENCE_CONNECTORS)
    parts = words(phrase)
    return not parts or all(part in little or len(part) < 3 for part in parts)


def _eval_cases() -> list[dict[str, Any]]:
    return [*load_cases(FIXTURE_PATH)["cases"], *load_cases(GENERATED_PATH)["cases"]]


def _passes(case: dict[str, Any]) -> bool:
    report = EvalReport()
    score_case(parse_day_script(case["prompt"], case.get("locale", "en")), case["expected"], report, case["id"])
    return report.passed == 1


def screen(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(kept, dropped): a candidate is dropped when it is only little words, or when adding it alone
    breaks an eval prompt that passes today. Only the prompts that contain its words are re-read."""
    cases = _eval_cases()
    folded = [" ".join(words(case["prompt"])) for case in cases]
    baseline: dict[int, bool] = {}
    kept: list[dict[str, Any]] = []
    dropped: list[dict[str, Any]] = []
    try:
        for row in rows:
            if _function_word(row["phrase"]):
                dropped.append({**row, "why": "only little words"})
                continue
            needle = f" {' '.join(words(row['phrase']))} "
            touched = [index for index, text in enumerate(folded) if needle in f" {text} "]
            for index in touched:
                if index not in baseline:
                    use_extra_phrases(())
                    baseline[index] = _passes(cases[index])
            use_extra_phrases(((row["phrase"], row["concept"]),))
            broken = [cases[index]["id"] for index in touched if baseline[index] and not _passes(cases[index])]
            if broken:
                dropped.append({**row, "why": f"breaks {len(broken)} eval prompt(s): {', '.join(broken[:3])}"})
            else:
                kept.append(row)
    finally:
        use_extra_phrases(())
    return kept, dropped


def summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by: dict[str, dict[str, int]] = {"source": {}, "locale": {}}
    for row in rows:
        for key in by:
            by[key][row[key]] = by[key].get(row[key], 0) + 1
    clashes = sum(1 for row in rows if "also reads as" in row["note"])
    return {"total": len(rows), **by, "clashes_flagged": clashes}


__all__ = [
    "BLOCKED",
    "LOCALES",
    "SEED_PATH",
    "build_candidates",
    "reads_as",
    "screen",
    "seed_phrases",
    "spellings",
    "summary",
]
