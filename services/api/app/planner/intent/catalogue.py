"""Resolve the places a traveller actually named, from the catalogue itself.

A language model - or the deterministic extractor standing in for one - can only
name a destination it was told about. Mshwar used a hardcoded list of seven
aliases, so "a day in Tripoli" or "صيدا" produced no anchor at all and the
builder asked the same clarifying question forever.

This module asks the database instead. ``app.planner_destination_terms()``
returns every name a destination answers to: its own name in each locale, its
region, its venues, and the titles of the published places inside it. A town
becomes answerable the moment its first place is published, with no prompt or
code change.

Matching is deliberately literal - a folded substring on a word boundary. It
never guesses a destination the traveller did not name; when nothing matches,
the caller falls back to the whole country rather than inventing a town.
"""

from __future__ import annotations

import functools
import json
import re
import time
import unicodedata

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.planner.schemas import ExtractedConstraints

#: The catalogue changes on publish, not per request; a minute is fresh enough.
TERMS_TTL_SECONDS = 60.0
#: A destination can be named many ways; a day only needs a handful of anchors.
MAX_RESOLVED_DESTINATIONS = 4

_ARABIC_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]")
_NON_WORD = re.compile(r"[^0-9a-z؀-ۿ]+")

#: Transliteration variants the catalogue will not carry in every spelling.
#: These expand the *search*, they do not name a destination - the catalogue
#: still decides which one (if any) the variant lands in.
VARIANTS: dict[str, tuple[str, ...]] = {
    "saida": ("sidon", "صيدا"),
    "sidon": ("saida", "صيدا"),
    "sour": ("tyre", "صور"),
    "tyre": ("sour", "صور"),
    "jbeil": ("byblos", "جبيل"),
    "byblos": ("jbeil", "جبيل"),
    "tripoli": ("trablous", "طرابلس"),
    "trablous": ("tripoli", "طرابلس"),
    "bcharre": ("bsharri", "bcharri", "بشري"),
    "bsharri": ("bcharre", "بشري"),
    "beqaa": ("bekaa", "bequaa", "البقاع"),
    "bekaa": ("beqaa", "البقاع"),
    "jounieh": ("juniyah", "جونية"),
    "zahle": ("zahleh", "زحلة"),
    "beyrouth": ("beirut", "بيروت"),
    "beirut": ("beyrouth", "بيروت"),
}

_cache: tuple[float, list[tuple[str, str, int]]] | None = None


def fold(value: str) -> str:
    """Casefold, strip accents and Arabic diacritics, and flatten punctuation.

    "Vallée de Qadisha", "vallee de qadisha" and "VALLEE  DE  QADISHA" all fold
    to the same string, as do the alef forms of an Arabic name.
    """
    lowered = unicodedata.normalize("NFKD", value.casefold())
    without_accents = "".join(char for char in lowered if not unicodedata.combining(char) or "؀" <= char <= "ۿ")
    stripped = _ARABIC_DIACRITICS.sub("", without_accents)
    unified = stripped.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    return f" {_NON_WORD.sub(' ', unified).strip()} "


#: Words that describe a kind of place rather than name one. They may appear in a
#: catalogue term ("Sidon Sea Castle") but can never carry a match on their own.
GENERIC_WORDS: frozenset[str] = frozenset(
    {
        "ancient",
        "bay",
        "beach",
        "cave",
        "castle",
        "cedars",
        "church",
        "city",
        "coast",
        "day",
        "forest",
        "fort",
        "grotto",
        "harbour",
        "hills",
        "journey",
        "lebanon",
        "lunch",
        "market",
        "monastery",
        "mosque",
        "mountain",
        "museum",
        "old",
        "park",
        "port",
        "river",
        "road",
        "ruins",
        "sea",
        "souk",
        "souks",
        "take",
        "temple",
        "through",
        "tour",
        "town",
        "trail",
        "valley",
        "village",
        "walk",
        "جبل",
        "شمال",
        "جنوب",
        "لبنان",
        "مدينة",
        "وادي",
        "قلعة",
        "سوق",
        "بحر",
        "يوم",
    }
)

#: Arabic proclitics: "بطرابلس" is "b-" + "طرابلس", "البترون" is "al-" + "بترون".
_ARABIC_PREFIXES = ("بال", "وال", "فال", "كال", "لل", "ال", "ب", "ل", "ك", "ف", "و")


def _variants_of(word: str) -> set[str]:
    """The word itself, its transliterations, and it without an Arabic proclitic."""
    forms = {word}
    for alternate in VARIANTS.get(word, ()):  # noqa: B007 - small, fixed table
        forms.add(fold(alternate).strip())
    if word and "\u0600" <= word[0] <= "\u06ff":
        for prefix in _ARABIC_PREFIXES:
            if word.startswith(prefix) and len(word) - len(prefix) >= 3:
                stripped = word[len(prefix) :]
                forms.add(stripped)
                forms.update(fold(item).strip() for item in VARIANTS.get(stripped, ()))
                break
    return {form for form in forms if form}


