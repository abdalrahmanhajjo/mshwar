"""G4: guides propose new places and corrections; a reviewer decides.

The rules: evidence is required and kept, nothing reaches the catalogue until a
reviewer accepts it, a correction also lands in the data-quality queue, a
Commons photo needs an allowed licence and the guide's own photo needs their
grant, new guides get a small daily allowance that accepted work raises, and
the place page credits the guide who added it.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.licences import license_allowed
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.media_fixtures import b64, tiny_jpeg
from tests.test_guide_engagements import _approve
from tests.test_guide_tours import _client

EVIDENCE = ["https://www.lebanontourism.gov.lb/some-place"]


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "public": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


def _new_place(name: str, **overrides: Any) -> dict[str, Any]:
    place: dict[str, Any] = {
        "name": name,
        "description": "A small stone chapel above the valley, open most mornings.",
        "category": "heritage",
        "destination_slug": "byblos",
        "lat": 34.12,
        "lng": 35.66,
        "suggested_minutes": 45,
    }
    place.update(overrides)
    return {"kind": "new", "place": place, "evidence_urls": EVIDENCE}


def test_the_licence_rule_is_shared_with_the_importer() -> None:
    from app.seed.catalogue_import import _license_allowed

    for ok in ("CC BY-SA 4.0", "CC0", "Public domain"):
        assert license_allowed(ok) and _license_allowed(ok, ok)
    for bad in ("CC BY-NC 2.0", "CC BY-ND 3.0", "All rights reserved"):
        assert not license_allowed(bad) and not _license_allowed(bad, bad)


@pytest.mark.asyncio
async def test_a_new_place_is_reviewed_published_and_credited(clients: dict[str, AsyncClient]) -> None:
    guide, admin, public = clients["guide"], clients["admin"], clients["public"]
    profile = await _approve(guide, admin, "host", ["byblos"])  # hosts contribute too

    no_evidence = await guide.post(
        "/api/v1/guides/me/proposals", json={**_new_place("Saydet el Hadra"), "evidence_urls": []}
    )
    assert no_evidence.status_code == 422

    made = await guide.post("/api/v1/guides/me/proposals", json=_new_place("Saydet el Hadra chapel"))
    assert made.status_code == 200, made.text
    proposal = made.json()
    assert proposal["status"] == "submitted"
    assert proposal["evidence_urls"] == EVIDENCE, "the evidence is kept with the proposal"

    unlicensed = await guide.post(
        f"/api/v1/guides/me/proposals/{proposal['id']}/photos",
        json={
            "commons_page_url": "https://commons.wikimedia.org/wiki/File:Chapel.jpg",
            "commons_image_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Chapel.jpg",
            "license": "CC BY-NC 2.0",
        },
    )
    assert unlicensed.status_code == 422
    commons = await guide.post(
        f"/api/v1/guides/me/proposals/{proposal['id']}/photos",
        json={
            "commons_page_url": "https://commons.wikimedia.org/wiki/File:Chapel.jpg",
            "commons_image_url": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Chapel.jpg",
            "license": "CC BY-SA 4.0",
            "attribution": "A. Photographer",
            "alt_text": "The chapel door",
        },
    )
    assert commons.status_code == 200, commons.text
    no_grant = await guide.post(
        f"/api/v1/guides/me/proposals/{proposal['id']}/photos",
        json={"filename": "mine.jpg", "content_type": "image/jpeg", "content_base64": b64(tiny_jpeg())},
    )
    assert no_grant.status_code == 422, "the guide's own photo needs their grant"
    own = await guide.post(
        f"/api/v1/guides/me/proposals/{proposal['id']}/photos",
        json={
            "filename": "mine.jpg",
            "content_type": "image/jpeg",
            "content_base64": b64(tiny_jpeg()),
            "rights_granted": True,
        },
    )
    assert own.status_code == 200, own.text
    photos = own.json()["photos"]
    assert {photo["source"] for photo in photos} == {"wikimedia-commons", "guide-upload"}
    assert next(p for p in photos if p["source"] == "guide-upload")["attribution"] == profile["display_name"]

    # Nothing in the catalogue yet.
    assert (await public.get("/api/v1/guides/places/saydet-el-hadra-chapel/contributors")).json() == []

    queue = await admin.get("/api/v1/admin/proposals")
    assert queue.status_code == 200, queue.text
    row = next(r for r in queue.json() if r["id"] == proposal["id"])
    assert row["allowance"]["daily_cap"] == 2

    no_reason = await admin.post(f"/api/v1/admin/proposals/{proposal['id']}", json={"decision": "rejected"})
    assert no_reason.status_code == 422, "a rejection says why"
    accepted = await admin.post(
        f"/api/v1/admin/proposals/{proposal['id']}", json={"decision": "accepted", "reason": "Checked the source"}
    )
    assert accepted.status_code == 200, accepted.text
    slug = accepted.json()["resulting_slug"]
    assert slug == "saydet-el-hadra-chapel"

    async with TestingSessionLocal() as session:
        media = (
            await session.execute(
                text(
                    "SELECT m.source, m.license, m.moderation FROM app.media m JOIN app.experiences e "
                    "ON e.id = m.experience_id WHERE e.slug = :slug ORDER BY m.sort_order"
                ),
                {"slug": slug},
            )
        ).all()
        price = (
            await session.execute(
                text(
                    "SELECT pr.price_type FROM app.price_rules pr JOIN app.experiences e ON e.id = pr.experience_id "
                    "WHERE e.slug = :slug"
                ),
                {"slug": slug},
            )
        ).scalar_one()
    assert [(m.source, m.moderation) for m in media] == [
        ("wikimedia-commons", "approved"),
        ("guide-upload", "approved"),
    ]
    assert media[0].license == "CC BY-SA 4.0"
    assert price == "quote-required", "no invented prices"

    credit = await public.get(f"/api/v1/guides/places/{slug}/contributors")
    assert credit.status_code == 200
    assert credit.json()[0]["role"] == "added"
    assert credit.json()[0]["slug"] == profile["slug"]

    allowance = (await guide.get("/api/v1/guides/me/proposals")).json()["allowance"]
    assert allowance["accepted"] == 1 and allowance["daily_cap"] == 4, "accepted work raises the cap"


@pytest.mark.asyncio
async def test_a_correction_opens_a_data_quality_issue(clients: dict[str, AsyncClient]) -> None:
    guide, admin = clients["guide"], clients["admin"]
    await _approve(guide, admin, "licensed", ["byblos"])
    async with TestingSessionLocal() as session:
        target = (
            await session.execute(
                text("SELECT slug, title FROM app.experiences WHERE status = 'published' ORDER BY slug LIMIT 1")
            )
        ).one()

    empty = await guide.post(
        "/api/v1/guides/me/proposals",
        json={"kind": "correction", "target_slug": target.slug, "place": {}, "evidence_urls": EVIDENCE},
    )
    assert empty.status_code == 422

    made = await guide.post(
        "/api/v1/guides/me/proposals",
        json={
            "kind": "correction",
            "target_slug": target.slug,
            "place": {"address": "Main road, next to the old well", "note": "The entrance moved in 2025"},
            "evidence_urls": EVIDENCE,
        },
    )
    assert made.status_code == 200, made.text
    proposal = made.json()
    assert proposal["target"]["slug"] == target.slug

    async with TestingSessionLocal() as session:
        issue = (
            await session.execute(
                text(
                    "SELECT d.rule_code, d.status FROM app.data_quality_issues d JOIN app.place_proposals p "
                    "ON p.data_quality_issue_id = d.id WHERE p.id = :id"
                ),
                {"id": proposal["id"]},
            )
        ).one()
    assert (issue.rule_code, issue.status) == ("guide_correction", "open")

    decided = await admin.post(f"/api/v1/admin/proposals/{proposal['id']}", json={"decision": "accepted"})
    assert decided.status_code == 200, decided.text
    async with TestingSessionLocal() as session:
        address, status = (
            await session.execute(
                text(
                    "SELECT v.address, d.status FROM app.place_proposals p "
                    "JOIN app.experiences e ON e.id = p.target_experience_id JOIN app.venues v ON v.id = e.venue_id "
                    "JOIN app.data_quality_issues d ON d.id = p.data_quality_issue_id WHERE p.id = :id"
                ),
                {"id": proposal["id"]},
            )
        ).one()
    assert address == "Main road, next to the old well"
    assert status == "resolved"


@pytest.mark.asyncio
async def test_new_guides_have_a_small_daily_allowance(clients: dict[str, AsyncClient]) -> None:
    guide, admin = clients["guide"], clients["admin"]
    await _approve(guide, admin, "licensed", ["beirut"])
    for n in range(2):
        made = await guide.post(
            "/api/v1/guides/me/proposals", json=_new_place(f"Rooftop garden number {n}", destination_slug="beirut")
        )
        assert made.status_code == 200, made.text
    third = await guide.post("/api/v1/guides/me/proposals", json=_new_place("Rooftop garden three"))
    assert third.status_code == 429
    assert third.headers.get("retry-after") == "3600"


@pytest.mark.asyncio
async def test_a_known_place_is_not_proposed_twice(clients: dict[str, AsyncClient]) -> None:
    guide, admin = clients["guide"], clients["admin"]
    await _approve(guide, admin, "licensed", ["byblos"])
    async with TestingSessionLocal() as session:
        known = (
            await session.execute(
                text(
                    "SELECT e.title, ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng "
                    "FROM app.experiences e JOIN app.venues v ON v.id = e.venue_id "
                    "JOIN app.destinations d ON d.id = v.destination_id "
                    "WHERE e.status = 'published' AND d.slug = 'byblos' ORDER BY e.slug LIMIT 1"
                )
            )
        ).one()
    again = await guide.post("/api/v1/guides/me/proposals", json=_new_place(known.title, lat=known.lat, lng=known.lng))
    assert again.status_code == 422
    assert "already in the catalogue" in again.text


@pytest.mark.asyncio
async def test_only_approved_guides_propose_and_only_admins_review(clients: dict[str, AsyncClient]) -> None:
    from tests.test_guide_tours import _register

    guide = clients["guide"]
    await _register(guide, "applicant")
    await guide.put("/api/v1/guides/me", json={"tier": "licensed", "display_name": "Not Yet"})
    assert (await guide.post("/api/v1/guides/me/proposals", json=_new_place("Anywhere nice"))).status_code == 404
    assert (await guide.get("/api/v1/admin/proposals")).status_code in {401, 403}
