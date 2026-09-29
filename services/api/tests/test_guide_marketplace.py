"""Guide plan step 4: the tours marketplace and tour pages.

The rules worth protecting: only published tours of approved guides are listed; filters
narrow for real (language, destination, date, price, instant); a tour page shows only
approved photos; and a rating is only ever built from released reviews.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_schedules import _live_tour, _rules, _schedule, _today
from tests.test_guide_tours import _approved_guide, _client


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "anon": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _search(client: AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await client.get("/api/v1/guides/tours", params=params)
    assert response.status_code == 200, response.text
    return list(response.json()["tours"])


@pytest.mark.asyncio
async def test_a_tour_is_found_with_real_filters_and_a_full_page(clients: dict[str, AsyncClient]) -> None:
    guide, anon = clients["guide"], clients["anon"]
    profile = await _approved_guide(clients)
    await _rules(guide)
    title = f"Zoukak el Blat stairs {profile['slug'][-6:]}"
    tour = await _live_tour(guide, profile, title)
    day = _today() + timedelta(days=12)
    await _schedule(guide, tour["id"], day, "09:30")

    content = await guide.put(
        f"/api/v1/guides/me/tours/{tour['id']}/content",
        json={
            "highlights": ["The Ottoman houses of Zoukak el Blat", "Coffee in a family bakery"],
            "faq": [{"question": "Is it steep?", "answer": "There are about 120 steps, taken slowly."}],
            "accessibility": "Stairs throughout; not suitable for wheelchairs.",
        },
    )
    assert content.status_code == 200, content.text
    too_many = await guide.put(f"/api/v1/guides/me/tours/{tour['id']}/content", json={"highlights": ["x" * 5] * 9})
    assert too_many.status_code == 422

    found = await _search(anon, q=title)
    assert [row["slug"] for row in found] == [tour["slug"]]
    card = found[0]
    assert card["guide"]["slug"] == profile["slug"]
    assert card["rating"] == {"count": 0, "average": None}, "no reviews, no rating"
    assert card["next_start"] is not None
    assert card["photo"] is None, "an unmoderated photo is not shown"

    assert await _search(anon, q=title, language="de") == []
    assert [row["slug"] for row in await _search(anon, q=title, language="en")] == [tour["slug"]]
    assert [row["slug"] for row in await _search(anon, q=title, date=day.isoformat())] == [tour["slug"]]
    assert await _search(anon, q=title, date=(day + timedelta(days=1)).isoformat()) == []
    assert await _search(anon, q=title, max_price=2000) == [], "the tour costs 25"
    assert await _search(anon, q=title, instant="true") == [], "not instant yet"
    assert await _search(anon, q=title, destination="tripoli") == []

    page = await anon.get(f"/api/v1/guides/tours/{tour['slug']}")
    assert page.status_code == 200, page.text
    body = page.json()
    assert body["highlights"] == ["The Ottoman houses of Zoukak el Blat", "Coffee in a family bakery"]
    assert body["faq"][0]["question"] == "Is it steep?"
    assert body["accessibility"].startswith("Stairs")
    assert body["photos"] == []

    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.media SET moderation = 'approved' WHERE experience_id = CAST(:e AS uuid)"),
            {"e": tour["id"]},
        )
        await session.commit()
    photos = (await anon.get(f"/api/v1/guides/tours/{tour['slug']}")).json()["photos"]
    assert len(photos) == 1 and photos[0]["url"] and photos[0]["alt_text"]
    assert "object_key" not in photos[0], "storage keys are never sent"

    destination = (card["destination"] or {}).get("slug")
    if destination:
        assert [row["slug"] for row in await _search(anon, q=title, destination=destination)] == [tour["slug"]]
        near = await anon.get(f"/api/v1/guides/destinations/{destination}/tours")
        assert near.status_code == 200
        assert 1 <= len(near.json()) <= 6, "a destination page shows a handful, never an empty section"
        assert all(row["destination"]["slug"] == destination for row in near.json())
    slugs = (await anon.get("/api/v1/guides/tour-slugs")).json()
    assert any(row["slug"] == tour["slug"] for row in slugs)
    mine = (await guide.get("/api/v1/guides/me/tours")).json()
    assert (
        next(row for row in mine if row["id"] == tour["id"])["content"]["highlights"][1] == "Coffee in a family bakery"
    )


@pytest.mark.asyncio
async def test_drafts_are_never_listed(clients: dict[str, AsyncClient]) -> None:
    guide, anon = clients["guide"], clients["anon"]
    await _approved_guide(clients)
    draft = (
        await guide.put(
            "/api/v1/guides/me/tours",
            json={
                "title": "A draft nobody should see",
                "description": "Not ready.",
                "duration_minutes": 60,
                "max_party": 4,
                "price_minor": 1000,
                "languages": ["en"],
                "meeting": {"name": "Somewhere", "lat": 33.89, "lng": 35.5},
            },
        )
    ).json()
    assert await _search(anon, q="A draft nobody should see") == []
    assert (await anon.get(f"/api/v1/guides/tours/{draft['slug']}")).status_code == 404
    bad = await anon.get("/api/v1/guides/tours", params={"sort": "cheapest-first"})
    assert bad.status_code == 422
