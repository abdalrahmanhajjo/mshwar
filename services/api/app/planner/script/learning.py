"""What the planner learns from, and what it never keeps (migration 048).

* **Approved phrases** extend the seed vocabulary. Only phrases staff approved
  are read; a phrase maps to a vocabulary concept, never to a business.
* **Misses** - parts of a request the planner could not read - are redacted
  here before they leave the request: e-mails, links, long numbers and
  capitalised names are removed. The database records them only for travellers
  who allowed their data to improve Mshwar, with no user id, and deletes them
  after 90 days.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.planner.script.text import use_extra_phrases
from app.planner.script.vocabulary import ALL_CONCEPTS

PHRASES_TTL_SECONDS = 300.0
CONCEPT_SLUGS: frozenset[str] = frozenset(concept.slug for concept in ALL_CONCEPTS)

_cache: tuple[float, tuple[tuple[str, str], ...]] | None = None

_EMAIL = re.compile(r"\S+@\S+")
_LINK = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
_NUMBER = re.compile(r"\+?\d[\d\s\-().]{3,}\d")
_NAME = re.compile(r"(?<=\s)[A-Z][a-zà-ÿ'’-]+")


def redact(fragment: str) -> str | None:
    """A fragment safe to count: contacts, links, numbers and names removed. None if nothing is left."""
    cleaned = _EMAIL.sub(" ", fragment or "")
    cleaned = _LINK.sub(" ", cleaned)
    cleaned = _NUMBER.sub(" ", cleaned)
    cleaned = _NAME.sub("…", f" {cleaned}")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:-")
    words = [word for word in cleaned.split() if word != "…"]
    if len(words) < 2:
        return None
    return cleaned[:120]


async def refresh_phrases(db: AsyncSession, *, force: bool = False) -> None:
    """Load approved phrases into the reader (cached; the catalogue of phrases changes rarely)."""
    global _cache
    now = time.monotonic()
    if not force and _cache is not None and now - _cache[0] < PHRASES_TTL_SECONDS:
        use_extra_phrases(_cache[1])
        return
    row = (await db.execute(text("SELECT app.planner_intent_phrases()"))).scalar()
    items = json.loads(row) if isinstance(row, str) else (row or [])
    pairs = tuple(
        sorted(
            (str(item["phrase"]), str(item["concept"]))
            for item in items
            if isinstance(item, dict) and item.get("concept") in CONCEPT_SLUGS and item.get("phrase")
        )
    )
    _cache = (now, pairs)
    use_extra_phrases(pairs)


def reset_phrases() -> None:
    global _cache
    _cache = None
    use_extra_phrases(())


async def record_misses(db: AsyncSession, user_id: UUID, fragments: list[str], locale: str) -> int:
    """Count what the planner could not read - redacted, and only if the traveller consented."""
    safe = [clean for clean in (redact(fragment) for fragment in fragments) if clean]
    if not safe:
        return 0
    row = (
        await db.execute(
            text("SELECT app.planner_record_intent_misses(CAST(:user AS uuid), CAST(:fragments AS jsonb), :locale)"),
            {"user": str(user_id), "fragments": json.dumps(safe, ensure_ascii=False), "locale": locale},
        )
    ).scalar()
    return int(row or 0)


def concept_catalogue() -> list[dict[str, Any]]:
    """The concepts a phrase can mean, for the staff review screen."""
    return [
        {"slug": concept.slug, "kind": concept.kind, "role": concept.role, "example": concept.cues[0]}
        for concept in ALL_CONCEPTS
    ]


__all__ = ["CONCEPT_SLUGS", "concept_catalogue", "record_misses", "redact", "refresh_phrases", "reset_phrases"]
