"""Guide plan step 7: quality, levels and ranking.

The rules worth protecting: a traveller rates four parts and the guide replies once, in
public, only to a published review; an admin can hide a review or remove a reply, with a
reason; levels follow the public thresholds and a guide who slips keeps the level for 30
days; the ranking score has visible parts and a prior, so two 5-star reviews do not beat
eighty at 4.9; and strikes warn, then pause new bookings, then suspend.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from datetime import timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_after_booking import _book, _ready, _slot
from tests.test_guide_day import _tour_that_ran
from tests.test_guide_tours import _client, _register

JOB = {"X-Job-Token": settings.job_token}


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {
        "guide": _client(),
        "admin": _client(),
        "maya": _client(),
        "omar": _client(),
        "traveller": _client(),
        "stranger": _client(),
        "anon": _client(),
        "other": _client(),
    }
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


async def _sql(query: str, params: dict[str, Any] | None = None) -> Any:
    async with TestingSessionLocal() as session:
        value = (await session.execute(text(query), params or {})).scalar_one()
        await session.commit()
        return value


# ---- Reviews ----------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_parts_a_single_public_reply_and_moderation(clients: dict[str, AsyncClient]) -> None:
    guide, maya, stranger, admin = clients["guide"], clients["maya"], clients["stranger"], clients["admin"]
    ran = await _tour_that_ran(clients)
    day = ran["slot_id"]
    await guide.post(f"/api/v1/guides/me/days/{day}/start")
    run_id = (await guide.post(f"/api/v1/guides/me/days/{day}/complete")).json()["run"]["id"]
    slug = ran["profile"]["slug"]

    bad = await maya.post("/api/v1/guides/reviews", json={"run_id": run_id, "rating": 5, "parts": {"knowledge": 6}})
    assert bad.status_code == 422
    unknown = await maya.post("/api/v1/guides/reviews", json={"run_id": run_id, "rating": 5, "parts": {"charm": 5}})
    assert unknown.status_code == 422
    written = await maya.post(
        "/api/v1/guides/reviews",
        json={
            "run_id": run_id,
            "rating": 5,
            "body": "Knew every alley",
            "parts": {"knowledge": 5, "communication": 4, "route": 5},
        },
    )
    assert written.status_code == 200, written.text
    review_id = written.json()["id"]

    early = await guide.post(f"/api/v1/guides/reviews/{review_id}/reply", json={"body": "Thank you!"})
    assert early.status_code == 422, "no reply before the review is published"

    ours = await guide.post(
        "/api/v1/guides/reviews", json={"run_id": run_id, "traveller_id": ran["maya"]["id"], "rating": 5}
    )
    assert ours.status_code == 200, ours.text

    public = (await stranger.get(f"/api/v1/guides/{slug}/reviews")).json()
    assert public["count"] == 1
    assert public["parts"] == {"knowledge": 5.0, "communication": 4.0, "value": None, "route": 5.0}
    assert public["recent"][0]["parts"]["value"] is None and public["recent"][0]["reply"] is None

    await _register(stranger, "review-stranger")
    assert (
        await stranger.post(f"/api/v1/guides/reviews/{review_id}/reply", json={"body": "Not mine"})
    ).status_code == 404, "only the guide reviewed can reply"
    replied = await guide.post(f"/api/v1/guides/reviews/{review_id}/reply", json={"body": "Thank you, Maya!"})
    assert replied.status_code == 200, replied.text
    again = await guide.post(f"/api/v1/guides/reviews/{review_id}/reply", json={"body": "One more"})
    assert again.status_code == 422, "one reply only"
    public = (await stranger.get(f"/api/v1/guides/{slug}/reviews")).json()
    assert public["recent"][0]["reply"] == "Thank you, Maya!"
    inbox = (await guide.get("/api/v1/guides/reviews/inbox")).json()
    assert inbox["about_me_as_guide"][0]["reply"] == "Thank you, Maya!"
    notified = await _sql(
        "SELECT count(*) FROM app.notifications WHERE user_id = CAST(:u AS uuid) AND event_type = 'guide.review_reply'",
        {"u": ran["maya"]["id"]},
    )
    assert notified >= 1

    # Moderation: admins only, with a reason; hiding removes it from the page.
    assert (await guide.get("/api/v1/admin/guide-reviews")).status_code in (401, 403)
    listed = await admin.get("/api/v1/admin/guide-reviews", params={"state": "replied"})
    assert listed.status_code == 200, listed.text
    assert any(row["id"] == review_id for row in listed.json())
    no_reason = await admin.post(f"/api/v1/admin/guide-reviews/{review_id}", json={"action": "hide"})
    assert no_reason.status_code == 422
    hidden = await admin.post(
        f"/api/v1/admin/guide-reviews/{review_id}", json={"action": "hide", "reason": "Personal details in it"}
    )
    assert hidden.status_code == 200, hidden.text
    assert (await stranger.get(f"/api/v1/guides/{slug}/reviews")).json()["count"] == 0
    await admin.post(f"/api/v1/admin/guide-reviews/{review_id}", json={"action": "show"})
    removed = await admin.post(
        f"/api/v1/admin/guide-reviews/{review_id}", json={"action": "remove_reply", "reason": "Shares a phone number"}
    )
    assert removed.status_code == 200
    public = (await stranger.get(f"/api/v1/guides/{slug}/reviews")).json()
    assert public["count"] == 1 and public["recent"][0]["reply"] is None


# ---- Levels and ranking ----------------------------------------------------------------------------


def _stats(**overrides: Any) -> str:
    stats: dict[str, Any] = {
        "completed_runs": 0,
        "recent_runs": 0,
        "reviews": 0,
        "rating": None,
        "requests_due": 0,
        "answered_24h": 0,
        "answered_24h_rate": None,
        "median_response_minutes": None,
        "requests_accepted": 0,
        "bookings_held": 0,
        "guide_cancellations": 0,
        "cancel_rate": 0,
        "completeness": 1,
        "approved_at": None,
    }
    stats.update(overrides)
    return json.dumps(stats)


@pytest.mark.asyncio
async def test_levels_follow_the_public_thresholds() -> None:
    async def earned(**overrides: Any) -> str:
        return str(await _sql("SELECT app.guide_level_earned(CAST(:s AS jsonb))", {"s": _stats(**overrides)}))

    assert await earned() == "new"
    trusted = {"completed_runs": 5, "rating": 4.6, "requests_due": 10, "answered_24h_rate": 0.9, "cancel_rate": 0.05}
    assert await earned(**trusted) == "trusted"
    assert await earned(**{**trusted, "rating": 4.5}) == "new"
    assert await earned(**{**trusted, "answered_24h_rate": 0.8}) == "new"
    assert await earned(**{**trusted, "cancel_rate": 0.06}) == "new"
    assert await earned(**{**trusted, "rating": None}) == "new", "no reviews, no rating, no level"
    assert await earned(**{**trusted, "requests_due": 0, "answered_24h_rate": None}) == "trusted", (
        "a guide with only instant bookings has no requests to be slow on"
    )
    top = {"completed_runs": 25, "rating": 4.8, "requests_due": 10, "median_response_minutes": 90, "cancel_rate": 0.02}
    assert await earned(**{**top, "answered_24h_rate": 1}) == "top"
    assert await earned(**{**top, "median_response_minutes": 150, "answered_24h_rate": 1}) == "trusted"


@pytest.mark.asyncio
async def test_the_score_has_a_prior_and_visible_parts() -> None:
    async def score(level: str = "new", **overrides: Any) -> dict[str, Any]:
        value = await _sql(
            "SELECT app.guide_rank_parts(CAST(:s AS jsonb), :level)", {"s": _stats(**overrides), "level": level}
        )
        return dict(value)

    few = await score(reviews=2, rating=5.0)
    many = await score(reviews=80, rating=4.9)
    assert many["parts"]["review"] > few["parts"]["review"], "two 5-star reviews do not beat eighty at 4.9"
    assert set(many["parts"]) == {"review", "response", "reliability", "conversion", "completeness", "freshness"}
    slow = await score(requests_due=10, answered_24h_rate=0.5, median_response_minutes=1200)
    fast = await score(requests_due=10, answered_24h_rate=1, median_response_minutes=30)
    assert fast["parts"]["response"] > slow["parts"]["response"]
    flaky = await score(bookings_held=10, guide_cancellations=3)
    assert flaky["parts"]["reliability"] < (await score(bookings_held=10))["parts"]["reliability"]
    assert (await score("top"))["score"] > (await score("trusted"))["score"] > (await score("new"))["score"]


@pytest.mark.asyncio
async def test_a_guide_who_slips_keeps_the_level_for_thirty_days(clients: dict[str, AsyncClient]) -> None:
    guide, anon = clients["guide"], clients["anon"]
    ready = await _ready(clients, "Jbeil old souk")
    profile_id = ready["profile"]["id"]

    run = await anon.post("/api/v1/guides/ops/levels", headers=JOB)
    assert run.status_code == 200, run.text
    mine = (await guide.get("/api/v1/guides/me/quality")).json()
    assert mine["level"] == "new" and mine["earned"] == "new"
    assert mine["thresholds"]["top"]["completed_runs"] == 25
    assert mine["ranking"]["boost"] >= 0.05, "new guides get a small boost for 60 days"
    assert set(mine["stats"]["profile"]) == {"bio", "languages", "photos", "meeting_point", "schedule"}
    assert mine["stats"]["profile"]["languages"] is True

    # Pretend the guide was Trusted: the numbers no longer say so, so the level is held.
    await _sql(
        "UPDATE app.guide_levels SET level = 'trusted', held_until = NULL WHERE guide_profile_id = CAST(:g AS uuid) "
        "RETURNING 1",
        {"g": profile_id},
    )
    await anon.post("/api/v1/guides/ops/levels", headers=JOB)
    held = (await guide.get("/api/v1/guides/me/quality")).json()
    assert held["level"] == "trusted" and held["earned"] == "new" and held["held_until"] is not None
    page = (await clients["stranger"].get(f"/api/v1/guides/{ready['profile']['slug']}")).json()
    assert page["level"] == "trusted"
    warned = await _sql(
        "SELECT count(*) FROM app.notifications WHERE user_id = CAST(:u AS uuid) AND event_type = 'guide.level_at_risk'",
        {"u": ready["guide_user"]},
    )
    assert warned >= 1

    await _sql(
        "UPDATE app.guide_levels SET held_until = now() - interval '1 minute' "
        "WHERE guide_profile_id = CAST(:g AS uuid) RETURNING 1",
        {"g": profile_id},
    )
    await anon.post("/api/v1/guides/ops/levels", headers=JOB)
    assert (await guide.get("/api/v1/guides/me/quality")).json()["level"] == "new"
    card = (await clients["stranger"].get(f"/api/v1/guides/tours/{ready['tour']['slug']}")).json()
    assert card["guide"]["level"] == "new"


# ---- Strikes ----------------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_strikes_warn_then_pause_then_suspend(clients: dict[str, AsyncClient]) -> None:
    guide, traveller, admin = clients["guide"], clients["traveller"], clients["admin"]
    title = f"Strike test walk {uuid4().hex[:8]}"
    ready = await _ready(clients, title)
    tour, profile_id = ready["tour"], ready["profile"]["id"]
    await _register(traveller, "strike-traveller", verify=True)

    # Cancelling a confirmed booking a day before is a strike, recorded automatically.
    soon = await _book(traveller, tour["slug"], await _slot(tour["id"], timedelta(days=1)))
    cancelled = await guide.post(f"/api/v1/guides/bookings/{soon['id']}/cancel", json={"reason": "I am unwell"})
    assert cancelled.status_code == 200, cancelled.text
    quality = (await guide.get("/api/v1/guides/me/quality")).json()
    assert quality["active_strikes"] == 1 and quality["strikes"][0]["automatic"] is True
    assert quality["paused_until"] is None

    # Well ahead of time it only counts in reliability.
    later = await _book(traveller, tour["slug"], await _slot(tour["id"], timedelta(days=10)))
    await guide.post(f"/api/v1/guides/bookings/{later['id']}/cancel", json={"reason": "Change of plans"})
    assert (await guide.get("/api/v1/guides/me/quality")).json()["active_strikes"] == 1

    # A second strike, after an admin checked a report: new bookings pause.
    assert (
        await guide.post(f"/api/v1/admin/guides/{profile_id}/strikes", json={"kind": "no_show", "reason": "x" * 5})
    ).status_code in (401, 403)
    second = await admin.post(
        f"/api/v1/admin/guides/{profile_id}/strikes",
        json={"kind": "no_show", "reason": "Did not come to the meeting point (case checked)"},
    )
    assert second.status_code == 200, second.text
    assert second.json()["outcome"] == "paused"
    paused_slot = await _slot(tour["id"], timedelta(days=5))
    refused = await traveller.post(
        f"/api/v1/guides/tours/{tour['slug']}/book",
        json={"slot_id": paused_slot, "adults": 1},
        headers={"Idempotency-Key": f"paused-{uuid4().hex}"},
    )
    assert refused.status_code == 409 and "not taking new bookings" in refused.text
    listed = (await clients["anon"].get("/api/v1/guides/tours", params={"q": title})).json()
    assert listed["total"] == 0, "a paused guide's tours are not listed"

    # Withdrawing one lifts the pause.
    board = (await admin.get("/api/v1/admin/guide-quality", params={"q": ready["profile"]["display_name"]})).json()
    row = next(item for item in board if item["id"] == profile_id)
    assert row["active_strikes"] == 2 and row["paused_until"] is not None
    manual = next(strike for strike in row["strikes"] if not strike["automatic"])
    voided = await admin.post(f"/api/v1/admin/guide-strikes/{manual['id']}/void", json={"reason": "Appeal upheld"})
    assert voided.status_code == 200, voided.text
    again = await admin.post(f"/api/v1/admin/guide-strikes/{manual['id']}/void", json={"reason": "Twice"})
    assert again.status_code == 422
    mine = (await guide.get("/api/v1/guides/me/quality")).json()
    assert mine["active_strikes"] == 1 and mine["paused_until"] is None
    assert (await _book(traveller, tour["slug"], paused_slot))["status"] == "confirmed"

    # Three live strikes suspend the guide, which closes what is open.
    for kind in ("conduct", "safety"):
        await admin.post(f"/api/v1/admin/guides/{profile_id}/strikes", json={"kind": kind, "reason": "Checked report"})
    status = await _sql("SELECT status FROM app.guide_profiles WHERE id = CAST(:g AS uuid)", {"g": profile_id})
    assert status == "suspended"
    open_left = await _sql(
        "SELECT count(*) FROM app.bookings b JOIN app.slots s ON s.id = b.slot_id "
        "WHERE b.experience_id = CAST(:e AS uuid) AND b.status IN ('pending', 'confirmed') AND s.starts_at > now()",
        {"e": tour["id"]},
    )
    assert open_left == 0
