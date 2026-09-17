"""Every consequential action leaves an audit record (MSHWAR-109).

For each action type the test performs the action through the API and then
checks the audit log for a row written in that request: the right actor, an
action name for that type, the target, and - for admin decisions - the reason.
The log itself is append-only and searchable by admins.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator, Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, get_mailer, set_mailer
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.test_admin import _completed_booking
from tests.test_booking_payments import _published_listing, _traveller


@dataclass
class Ops:
    admin: AsyncClient
    admin_id: str
    owner: AsyncClient
    owner_id: str
    traveller: AsyncClient
    traveller_id: str
    traveller_email: str
    org_id: str
    listing: dict[str, Any]
    booking_id: str
    review_id: str


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _grant(user_id: str, tier: str) -> None:
    async with TestingSessionLocal() as session:
        await session.execute(
            text("SELECT app.grant_platform_admin(:user_id, NULL, :tier)"), {"user_id": user_id, "tier": tier}
        )
        await session.commit()


@pytest.fixture
async def ops() -> AsyncGenerator[Ops, None]:
    set_mailer(RecordingMailer())
    admin, owner, traveller = _client(), _client(), _client()
    catalog = await _published_listing(owner, mode="request", capacity=5)
    customer = await _traveller(traveller)
    slot = catalog["slots"]["slots"][0]
    listing = catalog["listing"]
    quote = (
        await traveller.post(
            "/api/v1/checkout/quote", json={"listing_slug": listing["slug"], "slot_id": slot["id"], "party_size": 1}
        )
    ).json()
    key = f"audit-{uuid4().hex[:10]}"
    booking = await traveller.post(
        "/api/v1/checkout/commit",
        json={
            "listing_slug": listing["slug"],
            "slot_id": slot["id"],
            "party_size": 1,
            "price_rule_id": quote["price_rule_id"],
            "policy_id": quote["policy_id"],
            "idempotency_key": key,
        },
        headers={"Idempotency-Key": key},
    )
    assert booking.status_code == 200, booking.text
    reviewed = await _completed_booking(catalog["org"]["id"], listing, str(customer["id"]))
    review = await traveller.post(
        "/api/v1/reviews", json={"booking_id": reviewed, "rating": 4, "body": "Lovely afternoon by the sea."}
    )
    assert review.status_code == 200, review.text
    admin_user = (
        await admin.post(
            "/api/v1/auth/register",
            json={
                "accept_terms": True,
                "email": f"auditor-{uuid4().hex[:8]}@example.com",
                "password": "long-enough-secret",
                "display_name": "Auditor",
                "locale": "en",
            },
        )
    ).json()
    await _grant(admin_user["id"], "elevated")
    yield Ops(
        admin=admin,
        admin_id=admin_user["id"],
        owner=owner,
        owner_id=str(catalog["owner"]["id"]),
        traveller=traveller,
        traveller_id=str(customer["id"]),
        traveller_email=str(customer["email"]),
        org_id=catalog["org"]["id"],
        listing=listing,
        booking_id=booking.json()["id"],
        review_id=review.json()["id"],
    )
    for client in (admin, owner, traveller):
        await client.aclose()
    set_mailer(None)


async def _rows_for_request(request_id: str) -> list[dict[str, Any]]:
    async with TestingSessionLocal() as session:
        rows = (
            (
                await session.execute(
                    text(
                        "SELECT actor_id::text AS actor_id, action, table_name, row_key, changes, reason "
                        "FROM app.audit_log WHERE request_id = :rid ORDER BY created_at"
                    ),
                    {"rid": request_id},
                )
            )
            .mappings()
            .all()
        )
    return [dict(row) for row in rows]


Action = Callable[[Ops], Awaitable[Any]]


async def _call(client: AsyncClient, method: str, path: str, body: Any = None) -> str:
    request_id = f"audit-{uuid4().hex}"
    response = await client.request(
        method,
        path,
        json=body,
        headers={"X-Request-ID": request_id, "Idempotency-Key": f"idem-{uuid4().hex[:12]}"},
    )
    assert response.status_code < 300, f"{method} {path}: {response.status_code} {response.text}"
    assert response.headers["x-request-id"] == request_id
    return request_id


@dataclass
class Case:
    actor: str  # "admin", "owner" or "traveller"
    method: str
    path: Callable[[Ops], str]
    body: Callable[[Ops], Any]
    action: str  # prefix of the expected audit action
    reason: str | None = None


START = (datetime.now(UTC) + timedelta(days=30)).replace(microsecond=0)

CASES: dict[str, Case] = {
    "business verification": Case(
        "admin",
        "POST",
        lambda o: f"/api/v1/admin/organizations/{o.org_id}/suspend",
        lambda o: {"reason": "Complaint under review"},
        "verification_",
        "Complaint under review",
    ),
    "content moderation": Case(
        "admin",
        "POST",
        lambda o: f"/api/v1/admin/moderation/review/{o.review_id}",
        lambda o: {"action": "hide", "reason": "Personal attack"},
        "moderation_hide",
        "Personal attack",
    ),
    "admin role grant": Case(
        "admin",
        "POST",
        lambda o: "/api/v1/admin/roles",
        lambda o: {"user_id": o.traveller_id, "tier": "ops"},
        "admin_grant",
    ),
    "taxonomy change": Case(
        "admin",
        "POST",
        lambda o: "/api/v1/admin/taxonomy",
        lambda o: {"kind": "category", "slug": f"audit-{uuid4().hex[:8]}", "label": "Audit", "reason": "New theme"},
        "taxonomy_create",
        "New theme",
    ),
    "configuration": Case(
        "admin",
        "PUT",
        lambda o: "/api/v1/admin/config",
        lambda o: {
            "key": "marketplace.fees",
            "value": {"commission_bps": 900, "service_fee_minor": 0},
            "reason": "Pilot fee",
        },
        "config_put",
        "Pilot fee",
    ),
    "feature flag": Case(
        "admin",
        "PUT",
        lambda o: "/api/v1/admin/flags",
        lambda o: {
            "key": "planner.v2",
            "environment": "development",
            "cohort": "staff",
            "enabled": True,
            "payload": {},
            "reason": "Preview",
        },
        "config_put",
        "Preview",
    ),
    "financial override": Case(
        "admin",
        "POST",
        lambda o: f"/api/v1/admin/bookings/{o.booking_id}/force-cancel",
        lambda o: {"reason": "Guest asked support"},
        "booking_force_cancel",
        "Guest asked support",
    ),
    "support case": Case(
        "admin",
        "POST",
        lambda o: "/api/v1/admin/cases",
        lambda o: {"reason": "Guest cannot find confirmation", "evidence": []},
        "support_cases.insert",
    ),
    "weather threshold": Case(
        "admin",
        "PUT",
        lambda o: "/api/v1/admin/weather-thresholds",
        lambda o: {"key": "precip_mm", "value_numeric": 7},
        "weather_warning_thresholds.",
    ),
    "ranker weights": Case(
        "admin",
        "PUT",
        lambda o: "/api/v1/planner/admin/ranker",
        lambda o: {"version": f"ranker-{uuid4().hex[:6]}", "weights": {"preference": 0.5}, "notes": "audit"},
        "planner_ranker_weights.",
    ),
    "catalogue collection": Case(
        "admin",
        "POST",
        lambda o: "/api/v1/catalogue/collections",
        lambda o: {
            "slug": f"audit-{uuid4().hex[:8]}",
            "title": "Audit picks",
            "status": "draft",
            "experience_slugs": [],
        },
        "collection.created",
    ),
    "listing status (catalogue)": Case(
        "admin",
        "POST",
        lambda o: f"/api/v1/catalogue/experiences/{o.listing['slug']}/unpublish",
        lambda o: None,
        "listing.status_changed",
    ),
    "listing status (portal)": Case(
        "owner",
        "POST",
        lambda o: f"/api/v1/portal/organizations/{o.org_id}/experiences/{o.listing['id']}/status",
        lambda o: {"status": "paused"},
        "experiences.update",
    ),
    "booking decision (business)": Case(
        "owner",
        "POST",
        lambda o: f"/api/v1/portal/organizations/{o.org_id}/bookings/{o.booking_id}/respond",
        lambda o: {"status": "rejected", "reason": "Fully booked that day"},
        "bookings.update",
    ),
    "staff invitation": Case(
        "owner",
        "POST",
        lambda o: f"/api/v1/portal/organizations/{o.org_id}/staff/invitations",
        lambda o: {"email": f"staff-{uuid4().hex[:6]}@example.com", "role": "bookings"},
        "staff_invitations.insert",
    ),
    "availability blackout": Case(
        "owner",
        "POST",
        lambda o: f"/api/v1/portal/organizations/{o.org_id}/blackouts",
        lambda o: {
            "experience_id": o.listing["id"],
            "start": START.isoformat(),
            "end": (START + timedelta(hours=3)).isoformat(),
            "reason": "Private event",
        },
        "blackouts.insert",
    ),
    "review response": Case(
        "owner",
        "POST",
        lambda o: f"/api/v1/portal/organizations/{o.org_id}/reviews/{o.review_id}/responses",
        lambda o: {"body": "Thank you for visiting us."},
        "review_responses.insert",
    ),
    "notification routing": Case(
        "owner",
        "PUT",
        lambda o: f"/api/v1/portal/organizations/{o.org_id}/notification-preferences",
        lambda o: {"role": "owner", "event_type": "business.booking.requested", "in_app": True, "email": False},
        "notification_role_pref",
    ),
    "group trip sharing": Case(
        "traveller",
        "POST",
        lambda o: f"/api/v1/groups/trips/{o.listing['trip_id']}/share-links",
        lambda o: {"role": "view"},
        "trip_share_links.insert",
    ),
    "account data export": Case("traveller", "GET", lambda o: "/api/v1/privacy/export", lambda o: None, "export"),
}


async def _prepare(o: Ops, name: str) -> None:
    if name == "group trip sharing":
        trip = await o.traveller.post("/api/v1/trips", json={"name": "Audit trip"})
        o.listing["trip_id"] = trip.json()["id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("name", sorted(CASES))
async def test_consequential_action_is_audited(ops: Ops, name: str) -> None:
    case = CASES[name]
    await _prepare(ops, name)
    client = {"admin": ops.admin, "owner": ops.owner, "traveller": ops.traveller}[case.actor]
    actor_id = {"admin": ops.admin_id, "owner": ops.owner_id, "traveller": ops.traveller_id}[case.actor]
    request_id = await _call(client, case.method, case.path(ops), case.body(ops))
    rows = await _rows_for_request(request_id)
    matching = [row for row in rows if row["action"].startswith(case.action)]
    assert matching, f"{name}: no '{case.action}*' audit row; got {[row['action'] for row in rows]}"
    row = matching[0]
    assert row["actor_id"] == actor_id, f"{name}: actor {row['actor_id']} != {actor_id}"
    assert row["row_key"], f"{name}: audit row has no target"
    if case.reason:
        assert case.reason in (row["reason"] or "") or any(case.reason in (r["reason"] or "") for r in matching)
    dumped = str(rows)
    assert ops.traveller_email not in dumped, "personal data must not be copied into the audit log"


@pytest.mark.asyncio
async def test_password_reset_is_audited(ops: Ops) -> None:
    request = await ops.traveller.post("/api/v1/auth/forgot-password", json={"email": ops.traveller_email})
    assert request.status_code == 200
    mailer = get_mailer()
    assert isinstance(mailer, RecordingMailer)
    token = mailer.reset_tokens_for(ops.traveller_email)[-1]
    request_id = await _call(
        ops.traveller, "POST", "/api/v1/auth/reset-password", {"token": token, "password": "a-new-long-secret"}
    )
    rows = await _rows_for_request(request_id)
    reset = [row for row in rows if row["action"] == "account.password_reset"]
    assert reset and reset[0]["actor_id"] == ops.traveller_id
    assert reset[0]["changes"]["sessions_revoked"] >= 1


@pytest.mark.asyncio
async def test_audit_log_is_append_only(ops: Ops) -> None:
    async with TestingSessionLocal() as session:
        for statement in (
            "UPDATE app.audit_log SET reason = 'tampered'",
            "DELETE FROM app.audit_log",
            "TRUNCATE app.audit_log",
        ):
            with pytest.raises(Exception, match="immutable record"):
                async with session.begin_nested():
                    await session.execute(text(statement))
        await session.rollback()


@pytest.mark.asyncio
async def test_trigger_rows_keep_field_names_but_not_personal_values(ops: Ops) -> None:
    request_id = await _call(
        ops.owner,
        "PUT",
        f"/api/v1/portal/organizations/{ops.org_id}/contacts",
        {"public_phone": "+961 70 123 456", "public_email": "hello@kitchen.example"},
    )
    rows = await _rows_for_request(request_id)
    org_rows = [row for row in rows if row["table_name"] == "organizations"]
    dumped = str(rows)
    assert "70 123 456" not in dumped
    assert "hello@kitchen.example" not in dumped
    if org_rows:
        assert org_rows[0]["changes"]["fields"]


@pytest.mark.asyncio
async def test_admin_can_search_and_filter_the_audit_log(ops: Ops) -> None:
    reason = f"Search check {uuid4().hex[:6]}"
    request_id = await _call(
        ops.admin, "POST", f"/api/v1/admin/bookings/{ops.booking_id}/force-cancel", {"reason": reason}
    )
    by_action = await ops.admin.get("/api/v1/admin/audit", params={"action": "booking_force", "limit": 5})
    assert by_action.status_code == 200, by_action.text
    items = by_action.json()["items"]
    assert items and all(item["action"].startswith("booking_force") for item in items)
    assert items[0]["reason"] == reason
    assert items[0]["actor"] == {"kind": "admin", "id": ops.admin_id, "display_name": "Auditor"}

    by_request = (await ops.admin.get("/api/v1/admin/audit", params={"request_id": request_id})).json()["items"]
    assert {item["request_id"] for item in by_request} == {request_id}
    by_actor = (await ops.admin.get("/api/v1/admin/audit", params={"actor_id": ops.admin_id})).json()["items"]
    assert by_actor and all(item["actor"].get("id") == ops.admin_id for item in by_actor)
    by_target = (
        await ops.admin.get("/api/v1/admin/audit", params={"target_type": "bookings", "target_id": ops.booking_id})
    ).json()["items"]
    assert by_target and all(item["target_id"] == ops.booking_id for item in by_target)
    wildcard = (await ops.admin.get("/api/v1/admin/audit", params={"action": "%"})).json()["items"]
    assert wildcard == []  # LIKE wildcards are matched literally

    first = (await ops.admin.get("/api/v1/admin/audit", params={"limit": 2})).json()
    assert len(first["items"]) == 2 and first["next_cursor"]
    second = (
        await ops.admin.get(
            "/api/v1/admin/audit",
            params={
                "limit": 2,
                "before": first["next_cursor"]["before"],
                "before_id": first["next_cursor"]["before_id"],
            },
        )
    ).json()
    assert not {item["id"] for item in first["items"]} & {item["id"] for item in second["items"]}

    filters = (await ops.admin.get("/api/v1/admin/audit/filters")).json()
    assert "booking_force_cancel" in filters["actions"]
    assert "bookings" in filters["target_types"]

    denied = await ops.traveller.get("/api/v1/admin/audit")
    assert denied.status_code == 403
