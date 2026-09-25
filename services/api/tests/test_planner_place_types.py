"""Trip builder v2, phase 2: kinds of place (migration 045) and per-step retrieval.

The unit tests here need no database. The API tests at the bottom run against a
migrated database, like the rest of the suite.
"""

from __future__ import annotations

import json
import re
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from app.planner.persist import retrieve_step
from app.planner.schemas import DayScript, ExtractedConstraints, StepCandidate, StepSpec
from app.planner.script import parse_day_script
from app.planner.script.retrieval import Near, step_query, without_avoided
from app.planner.script.vocabulary import ALL_CONCEPTS
from app.schemas.partners import PlaceTypesIn
from tests.conftest import TestingSessionLocal

MIGRATION = Path(__file__).resolve().parents[3] / "mshwar-database" / "migrations" / "045_place_types.sql"
#: Step tags that describe a place rather than name a kind of it. They rank, never filter.
SOFT_TAGS = {"sunset"}


def _migration_types() -> dict[str, dict[str, Any]]:
    body = re.search(r"\$types\$(.*?)\$types\$", MIGRATION.read_text(encoding="utf-8"), flags=re.DOTALL)
    assert body, "045 seeds its place types between $types$ markers"
    return {row["slug"]: row for row in json.loads(body.group(1))}


# ---- The vocabulary and the database agree ----


def test_every_kind_of_place_the_reader_produces_exists_in_the_database() -> None:
    types = _migration_types()
    produced = {
        concept.tag: concept.role
        for concept in ALL_CONCEPTS
        if concept.tag and concept.kind in {"food", "place", "stay"}
    }
    missing = set(produced) - set(types) - SOFT_TAGS
    assert not missing, f"add these kinds of place to a migration, or list them as soft tags: {sorted(missing)}"
    wrong_role = {
        tag: (role, types[tag]["role"]) for tag, role in produced.items() if tag in types and types[tag]["role"] != role
    }
    assert not wrong_role, f"the reader and the database disagree on the step role: {wrong_role}"


def test_the_catalogue_is_rich_and_named_in_every_language() -> None:
    types = _migration_types()
    assert len(types) >= 120
    groups = {row["place_group"] for row in types.values()}
    assert {"food", "stay", "nature", "heritage", "entertainment", "sport", "essentials"} <= groups
    for slug, row in types.items():
        assert all(row[f"name_{locale}"].strip() for locale in ("en", "ar", "fr")), slug
        assert re.search(r"[؀-ۿ]", row["name_ar"]), f"{slug} needs an Arabic name"
        if row["role"] != "meal":
            assert not row.get("meal_services"), slug


# ---- From a step to a catalogue query ----


def test_a_step_becomes_a_trust_gated_query() -> None:
    script = parse_day_script("breakfast at a sweets place in Batroun, then bowling, 4 people")
    breakfast, bowling = script.steps
    query = step_query(breakfast, script, near=Near(34.25, 35.66, 10_000))
    assert query["role"] == "meal" and query["meal"] == "breakfast"
    assert query["tags"] == ["sweets"]
    assert query["destination_slugs"] == ["batroun"]
    assert query["party_size"] == 4
    assert query["near"] == {"lat": 34.25, "lng": 35.66, "radius_m": 10_000}
    later = step_query(bowling, script, exclude_ids=[uuid4()], limit=3)
    assert later["tags"] == ["bowling"] and later["limit"] == 3 and len(later["exclude_ids"]) == 1
    assert "near" not in later


def test_a_named_place_only_ranks_and_exchange_is_not_a_listing() -> None:
    script = DayScript(constraints=ExtractedConstraints(destination_slugs=["byblos"]))
    named = StepSpec(order=1, role="meal", meal="dinner", named_place="Al Soussi", destination_slug="beirut")
    query = step_query(named, script)
    assert query["query"] == "Al Soussi"
    assert query["destination_slugs"] == ["beirut"]
    with pytest.raises(ValueError, match="money changers"):
        step_query(StepSpec(order=1, role="exchange"), script)


