"""Trip builder v2, phase 2b: facts travellers filter on, and open-data leads staff check before listing."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from app.planner.script import parse_day_script
from app.planner.script.day import DayPools, PoolEntry, assemble_day
from app.planner.script.retrieval import step_needs, step_query
from app.seed.leads_import import in_lebanon, leads_from, osm_place_type
from tests.test_planner_day_assembly import constraints_for, place

# ---- Needs: what a place must not contradict ----


def test_meals_carry_diet_and_every_step_carries_access() -> None:
    script = parse_day_script("breakfast then a museum")
    script = script.model_copy(
        update={
            "constraints": script.constraints.model_copy(
                update={"dietary": ["halal", "kosher"], "accessibility": ["wheelchair"]}
            )
        }
    )
    meal, museum = script.steps
    assert step_needs(meal, script) == ["wheelchair_access", "halal"], "unknown diets are not invented as needs"
    assert step_needs(museum, script) == ["wheelchair_access"]
    assert step_query(meal, script)["needs"] == {"wheelchair_access": True, "halal": True}
    plain = parse_day_script("breakfast then a museum")
    assert "needs" not in step_query(plain.steps[0], plain)


def test_a_need_the_place_has_not_confirmed_is_flagged() -> None:
    script = parse_day_script("a museum")
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("old-museum", ["museum"], unconfirmed_needs=["wheelchair_access"]))]
    day = assemble_day(script, constraints_for(script), pools)
    assert day.outcomes[0].status == "filled"
    assert "needs_unconfirmed" in day.outcomes[0].flags


# ---- Leads from open data ----


def test_osm_tags_map_to_kinds_of_place() -> None:
    assert osm_place_type({"amenity": "cinema"}) == "cinema"
    assert osm_place_type({"leisure": "bowling_alley"}) == "bowling"
    assert osm_place_type({"amenity": "restaurant", "cuisine": "pizza;italian"}) == "pizza"
    assert osm_place_type({"amenity": "restaurant", "cuisine": "italian"}) == "restaurant"
    assert osm_place_type({"amenity": "place_of_worship", "religion": "muslim"}) == "mosque"
    assert osm_place_type({"amenity": "place_of_worship", "religion": "druze"}) is None
    assert osm_place_type({"shop": "hardware"}) is None


def test_leads_are_named_places_inside_lebanon_only() -> None:
    overpass = {
        "elements": [
            {"type": "node", "id": 1, "lat": 34.2553, "lon": 35.6581, "tags": {"name": "Strike", "leisure": "bowling_alley"}},
            {"type": "way", "id": 2, "center": {"lat": 33.89, "lon": 35.50}, "tags": {"name:en": "Cine", "amenity": "cinema", "name:ar": "سينما"}},
            {"type": "node", "id": 3, "lat": 34.25, "lon": 35.65, "tags": {"amenity": "cafe"}},
            {"type": "node", "id": 4, "lat": 34.92, "lon": 33.63, "tags": {"name": "Larnaca cafe", "amenity": "cafe"}},
        ]
    }  # fmt: skip
    leads = leads_from(overpass, "osm")
    assert [(lead["external_id"], lead["place_type"]) for lead in leads] == [("node/1", "bowling"), ("way/2", "cinema")]
    assert leads[1]["name"] == "Cine" and leads[1]["name_ar"] == "سينما"
    geojson = {
        "features": [
            {"geometry": {"type": "Point", "coordinates": [35.64, 34.12]}, "properties": {"name": "Byblos souk", "wikidata": "Q1"}},
            {"geometry": {"type": "Polygon", "coordinates": []}, "properties": {"name": "Area"}},
        ]
    }  # fmt: skip
    (lead,) = leads_from(geojson, "wikidata")
    assert (lead["source"], lead["external_id"], lead["lat"]) == ("wikidata", "Q1", 34.12)
    assert in_lebanon(34.0, 35.8) and not in_lebanon(35.0, 35.8)


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
async def test_facts_and_leads_through_the_api(api: AsyncClient) -> None:
    from tests.test_booking_payments import _published_listing, _register

    catalog = await _published_listing(api)  # signed in as the owner, who is also an admin
    org_id, listing_id = catalog["org"]["id"], catalog["listing"]["id"]
    owner = await api.put(
        f"/api/v1/venues/portal/{org_id}/listings/{listing_id}/facts", json={"wheelchair_access": True}
    )
    assert owner.status_code == 200, owner.text
    staff = await api.put(f"/api/v1/admin/place-facts/listings/{listing_id}", json={"parking": False})
    assert staff.status_code == 200, staff.text
    assert (await api.put(f"/api/v1/admin/place-facts/listings/{listing_id}", json={"sauna": True})).status_code == 422

    tag = uuid4().hex[:10]
    lead = {"source": "osm", "external_id": f"node/{tag}", "name": f"Lane {tag}", "lat": 34.05, "lng": 36.05}
    imported = await api.post("/api/v1/admin/leads/import", json={"leads": [{**lead, "place_type": "bowling"}]})
    assert imported.status_code == 200, imported.text
    again = await api.post("/api/v1/admin/leads/import", json={"leads": [lead]})
    assert again.json()["known"] == 1, "a known lead is never imported twice"
    queue = await api.get("/api/v1/admin/leads?status=new&place_type=bowling")
    found = next(item for item in queue.json() if item["external_id"] == f"node/{tag}")
    rejected = await api.post(
        f"/api/v1/admin/leads/{found['id']}/decision", json={"decision": "rejected", "reason": "closed down"}
    )
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected"

    await _register(api, f"stranger-{uuid4().hex[:8]}@example.com", "Stranger")
    assert (await api.get("/api/v1/admin/leads")).status_code == 403