def _words(value: str) -> list[str]:
    return [word for word in fold(value).split() if word]


def _text_words(raw: str) -> set[str]:
    """Every form of every word the traveller wrote, ready to look up."""
    found: set[str] = set()
    for word in _words(raw):
        found |= _variants_of(word)
    return found


@functools.cache
def _kind_words() -> frozenset[str]:
    """One-word names of kinds of place ("bowling", "cinema", "hotel"): never the name of a destination,
    even when only one destination has a place called "... Bowling"."""
    from app.planner.script.vocabulary import ALL_CONCEPTS  # the script package imports this module

    folded = (fold(cue).strip() for concept in ALL_CONCEPTS for cue in concept.cues)
    return frozenset(word for word in folded if word and " " not in word)


def _name_index(terms: list[tuple[str, str, int]]) -> dict[str, str]:
    """Words that name exactly one destination across the whole catalogue.

    "tripoli" appears only under North Lebanon, so it names it. "lebanon" appears
    under several, so it names none - which is why the index is built from the
    data rather than written down.
    """
    owners: dict[str, set[str]] = {}
    for slug, term, _weight in terms:
        for word in term.split():
            if len(word) >= 4 and word not in GENERIC_WORDS and word not in _kind_words():
                owners.setdefault(word, set()).add(slug)
    index: dict[str, str] = {}
    for word, slugs in owners.items():
        if len(slugs) == 1:
            owner = next(iter(slugs))
            index[word] = owner
            for variant in _variants_of(word):
                index.setdefault(variant, owner)
    return index


async def destination_terms(db: AsyncSession, *, force: bool = False) -> list[tuple[str, str, int]]:
    """Every (slug, folded term, weight) the catalogue answers to, briefly cached."""
    global _cache
    now = time.monotonic()
    if not force and _cache is not None and now - _cache[0] < TERMS_TTL_SECONDS:
        return _cache[1]
    row = (await db.execute(text("SELECT app.planner_destination_terms()"))).scalar()
    if isinstance(row, str):
        parsed = json.loads(row)
        items = parsed if isinstance(parsed, list) else []
    elif isinstance(row, list):
        items = row
    else:
        items = []
    folded: list[tuple[str, str, int]] = []
    for item in items:
        term = fold(str(item.get("term", ""))).strip()
        slug = str(item.get("slug", ""))
        if slug and len(term) >= 3:
            folded.append((slug, term, int(item.get("weight", 1))))
    # Longest term first: "qadisha valley" should win over "qadisha".
    folded.sort(key=lambda entry: (-entry[2], -len(entry[1])))
    _cache = (now, folded)
    return folded


def reset_cache() -> None:
    """Drop the memoised term index (tests, and after a catalogue import)."""
    global _cache
    _cache = None


def match_destinations(raw: str, terms: list[tuple[str, str, int]]) -> list[str]:
    """Which destinations the text names, best first. Empty when it names none.

    Two ways to match, both literal. A full catalogue term appearing in the text
    ("vallee de qadisha") is the strongest signal. Failing that, a single word
    that names exactly one destination ("tripoli", "jeita") is enough - which is
    what lets a short query find a place whose catalogue title is longer.
    """
    haystack = fold(raw)
    scored: dict[str, tuple[int, int]] = {}

    def offer(slug: str, score: tuple[int, int]) -> None:
        best = scored.get(slug)
        if best is None or score > best:
            scored[slug] = score

    for slug, term, weight in terms:
        if f" {term} " in haystack:
            offer(slug, (weight + 2, len(term)))

    index = _name_index(terms)
    for word in _text_words(raw):
        owner = index.get(word)
        if owner is not None:
            offer(owner, (2, len(word)))

    ranked = sorted(scored.items(), key=lambda entry: (-entry[1][0], -entry[1][1], entry[0]))
    return [slug for slug, _score in ranked[:MAX_RESOLVED_DESTINATIONS]]


async def resolve_anchors(db: AsyncSession, raw: str, extracted: ExtractedConstraints) -> ExtractedConstraints:
    """Fill in destinations the extractor missed, from names the catalogue knows.

    Whatever the extractor found is kept and ordered first - it saw the sentence,
    this only sees names. Nothing is invented: a text that names no place comes
    back untouched.
    """
    matched = match_destinations(raw, await destination_terms(db))
    if not matched:
        return extracted
    merged = list(extracted.destination_slugs)
    for slug in matched:
        if slug not in merged:
            merged.append(slug)
    extracted.destination_slugs = merged[:MAX_RESOLVED_DESTINATIONS]
    return extracted


__all__ = [
    "GENERIC_WORDS",
    "MAX_RESOLVED_DESTINATIONS",
    "destination_terms",
    "fold",
    "match_destinations",
    "reset_cache",
    "resolve_anchors",
]
