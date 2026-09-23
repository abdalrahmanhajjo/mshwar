"""G6: trust and safety around guides.

Suspension leaves nothing bookable behind it; either side of a day can report
a problem and safety reports are escalated; every guide notification has a
template in every language; operators see the funnel; and a guide's own
booking notifications link to the guide screens, not the hidden business portal.
"""

from __future__ import annotations

import re
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_engagements import _approve, _plan
from tests.test_guide_tours import _client, _photo, _register, _tour

MIGRATIONS = Path(__file__).resolve().parents[3] / "mshwar-database" / "migrations"


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "traveller": _client(), "stranger": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


def test_every_guide_notification_has_a_template_in_every_language() -> None:
    emitted: set[str] = set()
    templated: dict[str, set[str]] = {}
    for migration in sorted(MIGRATIONS.glob("0*.sql")):
        if int(migration.name[:3]) < 33:
            continue
        body = migration.read_text()
        emitted |= set(re.findall(r"emit_notification_event\(\s*'([a-z_.]+)'", body))
        emitted |= set(re.findall(r"notify_engagement\([^,]+,\s*'([a-z_.]+)'", body))
        emitted |= set(re.findall(r"WHEN [^\n]*THEN '(engagement\.[a-z_]+)'", body))
        emitted |= set(re.findall(r"ELSE '(engagement\.[a-z_]+)'", body))
        for event, locale in re.findall(r"\('((?:guide|engagement)\.[a-z_]+)', '(en|ar|fr)', 'traveller'", body):
            templated.setdefault(event, set()).add(locale)
    assert emitted, "the taxonomy test found no events; the pattern is stale"
    missing = {event: {"en", "ar", "fr"} - templated.get(event, set()) for event in emitted}
    assert not {k: v for k, v in missing.items() if v}, missing


