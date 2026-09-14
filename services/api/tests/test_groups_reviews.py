from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.test_admin import _completed_booking, _grant, _listing


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


async def _register(api: AsyncClient, email: str, name: str = "Traveller") -> dict[str, Any]:
    local, _, domain = email.partition("@")
    unique = f"{local}-{uuid4().hex[:8]}@{domain or 'example.com'}"
    response = await api.post(
        "/api/v1/auth/register",
        json={"email": unique, "password": "long-enough-secret", "display_name": name, "locale": "en"},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _trip(api: AsyncClient, name: str = "Coast weekend") -> str:
    created = await api.post("/api/v1/trips", json={"name": name})
    assert created.status_code == 200, created.text
    return created.json()["id"]


async def _term() -> str:
    term_id = str(uuid4())
    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO app.taxonomy (id, kind, slug, label, active)
                VALUES (:id, 'category', :slug, 'Food', true)
                """
            ),
            {"id": term_id, "slug": f"food-{uuid4().hex[:8]}"},
        )
        await session.commit()
    return term_id


@pytest.mark.asyncio
async def test_share_link_roles_guest_join_and_revoke(api: AsyncClient) -> None:
    owner = await _register(api, "owner-share@example.com", "Owner")
    trip_id = await _trip(api)
    created = await api.post(
        f"/api/v1/groups/trips/{trip_id}/share-links",
        json={"role": "vote", "allow_guest": True},
    )
    assert created.status_code == 200, created.text
    token = created.json()["token"]
    assert created.json()["join_path"] == f"/join/{token}"

    peek = await api.get(f"/api/v1/groups/join/{token}")
    assert peek.status_code == 200
    assert peek.json()["role"] == "vote"
    assert peek.json()["allow_guest"] is True
    assert peek.json()["joinable"] is True

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as guest:
        joined = await guest.post(f"/api/v1/groups/join/{token}", json={"display_name": "Nour"})
        assert joined.status_code == 200, joined.text
        assert joined.json()["actor"] == "guest"
        assert joined.json()["role"] == "vote"
        assert guest.cookies.get("mshwar_guest")
        trip = await guest.get(f"/api/v1/groups/trips/{trip_id}")
        assert trip.status_code == 200
        assert trip.json()["can_vote"] is True
        assert trip.json()["can_share"] is False

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as viewer:
        await _register(viewer, "viewer@example.com", "Viewer")
        view_link = await api.post(
            f"/api/v1/groups/trips/{trip_id}/share-links",
            json={"role": "view", "allow_guest": False},
        )
        view_token = view_link.json()["token"]
        joined_view = await viewer.post(f"/api/v1/groups/join/{view_token}", json={"display_name": "Viewer"})
        assert joined_view.status_code == 200
        denied = await viewer.put(
            f"/api/v1/groups/trips/{trip_id}/votes",
            json={"term_id": str(uuid4()), "value": 1},
        )
        assert denied.status_code == 404

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as guest_blocked:
            blocked = await guest_blocked.post(f"/api/v1/groups/join/{view_token}", json={"display_name": "Guest"})
            assert blocked.status_code == 404

    revoked = await api.post(f"/api/v1/groups/share-links/{created.json()['id']}/revoke")
    assert revoked.status_code == 200
    assert revoked.json()["revoked_at"]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as late:
        late_join = await late.post(f"/api/v1/groups/join/{token}", json={"display_name": "Late"})
        assert late_join.status_code == 404

    people = await api.get(f"/api/v1/groups/trips/{trip_id}/participants")
    assert people.status_code == 200
    names = {item["display_name"] for item in people.json()["items"]}
    assert owner["display_name"] in names
    assert "Nour" in names
    assert "Viewer" in names

    expired = await api.post(
        f"/api/v1/groups/trips/{trip_id}/share-links",
        json={"role": "edit", "allow_guest": True, "expires_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()},
    )
    assert expired.status_code == 422


@pytest.mark.asyncio
async def test_voting_tally_lock_and_summary_privacy(api: AsyncClient) -> None:
    await _register(api, "owner-vote@example.com", "Owner")
    trip_id = await _trip(api, "Food crawl")
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Vote Kitchen"})).json()
    listing = await _listing(api, org["id"])
    term_id = await _term()
    added_exp = await api.post(
        f"/api/v1/groups/trips/{trip_id}/suggestions",
        json={"experience_id": listing["id"]},
    )
    added_cat = await api.post(
        f"/api/v1/groups/trips/{trip_id}/suggestions",
        json={"term_id": term_id},
    )
    assert added_exp.status_code == 200, added_exp.text
    assert added_cat.status_code == 200, added_cat.text

    share = await api.post(
        f"/api/v1/groups/trips/{trip_id}/share-links",
        json={"role": "vote", "allow_guest": True},
    )
    token = share.json()["token"]

    await api.put(
        f"/api/v1/groups/trips/{trip_id}/votes",
        json={"experience_id": listing["id"], "value": 1},
    )
    await api.put(
        f"/api/v1/groups/trips/{trip_id}/votes",
        json={"term_id": term_id, "value": -1},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as voter:
        await _register(voter, "voter@example.com", "Voter")
        await voter.post(f"/api/v1/groups/join/{token}", json={"display_name": "Voter"})
        updated = await voter.put(
            f"/api/v1/groups/trips/{trip_id}/votes",
            json={"experience_id": listing["id"], "value": 1},
        )
        assert updated.status_code == 200, updated.text
        changed = await voter.put(
            f"/api/v1/groups/trips/{trip_id}/votes",
            json={"experience_id": listing["id"], "value": 1},
        )
        assert changed.status_code == 200
        await voter.put(
            f"/api/v1/groups/trips/{trip_id}/votes",
            json={"term_id": term_id, "value": 1},
        )
        secret = "unshared-private-club"
        async with TestingSessionLocal() as session:
            user_id = (
                await session.execute(
                    text("SELECT id FROM app.users WHERE display_name = 'Voter' ORDER BY created_at DESC")
                )
            ).scalar_one()
            await session.execute(
                text("UPDATE app.user_private SET preferences = CAST(:prefs AS jsonb) WHERE user_id = :user_id"),
                {"prefs": f'{{"interests":["{secret}"]}}', "user_id": str(user_id)},
            )
            await session.commit()
        shared = await voter.put(
            f"/api/v1/groups/trips/{trip_id}/shared-preferences",
            json={"shared_preferences": {"share": True, "default_group_size": 4}},
        )
        assert shared.status_code == 200

    tally = await api.get(f"/api/v1/groups/trips/{trip_id}/tally")
    assert tally.status_code == 200
    assert tally.json()["polled"] is True
    yes_counts = {item["kind"]: item["yes"] for item in tally.json()["items"]}
    assert yes_counts["experience"] == 2

    summary = await api.get(f"/api/v1/groups/trips/{trip_id}/summary")
    assert summary.status_code == 200
    dumped = summary.text
    assert secret not in dumped
    assert "agreement" in summary.json()
    assert "disagreement" in summary.json()
    assert "tradeoffs" in summary.json()
    assert summary.json()["sources"] == ["votes", "shared_preferences"]
    shared_prefs = summary.json()["shared_preferences"]
    assert shared_prefs
    assert all("unshared-private-club" not in str(item) for item in shared_prefs)
    assert any(item["preferences"].get("default_group_size") == 4 for item in shared_prefs)

    locked = await api.post(f"/api/v1/groups/trips/{trip_id}/lock")
    assert locked.status_code == 200
    assert locked.json()["status"] == "locked"
    assert locked.json()["locked_by"]
    assert locked.json()["locked_at"]
    closed = await api.put(
        f"/api/v1/groups/trips/{trip_id}/votes",
        json={"experience_id": listing["id"], "value": -1},
    )
    assert closed.status_code == 404


@pytest.mark.asyncio
async def test_review_eligibility_moderation_response_and_aggregates(api: AsyncClient) -> None:
    owner = await _register(api, "biz-review@example.com", "Host")
    org = (await api.post("/api/v1/portal/organizations", json={"name": "Review Kitchen"})).json()
    listing = await _listing(api, org["id"])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as guest:
        customer = await _register(guest, "stayed@example.com", "Lina")
        pending_booking = str(uuid4())
        async with TestingSessionLocal() as session:
            slot_id = str(uuid4())
            await session.execute(
                text(
                    """
                    INSERT INTO app.slots (
                        id, experience_id, starts_at, ends_at, capacity, reserved, authoritative, source, observed_at, status
                    ) VALUES (
                        :id, :experience_id, now() + interval '2 hours', now() + interval '4 hours',
                        10, 0, true, 'test', now(), 'open'
                    )
                    """
                ),
                {"id": slot_id, "experience_id": listing["id"]},
            )
            await session.execute(
                text(
                    """
                    INSERT INTO app.bookings (
                        id, customer_id, organization_id, experience_id, slot_id, party_size, status, mode,
                        hold_until, inventory_reserved, currency, total_minor, payment_required,
                        price_snapshot, policy_snapshot, request_key, request_hash
                    ) VALUES (
                        :id, :customer_id, :org_id, :experience_id, :slot_id, 2, 'pending', 'request',
                        now() + interval '12 hours', true, 'USD', 9000, false,
                        CAST(:price_snapshot AS jsonb), CAST(:policy_snapshot AS jsonb), :request_key, :request_hash
                    )
                    """
                ),
                {
                    "id": pending_booking,
                    "customer_id": customer["id"],
                    "org_id": org["id"],
                    "experience_id": listing["id"],
                    "slot_id": slot_id,
                    "price_snapshot": '{"schema_version":1}',
                    "policy_snapshot": '{"schema_version":1}',
                    "request_key": f"req-{uuid4().hex[:12]}",
                    "request_hash": uuid4().hex,
                },
            )
            await session.execute(
                text("UPDATE app.slots SET reserved = reserved + 2 WHERE id = :slot_id"),
                {"slot_id": slot_id},
            )
            await session.commit()
        too_early = await guest.post(
            "/api/v1/reviews",
            json={"booking_id": pending_booking, "rating": 5, "body": "Too soon to review."},
        )
        assert too_early.status_code == 403
        booking_id = await _completed_booking(org["id"], listing, customer["id"])
        eligibility = await guest.get("/api/v1/reviews/eligibility", params={"experience_id": listing["id"]})
        assert eligibility.status_code == 200
        assert eligibility.json()["can_review"] is True
        submitted = await guest.post(
            "/api/v1/reviews",
            json={
                "booking_id": booking_id,
                "rating": 5,
                "body": "Warm bread and a kind host.",
                "dimensions": {"food": 5, "service": 5},
            },
        )
        assert submitted.status_code == 200, submitted.text
        assert submitted.json()["verified"] is True
        duplicate = await guest.post(
            "/api/v1/reviews",
            json={"booking_id": booking_id, "rating": 4, "body": "Trying again."},
        )
        assert duplicate.status_code == 409
        review_id = submitted.json()["id"]
        reported = await guest.post(
            f"/api/v1/reviews/{review_id}/report",
            json={"reason": "This is a self-test report"},
        )
        assert reported.status_code == 200
        assert reported.json()["queued"] is True

    listed = await api.get("/api/v1/reviews", params={"experience_id": listing["id"]})
    assert listed.status_code == 200
    assert listed.json()["items"][0]["body"] == "Warm bread and a kind host."
    assert listed.json()["items"][0]["verified"] is True

    reply = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/reviews/{review_id}/responses",
        json={"body": "Thank you for coming — we baked extra."},
    )
    assert reply.status_code == 200, reply.text
    assert reply.json()["label"] == "Business response"
    second = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/reviews/{review_id}/responses",
        json={"body": "Trying to edit the story."},
    )
    assert second.status_code == 409
    hidden = await api.post(f"/api/v1/portal/organizations/{org['id']}/reviews/{review_id}/hide")
    assert hidden.status_code == 404
    deleted = await api.delete(f"/api/v1/portal/organizations/{org['id']}/reviews/{review_id}")
    assert deleted.status_code == 404

    await _grant(owner["id"], "ops")
    await api.post(
        f"/api/v1/admin/moderation/review_response/{reply.json()['id']}",
        json={"action": "restore", "reason": "Kind reply is fine"},
    )
    public = await api.get("/api/v1/reviews", params={"listing_slug": listing["slug"]})
    assert public.json()["items"][0]["response"]["label"] == "Business response"
    assert public.json()["items"][0]["response"]["body"] == "Thank you for coming — we baked extra."

    agg = await api.get("/api/v1/reviews/aggregates", params={"experience_id": listing["id"]})
    assert agg.status_code == 200
    assert agg.json()["count"] == 1
    assert agg.json()["low_sample"] is True
    assert "Too few reviews" in (agg.json()["honest"] or "")

    hidden_review = await api.post(
        f"/api/v1/admin/moderation/review/{review_id}",
        json={"action": "hide", "reason": "Policy hold"},
    )
    assert hidden_review.status_code == 200
    assert hidden_review.json()["snapshot"]["body"] == "Warm bread and a kind host."
    after_hide = await api.get("/api/v1/reviews/aggregates", params={"experience_id": listing["id"]})
    assert after_hide.json()["count"] == 0
    restored = await api.post(
        f"/api/v1/admin/moderation/review/{review_id}",
        json={"action": "restore", "reason": "False positive"},
    )
    assert restored.status_code == 200
    after_restore = await api.get("/api/v1/reviews/aggregates", params={"experience_id": listing["id"]})
    assert after_restore.json()["count"] == 1
    assert after_restore.json()["distribution"]["5"] == 1

    async with TestingSessionLocal() as session:
        with pytest.raises(Exception):  # noqa: B017
            await session.execute(text("UPDATE app.reviews SET body = 'rewritten' WHERE id = :id"), {"id": review_id})
            await session.commit()
        await session.rollback()
        body = (
            await session.execute(text("SELECT body FROM app.reviews WHERE id = :id"), {"id": review_id})
        ).scalar_one()
        assert body == "Warm bread and a kind host."

    favorites = await api.get("/api/v1/favorites")
    assert favorites.status_code == 200
    assert "items" in favorites.json()


@pytest.mark.asyncio
async def test_view_role_cannot_edit_or_lock(api: AsyncClient) -> None:
    await _register(api, "owner-lock@example.com", "Owner")
    trip_id = await _trip(api)
    link = await api.post(
        f"/api/v1/groups/trips/{trip_id}/share-links",
        json={"role": "view", "allow_guest": False},
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as viewer:
        await _register(viewer, "just-looking@example.com", "Looker")
        await viewer.post(f"/api/v1/groups/join/{link.json()['token']}", json={"display_name": "Looker"})
        suggest = await viewer.post(
            f"/api/v1/groups/trips/{trip_id}/suggestions",
            json={"term_id": await _term()},
        )
        assert suggest.status_code == 404
        lock = await viewer.post(f"/api/v1/groups/trips/{trip_id}/lock")
        assert lock.status_code == 404
        revoke = await viewer.post(f"/api/v1/groups/share-links/{link.json()['id']}/revoke")
        assert revoke.status_code == 404


@pytest.mark.asyncio
async def test_expired_share_link_cannot_join(api: AsyncClient) -> None:
    await _register(api, "owner-exp@example.com")
    trip_id = await _trip(api)
    created = await api.post(
        f"/api/v1/groups/trips/{trip_id}/share-links",
        json={
            "role": "vote",
            "allow_guest": True,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        },
    )
    token = created.json()["token"]
    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.trip_share_links SET expires_at = now() - interval '1 hour' WHERE id = :id"),
            {"id": created.json()["id"]},
        )
        await session.commit()
    peek = await api.get(f"/api/v1/groups/join/{token}")
    assert peek.json()["expired"] is True
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as guest:
        joined = await guest.post(f"/api/v1/groups/join/{token}", json={"display_name": "Too late"})
        assert joined.status_code == 404
