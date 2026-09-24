"""V5 and V6: checked restaurants and places to stay.

Eat and Stay show only checked places, each with its level and date; a
licensed-and-claimed check needs a verified owner and a licence; a place past
its review date hides itself (and the sweep hides it from the rest of the
catalogue); our team adds places it visited; owners claim them; the planner
never schedules a stay as a visit.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.planner.persist import retrieve_candidates
from app.planner.schemas import ExtractedConstraints
from tests.conftest import TestingSessionLocal
from tests.partners_support import client
from tests.test_booking_payments import _published_listing


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"owner": client(), "anon": client()}
    try:
        yield made
    finally:
        for each in made.values():
            await each.aclose()


def _details(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "listing_kind": "restaurant",
        "licence_number": "MOT-R-4411",
        "licence_authority": "Ministry of Tourism",
        "licence_expires_on": (date.today() + timedelta(days=400)).isoformat(),
        "cuisines": ["Lebanese", "Seafood", " "],
        "price_level": 2,
        "reservation_phone": "+9619540000",
    }
    body.update(overrides)
    return body


@pytest.mark.asyncio
async def test_a_licensed_restaurant_shows_only_once_checked_and_until_its_date(
    clients: dict[str, AsyncClient],
) -> None:
    owner, anon = clients["owner"], clients["anon"]
    made = await _published_listing(owner)
    org, listing = made["org"]["id"], made["listing"]
    base = f"/api/v1/venues/portal/{org}/listings/{listing['id']}"

    bad_link = await owner.put(base, json=_details(reservation_url="http://example.com"))
    assert bad_link.status_code == 422
    saved = await owner.put(base, json=_details())
    assert saved.status_code == 200, saved.text
    assert saved.json()["details"]["cuisines"] == ["lebanese", "seafood"] and saved.json()["checked"] is False
    mine = (await owner.get(base)).json()
    assert mine["listing_kind"] == "restaurant" and mine["licence_number"] == "MOT-R-4411"

    destination = await anon.get("/api/v1/venues/destinations/beirut")
    assert destination.status_code == 200
    assert all(item["slug"] != listing["slug"] for item in destination.json()["restaurants"])

    too_old = await owner.post(
        f"/api/v1/admin/venues/{listing['id']}/check",
        json={"level": "licensed_claimed", "notes": "Licence on the wall", "checked_on": "2020-01-01"},
    )
    assert too_old.status_code == 422
    checked = await owner.post(
        f"/api/v1/admin/venues/{listing['id']}/check",
        json={"level": "licensed_claimed", "notes": "Licence on the wall matches the ministry record"},
    )
    assert checked.status_code == 200, checked.text
    card = checked.json()
    assert card["checked"] is True and card["verification"]["claimed"] is True
    assert date.fromisoformat(card["verification"]["review_by"]) - date.today() == timedelta(days=365)
    shown = next(
        item
        for item in (await anon.get("/api/v1/venues/destinations/beirut")).json()["restaurants"]
        if item["slug"] == listing["slug"]
    )
    assert shown["verification"]["licence"]["number"] == "MOT-R-4411"
    assert shown["details"]["price_level"] == 2

    # A new licence number drops the listing back to "visited" until it is checked again.
    renumbered = (await owner.put(base, json=_details(licence_number="MOT-R-9999"))).json()
    assert renumbered["verification"]["level"] == "checked_by_mshwar"
    await owner.post(
        f"/api/v1/admin/venues/{listing['id']}/check",
        json={"level": "licensed_claimed", "notes": "New licence checked in person"},
    )

    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.experiences SET review_by = app.beirut_today() - 1 WHERE id = CAST(:id AS uuid)"),
            {"id": listing["id"]},
        )
        await session.commit()
    after = (await anon.get("/api/v1/venues/destinations/beirut")).json()["restaurants"]
    assert all(item["slug"] != listing["slug"] for item in after), "hidden the day its check runs out"
    swept = (await anon.post("/api/v1/partners/ops/sweep", headers={"X-Job-Token": settings.job_token})).json()
    assert swept["venues"]["hidden"] >= 1
    async with TestingSessionLocal() as session:
        reason = (
            await session.execute(
                text("SELECT hidden_reason FROM app.experiences WHERE id = CAST(:id AS uuid)"), {"id": listing["id"]}
            )
        ).scalar_one()
    assert reason == "verification lapsed", "and from the rest of the catalogue too"
    rechecked = await owner.post(
        f"/api/v1/admin/venues/{listing['id']}/check",
        json={"level": "licensed_claimed", "notes": "Re-checked on a visit this week"},
    )
    assert rechecked.json()["checked"] is True, "a new check brings it back"
    due = (await owner.get("/api/v1/admin/venues?destination=beirut&kind=restaurant")).json()
    assert any(item["id"] == listing["id"] for item in due["venues"])


@pytest.mark.asyncio
async def test_a_visited_stay_is_listed_found_near_and_claimed_by_its_owner(clients: dict[str, AsyncClient]) -> None:
    owner, anon = clients["owner"], clients["anon"]
    made = await _published_listing(owner)
    org = made["org"]["id"]
    name = f"Dar Jbeil Guesthouse {made['listing']['slug'][-6:]}"
    added = await owner.post(
        "/api/v1/admin/venues",
        json={
            "listing_kind": "hotel",
            "name": name,
            "description": "Five rooms in a restored stone house above the old souk.",
            "destination": "byblos",
            "address": "Old souk, Byblos",
            "lat": 34.1219,
            "lng": 35.6479,
            "notes": "Visited, saw three rooms, host ID checked",
            "stay_type": "guesthouse",
            "price_from_minor": 6500,
            "amenities": ["Breakfast", "Wi-Fi"],
        },
    )
    assert added.status_code == 200, added.text
    stay = added.json()
    assert stay["verification"]["level"] == "checked_by_mshwar" and stay["verification"]["claimed"] is False
    assert stay["details"]["stay_type"] == "guesthouse" and stay["details"]["amenities"] == ["breakfast", "wi-fi"]
    duplicate = await owner.post(
        "/api/v1/admin/venues",
        json={
            "listing_kind": "hotel",
            "name": name,
            "description": "The same place again, twenty chars.",
            "destination": "byblos",
            "lat": 34.1219,
            "lng": 35.6479,
            "notes": "Visited again today",
        },
    )
    assert duplicate.status_code == 422

    stays = (await anon.get("/api/v1/venues/destinations/byblos")).json()
    assert any(item["slug"] == stay["slug"] for item in stays["stays"])
    assert stays["targets"] == {"restaurants": 5, "stays": 3}
    near = (await anon.get("/api/v1/venues/near?kind=hotel&lat=34.12&lng=35.65&radius=5000")).json()
    ours = next(item for item in near if item["slug"] == stay["slug"])
    assert ours["distance_m"] < 1000 and [item["distance_m"] for item in near] == sorted(
        item["distance_m"] for item in near
    )
    assert (await anon.get("/api/v1/venues/near?kind=hotel&lat=33.27&lng=35.20&radius=2000")).json() == []

    async with TestingSessionLocal() as session:
        candidates = await retrieve_candidates(session, ExtractedConstraints(destination_slugs=["byblos"]), limit=200)
    assert all(candidate.listing_kind != "hotel" for candidate in candidates), "a stay is never a stop"

    no_note = await owner.post(f"/api/v1/venues/portal/{org}/claims", json={"slug": stay["slug"], "note": "mine"})
    assert no_note.status_code == 422
    claim = await owner.post(
        f"/api/v1/venues/portal/{org}/claims", json={"slug": stay["slug"], "note": "I own the house and run it"}
    )
    assert claim.status_code == 200, claim.text
    again = await owner.post(
        f"/api/v1/venues/portal/{org}/claims", json={"slug": stay["slug"], "note": "Asking a second time here"}
    )
    assert again.status_code == 422
    queue = (await owner.get("/api/v1/admin/venues?kind=hotel")).json()
    pending = next(item for item in queue["claims"] if item["id"] == claim.json()["id"])
    assert pending["organization"]["verification"] == "verified"
    decided = await owner.post(f"/api/v1/admin/venues/claims/{pending['id']}", json={"decision": "approved"})
    assert decided.status_code == 200, decided.text
    assert decided.json()["experience"]["verification"]["claimed"] is True
    assert (await owner.get(f"/api/v1/venues/portal/{org}/claims")).json()[0]["status"] == "approved"
    detail = await owner.get(f"/api/v1/venues/portal/{org}/listings/{stay['id']}")
    assert detail.status_code == 200, "the owner now edits it in their portal"
    claimed_again = await owner.post(
        f"/api/v1/venues/portal/{org}/claims", json={"slug": stay["slug"], "note": "Claiming a claimed place"}
    )
    assert claimed_again.status_code == 404

    coverage = (await owner.get("/api/v1/admin/coverage")).json()
    byblos = next(item for item in coverage["destinations"] if item["slug"] == "byblos")
    assert byblos["stays"] >= 1 and {"restaurants", "transport_cards", "drivers", "changers"} <= set(byblos)