def _candidate(slug: str, place_types: list[str], **extra: Any) -> StepCandidate:
    payload: dict[str, Any] = {
        "id": str(uuid4()),
        "slug": slug,
        "title": slug,
        "status": "published",
        "duration_minutes": 60,
        "destination_slug": "batroun",
        "venue_id": str(uuid4()),
        "lat": 34.25,
        "lng": 35.66,
        "place_types": place_types,
    }
    payload.update(extra)
    return StepCandidate.model_validate(payload)


def test_exclusions_drop_places_the_traveller_ruled_out() -> None:
    fish, grill = _candidate("fish", ["seafood"]), _candidate("grill", ["grill", "mezze"])
    assert without_avoided([fish, grill], ["seafood"]) == [grill]
    assert without_avoided([fish, grill], []) == [fish, grill]


def test_step_candidates_read_the_database_payload() -> None:
    candidate = _candidate(
        "coast-cinema",
        ["cinema"],
        needs_schedule=True,
        schedule_note="Showtimes change daily",
        distance_m=1200,
        trust={"level": "verified_organisation"},
        fts=0.1,
        hybrid=1.2,
    )
    assert candidate.needs_schedule and candidate.distance_m == 1200
    assert candidate.trust["level"] == "verified_organisation"


# ---- What owners and staff may send ----


def test_place_types_input_is_validated() -> None:
    ok = PlaceTypesIn(place_types=["cinema"], schedule_note="Call ahead")
    assert json.loads(ok.model_dump_json(exclude_none=True)) == {
        "place_types": ["cinema"],
        "schedule_note": "Call ahead",
    }
    cleared = PlaceTypesIn(place_types=["cafe"], meal_services=[])
    assert json.loads(cleared.model_dump_json(exclude_none=True))["meal_services"] == []
    for bad in (
        {"place_types": []},
        {"place_types": ["a", "b", "c", "d", "e", "f", "g"]},
        {"place_types": ["Not A Slug"]},
        {"place_types": ["cafe"], "meal_services": ["midnight"]},
        {"place_types": ["cafe"], "price": 3},
    ):
        with pytest.raises(ValidationError):
            PlaceTypesIn.model_validate(bad)


# ---- Through the API (needs a migrated database) ----


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


@pytest.mark.asyncio
async def test_place_types_through_the_api(api: AsyncClient) -> None:
    from tests.test_booking_payments import _published_listing, _register

    public = await api.get("/api/v1/venues/place-types")
    assert public.status_code == 200
    catalogue = public.json()
    assert len(catalogue) >= 120
    assert {"en", "ar", "fr"} <= set(catalogue[0]["names"])

    catalog = await _published_listing(api)  # signs the owner in and makes them an admin
    org_id, listing_id = catalog["org"]["id"], catalog["listing"]["id"]
    path = f"/api/v1/venues/portal/{org_id}/listings/{listing_id}/place-types"

    saved = await api.put(path, json={"place_types": ["bowling", "arcade"]})
    assert saved.status_code == 200, saved.text
    assert saved.json()["place_types"] == ["bowling", "arcade"]
    assert saved.json()["roles"] == ["activity"]
    assert (await api.get(path)).json()["place_types"] == ["bowling", "arcade"]

    # A meal is always a checked restaurant: an activity listing cannot become one.
    refused = await api.put(path, json={"place_types": ["sweets"]})
    assert refused.status_code == 422
    assert "does not fit" in refused.json()["detail"]
    assert (await api.put(path, json={"place_types": ["space-station"]})).status_code == 422

    staff = await api.put(f"/api/v1/admin/place-types/listings/{listing_id}", json={"place_types": ["escape-room"]})
    assert staff.status_code == 200, staff.text
    coverage = await api.get("/api/v1/admin/place-types/coverage")
    assert coverage.status_code == 200
    assert "destinations" in coverage.json()

    async with TestingSessionLocal() as session:
        found = await retrieve_step(session, {"role": "activity", "tags": ["escape-room"], "limit": 24})
    assert all(candidate.trust for candidate in found)
    assert all("escape-room" in candidate.place_types for candidate in found)

    # Someone else cannot change this listing, nor read staff coverage.
    await _register(api, f"stranger-{uuid4().hex[:8]}@example.com", "Stranger")
    assert (await api.put(path, json={"place_types": ["bowling"]})).status_code == 403
    assert (await api.get("/api/v1/admin/place-types/coverage")).status_code == 403