@pytest.mark.asyncio
async def test_suspending_a_guide_leaves_nothing_bookable(clients: dict[str, AsyncClient]) -> None:
    guide, admin, traveller = clients["guide"], clients["admin"], clients["traveller"]
    profile = await _approve(guide, admin, "licensed", ["byblos"])
    await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 9000})
    tour = (await guide.put("/api/v1/guides/me/tours", json=_tour())).json()
    await _photo(guide, profile["organization_id"], tour["id"])
    assert (await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/publish")).status_code == 200

    me = await _register(traveller, "planner", verify=True)
    plan = await _plan(me["id"])
    asked = (
        await traveller.post(
            "/api/v1/guides/engagements", json={"version_id": plan["version_id"], "guide_slug": profile["slug"]}
        )
    ).json()

    suspended = await admin.post(
        f"/api/v1/admin/guides/{profile['id']}", json={"decision": "suspended", "reason": "Safety review"}
    )
    assert suspended.status_code == 200, suspended.text

    async with TestingSessionLocal() as session:
        status = (
            await session.execute(text("SELECT status FROM app.experiences WHERE id = :id"), {"id": tour["id"]})
        ).scalar_one()
        events = (
            (
                await session.execute(
                    text("SELECT event_type FROM app.outbox WHERE aggregate_id IN (:e, :g)"),
                    {"e": asked["id"], "g": profile["id"]},
                )
            )
            .scalars()
            .all()
        )
    assert status == "paused", "a suspended guide's tours stop being bookable"
    assert (await traveller.get(f"/api/v1/guides/engagements/{asked['id']}")).json()["state"] == "cancelled"
    assert "engagement.cancelled_by_guide" in events, "the traveller is told"
    assert "guide.application_decided" in events, "and so is the guide"
    assert (await traveller.get(f"/api/v1/guides/{profile['slug']}")).status_code == 404


@pytest.mark.asyncio
async def test_either_side_reports_a_day_and_safety_is_escalated(clients: dict[str, AsyncClient]) -> None:
    guide, admin, traveller, stranger = clients["guide"], clients["admin"], clients["traveller"], clients["stranger"]
    profile = await _approve(guide, admin, "licensed", ["byblos"])
    await guide.put("/api/v1/guides/me/hire-terms", json={"day_rate_minor": 9000})
    me = await _register(traveller, "reporter", verify=True)
    plan = await _plan(me["id"])
    asked = (
        await traveller.post(
            "/api/v1/guides/engagements", json={"version_id": plan["version_id"], "guide_slug": profile["slug"]}
        )
    ).json()

    report = await traveller.post(
        "/api/v1/guides/reports",
        json={"category": "safety", "details": "The guide drove dangerously fast", "engagement_id": asked["id"]},
    )
    assert report.status_code == 200, report.text
    assert report.json()["escalated"] is True
    from_guide = await guide.post(
        "/api/v1/guides/reports",
        json={"category": "no_show", "details": "Nobody came to the meeting point", "engagement_id": asked["id"]},
    )
    assert from_guide.status_code == 200 and from_guide.json()["escalated"] is False

    await _register(stranger, "outsider")
    outsider = await stranger.post(
        "/api/v1/guides/reports",
        json={"category": "other", "details": "I was not on this day at all", "engagement_id": asked["id"]},
    )
    assert outsider.status_code == 404

    async with TestingSessionLocal() as session:
        cases = (
            await session.execute(
                text(
                    "SELECT reason, escalated_at IS NOT NULL AS escalated FROM app.support_cases "
                    "WHERE organization_id = :org ORDER BY created_at"
                ),
                {"org": profile["organization_id"]},
            )
        ).all()
    assert [(c.reason, c.escalated) for c in cases] == [("guide_safety", True), ("guide_no_show", False)]


@pytest.mark.asyncio
async def test_the_funnel_counts_each_step(clients: dict[str, AsyncClient]) -> None:
    guide, admin = clients["guide"], clients["admin"]
    await _approve(guide, admin, "licensed", ["byblos"])
    funnel = await admin.get("/api/v1/admin/guide-funnel", params={"days": 30})
    assert funnel.status_code == 200, funnel.text
    body = funnel.json()
    assert body["applications"]["approved"] >= 1
    assert body["guides"]["approved"] >= 1
    assert set(body) >= {"tours", "tour_requests", "engagements", "days_completed", "proposals", "reviews", "reports"}
    assert (await guide.get("/api/v1/admin/guide-funnel")).status_code in {401, 403}


@pytest.mark.asyncio
async def test_a_guides_booking_notifications_link_to_the_guide_screens(clients: dict[str, AsyncClient]) -> None:
    guide, admin, traveller = clients["guide"], clients["admin"], clients["traveller"]
    profile = await _approve(guide, admin, "licensed", ["beirut"])
    tour = (await guide.put("/api/v1/guides/me/tours", json=_tour())).json()
    await _photo(guide, profile["organization_id"], tour["id"])
    await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/publish")
    await guide.put(
        "/api/v1/guides/me/availability",
        json={"pattern": [{"weekday": d, "start": "10:00"} for d in range(7)], "min_notice_hours": 1},
    )
    await guide.post(f"/api/v1/guides/me/tours/{tour['id']}/slots", params={"days": 7})
    listed = (await traveller.get(f"/api/v1/guides/{profile['slug']}/tours")).json()[0]
    await _register(traveller, "booker", verify=True)
    booking = (
        await traveller.post(
            f"/api/v1/guides/tours/{listed['slug']}/request",
            json={"slot_id": listed["next_slots"][0]["id"], "party_size": 1},
        )
    ).json()

    async with TestingSessionLocal() as session:
        for_guide = (
            await session.execute(
                text(
                    "SELECT app.notification_deep_link('business.booking_requested', jsonb_build_object('booking_id', CAST(:b AS text)))"
                ),
                {"b": booking["id"]},
            )
        ).scalar_one()
        other = (
            await session.execute(
                text(
                    "SELECT app.notification_deep_link('business.booking_requested', jsonb_build_object('booking_id', "
                    "CAST(:b AS text)))"
                ),
                {"b": "00000000-0000-0000-0000-000000000000"},
            )
        ).scalar_one()
        path = (
            await session.execute(
                text("SELECT app.notification_deep_link('guide.proposal_decided', '{\"path\": \"/guide/contribute\"}')")
            )
        ).scalar_one()
    assert for_guide == "/guide/requests", "a guide never lands in the hidden business portal"
    assert other.startswith("/business/bookings"), "an ordinary business keeps its portal link"
    assert path == "/guide/contribute"


@pytest.mark.asyncio
async def test_hiring_requests_are_rate_limited_per_account(clients: dict[str, AsyncClient]) -> None:
    traveller = clients["traveller"]
    await _register(traveller, "eager", verify=True)
    statuses = []
    for _ in range(11):
        response = await traveller.post(
            "/api/v1/guides/engagements",
            json={"version_id": "00000000-0000-0000-0000-000000000000", "guide_slug": "nobody"},
        )
        statuses.append(response.status_code)
    assert statuses[:10] == [404] * 10
    assert statuses[10] == 429
