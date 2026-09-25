"""Splitting a request into clauses and finding the concepts each clause names.

Matching is literal and deterministic: a phrase matches when its folded words
appear in order. Three things widen it without guessing:

* Arabic proclitics are peeled off ("وبالسينما" -> "سينما", "عالبحر" -> "بحر");
* an English plural "s" is optional;
* a single Latin word of five letters or more may be one typo away from a cue
  ("bowlling", "resturant") - never a two-letter guess, never in Arabic script.

When two phrases overlap, the longer one wins, so "bed and breakfast" is a stay,
not a breakfast, and "صراف آلي" is an ATM, not a money changer.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from functools import lru_cache

from app.planner.intent.catalogue import fold
from app.planner.script.vocabulary import (
    ALL_CONCEPTS,
    ARTICLES,
    FUZZY_BLOCKLIST,
    NEGATIONS,
    SEQUENCE_CONNECTORS,
    Concept,
    cue_phrases,
)

#: Lebanese and MSA proclitics, longest first. "عال" is the Lebanese "on the".
_ARABIC_PREFIXES = ("بال", "وال", "فال", "كال", "عال", "لل", "ال", "ب", "ل", "ك", "ف", "و", "ع")
_FUZZY_MIN_LENGTH = 5
_FUZZY_RATIO = 0.86
_NEGATION_WINDOW = 3

_PUNCTUATION_SPLIT = re.compile(r"[,;!?\n،؛…]+|\.(?=\s|$)|->|→|=>|\s[-–—]\s|(?:^|\s)\d{1,2}[.)](?=\s)")


@dataclass(frozen=True)
class Hit:
    concept: Concept
    start: int
    end: int
    #: The clause said "and" / "w" / "et" (or a "و" proclitic) right before this phrase.
    joined_before: bool = False
    negated: bool = False


def words(value: str) -> list[str]:
    return fold(value).split()


def _is_arabic(word: str) -> bool:
    return bool(word) and "؀" <= word[0] <= "ۿ"


def token_forms(token: str) -> frozenset[str]:
    """The token itself plus the forms a cue may be written in."""
    forms = {token}
    if _is_arabic(token):
        current = token
        for _round in range(2):
            prefix = next((item for item in _ARABIC_PREFIXES if current.startswith(item)), None)
            if prefix is None or len(current) - len(prefix) < 2:
                break
            current = current[len(prefix) :]
            forms.add(current)
    elif len(token) > 4 and token.endswith("s"):
        forms.add(token[:-1])
    return frozenset(forms)


#: Staff-approved phrases (migration 048) as (phrase, concept slug): extend the seed vocabulary.
_extra_phrases: tuple[tuple[str, str], ...] = ()


def use_extra_phrases(pairs: tuple[tuple[str, str], ...]) -> None:
    """Read with these approved phrases too. Unknown concepts are ignored."""
    global _extra_phrases
    if pairs != _extra_phrases:
        _extra_phrases = pairs
        _cue_index.cache_clear()


def _phrases_of(concept: Concept) -> list[str]:
    extra = [phrase for phrase, slug in _extra_phrases if slug == concept.slug]
    return [*cue_phrases(concept), *extra]


@lru_cache(maxsize=1)
def _cue_index() -> tuple[dict[str, tuple[tuple[tuple[str, ...], Concept], ...]], tuple[tuple[str, Concept], ...]]:
    """First word -> (all words, concept); plus single Latin words eligible for typo matching."""
    by_first: dict[str, list[tuple[tuple[str, ...], Concept]]] = {}
    fuzzy: dict[str, Concept] = {}
    for concept in ALL_CONCEPTS:
        for phrase in _phrases_of(concept):
            parts = tuple(words(phrase))
            if not parts:
                continue
            bucket = by_first.setdefault(parts[0], [])
            if all(existing != parts for existing, _concept in bucket):
                bucket.append((parts, concept))
            if len(parts) == 1 and len(parts[0]) >= _FUZZY_MIN_LENGTH and parts[0].isascii() and parts[0].isalpha():
                fuzzy.setdefault(parts[0], concept)
    frozen = {key: tuple(value) for key, value in by_first.items()}
    return frozen, tuple(fuzzy.items())


@lru_cache(maxsize=1)
def _negation_tokens() -> frozenset[str]:
    return frozenset(parts[0] for parts in (words(item) for item in NEGATIONS) if parts)


def match_at(forms: list[frozenset[str]], start: int, phrase: tuple[str, ...]) -> bool:
    if start + len(phrase) > len(forms):
        return False
    return all(part in forms[start + offset] for offset, part in enumerate(phrase))


def find_phrase(forms: list[frozenset[str]], phrases: tuple[str, ...]) -> int | None:
    """Index of the first place any of ``phrases`` appears, or None."""
    folded = [tuple(words(phrase)) for phrase in phrases]
    for start in range(len(forms)):
        for phrase in folded:
            if phrase and match_at(forms, start, phrase):
                return start
    return None


def _exact_candidates(forms: list[frozenset[str]]) -> list[tuple[int, int, Concept]]:
    index, _fuzzy = _cue_index()
    found: list[tuple[int, int, Concept]] = []
    for start, token_set in enumerate(forms):
        for form in token_set:
            for phrase, concept in index.get(form, ()):
                if match_at(forms, start, phrase):
                    found.append((start, start + len(phrase), concept))
    return found


def _fuzzy_candidates(tokens: list[str], covered: set[int]) -> list[tuple[int, int, Concept]]:
    _index, fuzzy = _cue_index()
    found: list[tuple[int, int, Concept]] = []
    for position, token in enumerate(tokens):
        if position in covered or token in FUZZY_BLOCKLIST or len(token) < _FUZZY_MIN_LENGTH:
            continue
        if not (token.isascii() and token.isalpha()):
            continue
        best: tuple[float, Concept] | None = None
        for cue, concept in fuzzy:
            if abs(len(cue) - len(token)) > 2:
                continue
            ratio = SequenceMatcher(None, token, cue).ratio()
            if ratio >= _FUZZY_RATIO and (best is None or ratio > best[0]):
                best = (ratio, concept)
        if best is not None:
            found.append((position, position + 1, best[1]))
    return found


def _longest_first(candidates: list[tuple[int, int, Concept]]) -> list[tuple[int, int, Concept]]:
    order = {concept.slug: rank for rank, concept in enumerate(ALL_CONCEPTS)}
    ranked = sorted(candidates, key=lambda item: (-(item[1] - item[0]), item[0], order[item[2].slug]))
    taken: set[int] = set()
    kept: list[tuple[int, int, Concept]] = []
    for start, end, concept in ranked:
        span = set(range(start, end))
        if span & taken:
            continue
        taken |= span
        kept.append((start, end, concept))
    return sorted(kept, key=lambda item: item[0])


def is_joiner(tokens: list[str], position: int, joiners: frozenset[str]) -> bool:
    """An "and" right before ``position``, looking past articles ("and *a* movie")."""
    token = tokens[position]
    if _is_arabic(token) and token.startswith("و") and not token.startswith(("وادي", "وسط")):
        return True
    cursor = position - 1
    while cursor >= 0 and tokens[cursor] in ARTICLES:
        cursor -= 1
    return cursor >= 0 and tokens[cursor] in joiners


def _negated(tokens: list[str], start: int) -> bool:
    window = tokens[max(0, start - _NEGATION_WINDOW) : start]
    return any(token in _negation_tokens() for token in window)


def find_hits(tokens: list[str], joiners: frozenset[str]) -> list[Hit]:
    """Concepts named in a clause, left to right, without overlaps."""
    forms = [token_forms(token) for token in tokens]
    exact = _exact_candidates(forms)
    covered = {position for start, end, _concept in exact for position in range(start, end)}
    candidates = exact + _fuzzy_candidates(tokens, covered)
    return [
        Hit(
            concept=concept,
            start=start,
            end=end,
            joined_before=is_joiner(tokens, start, joiners),
            negated=_negated(tokens, start),
        )
        for start, end, concept in _longest_first(candidates)
    ]


@lru_cache(maxsize=1)
def _connector_pattern() -> re.Pattern[str]:
    ordered = sorted(SEQUENCE_CONNECTORS, key=len, reverse=True)
    alternatives = "|".join(re.escape(item) for item in ordered)
    return re.compile(rf"(?<![\w'’])(?:{alternatives})(?![\w'’])", re.IGNORECASE)


def split_clauses(text: str) -> list[str]:
    """Break a request at punctuation and at sequence words ("then", "بعدين", "ensuite")."""
    clauses: list[str] = []
    for segment in _PUNCTUATION_SPLIT.split(text or ""):
        for piece in _connector_pattern().split(segment):
            cleaned = piece.strip(" \t-–—:")
            if cleaned:
                clauses.append(cleaned)
    return clauses


__all__ = [
    "Hit",
    "find_hits",
    "find_phrase",
    "is_joiner",
    "match_at",
    "split_clauses",
    "token_forms",
    "use_extra_phrases",
    "words",
]
