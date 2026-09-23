"""Every destination the app offers holds places the planner can actually reach.

These are contract tests against the real schema. They are the guard for the two
ways a destination and its experiences came apart: a destination offered with
nothing in it, and a published place the trip builder could not retrieve because
its search text or embedding was never filled in.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from sqlalchemy import text

from tests.conftest import TestingSessionLocal


async def _json(sql: str, **params: Any) -> Any:
    async with TestingSessionLocal() as session:
        value = (await session.execute(text(sql), params)).scalar()
    return json.loads(value) if isinstance(value, str) else value


@pytest.mark.asyncio
async def test_every_offered_destination_has_published_experiences() -> None:
    offered = await _json("SELECT app.public_catalogue_destinations()")
    assert offered, "the catalogue must offer at least one destination"
    empty = [item["slug"] for item in offered if int(item.get("experience_count", 0)) < 1]
    assert empty == [], f"destinations offered with nothing in them: {empty}"


@pytest.mark.asyncio
async def test_the_planner_can_retrieve_every_published_place() -> None:
    """A published place the planner cannot see is a place that does not exist."""
    for item in await _json("SELECT app.public_catalogue_destinations()"):
        slug = item["slug"]
        candidates = await _json(
            "SELECT app.planner_retrieve_candidates(CAST(:c AS jsonb))",
            c=json.dumps({"destination_slugs": [slug], "candidate_limit": 200}),
        )
        assert len(candidates) == int(item["experience_count"]), (
            f"{slug}: catalogue publishes {item['experience_count']} places but the planner retrieves {len(candidates)}"
        )


@pytest.mark.asyncio
async def test_no_published_listing_is_missing_its_search_text_or_embedding() -> None:
    async with TestingSessionLocal() as session:
        row = (
            (
                await session.execute(
                    text(
                        "SELECT count(*) FILTER (WHERE btrim(search_text) = '') AS blank, "
                        "count(*) FILTER (WHERE embedding IS NULL) AS unembedded "
                        "FROM app.experiences WHERE status = 'published'"
                    )
                )
            )
            .mappings()
            .one()
        )
    assert row["blank"] == 0, "published listings with no search text are unrankable"
    assert row["unembedded"] == 0, "published listings with no embedding were dropped from retrieval"


@pytest.mark.asyncio
async def test_a_new_listing_is_searchable_without_anyone_filling_the_columns() -> None:
    """The trigger, not the importer, is what keeps retrieval complete."""
    async with TestingSessionLocal() as session:
        seed = (
            (
                await session.execute(
                    text(
                        "SELECT e.organization_id, e.venue_id FROM app.experiences e "
                        "WHERE e.status = 'published' LIMIT 1"
                    )
                )
            )
            .mappings()
            .one()
        )
        row = (
            (
                await session.execute(
                    text(
                        "INSERT INTO app.experiences (organization_id, venue_id, slug, title, description, "
                        "status, booking_mode, duration_minutes, max_party, setting) "
                        "VALUES (:org, :venue, :slug, :title, :body, 'published', 'request', 90, 8, 'outdoor') "
                        "RETURNING btrim(search_text) <> '' AS has_text, embedding IS NOT NULL AS has_vector"
                    ),
                    {
                        "org": seed["organization_id"],
                        "venue": seed["venue_id"],
                        "slug": "coverage-probe-listing",
                        "title": "Coverage probe listing",
                        "body": "Inserted by a test to prove the fill trigger runs.",
                    },
                )
            )
            .mappings()
            .one()
        )
        await session.rollback()
    assert row["has_text"], "a new published listing must get its search text"
    assert row["has_vector"], "a new published listing must get an embedding"


@pytest.mark.asyncio
async def test_town_names_resolve_to_the_destination_that_holds_them() -> None:
    """Tripoli's places are named after landmarks, so the town itself is a gazetteer entry."""
    terms = await _json("SELECT app.planner_destination_terms()")
    by_term: dict[str, set[str]] = {}
    for row in terms:
        by_term.setdefault(str(row["term"]).casefold(), set()).add(row["slug"])
    assert by_term, "the planner must have some names to resolve"
    for town in ("tripoli", "sidon", "tyre"):
        if town in by_term:
            # Whatever it resolves to must be a destination that actually has places.
            offered = {item["slug"] for item in await _json("SELECT app.public_catalogue_destinations()")}
            assert by_term[town] <= offered, f"{town} resolves outside the offered destinations"
