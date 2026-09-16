"""Regression tests for the security fixes in docs/code-review-report.md (C1–C5, H1–H3, H8, M3, M7)."""

from __future__ import annotations

import base64
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from starlette.requests import Request

from app.api.v1.endpoints.portal import csv_safe
from app.core.client_ip import client_ip
from app.core.config import settings
from app.core.sql import raise_from_db
from app.main import app
from app.payments.stripe_test import sign_stripe_payload
from tests.test_booking_payments import _email, _published_listing, _register, _traveller, api  # noqa: F401

_JOB_TOKEN = "t" * 40


@pytest.fixture
def production_like(monkeypatch: pytest.MonkeyPatch) -> None:
    """Dev endpoints off and a job token configured, as in staging/production."""
    monkeypatch.setattr(settings, "enable_dev_endpoints", False)
    monkeypatch.setattr(settings, "internal_job_token", _JOB_TOKEN)


async def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _booking_with_open_payment(api_client: AsyncClient) -> tuple[AsyncClient, str, dict[str, Any]]:
    catalog = await _published_listing(api_client, mode="instant", capacity=3)
    guest = await _client()
    await _traveller(guest)
    slot = catalog["slots"]["slots"][0]
    quote = (
        await guest.post(
            "/api/v1/checkout/quote",
            json={"listing_slug": catalog["listing"]["slug"], "slot_id": slot["id"], "party_size": 1},
        )
    ).json()
    key = f"sec-{uuid4().hex[:10]}"
    body = {
        "listing_slug": catalog["listing"]["slug"],
        "slot_id": slot["id"],
        "party_size": 1,
        "price_rule_id": quote["price_rule_id"],
        "policy_id": quote["policy_id"],
        "idempotency_key": key,
    }
    booking = (await guest.post("/api/v1/checkout/commit", json=body, headers={"Idempotency-Key": key})).json()
    paid = await guest.post(
        f"/api/v1/checkout/{booking['id']}/pay", json={}, headers={"Idempotency-Key": f"pay-{uuid4().hex[:10]}"}
    )
    assert paid.status_code == 200, paid.text
    return guest, booking["id"], paid.json()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/api/v1/checkout/ops/expire-holds"),
        ("post", "/api/v1/checkout/ops/publish-outbox"),
        ("get", "/api/v1/checkout/ops/metrics"),
        ("post", "/api/v1/notifications/dispatch"),
        ("post", "/api/v1/notifications/escalate"),
    ],
)
async def test_job_endpoints_need_the_job_token(
    api: AsyncClient,  # noqa: F811
    production_like: None,
    method: str,
    path: str,
) -> None:
    await _traveller(api)
    denied = await getattr(api, method)(path)
    assert denied.status_code == 401
    wrong = await getattr(api, method)(path, headers={"X-Job-Token": "nope"})
    assert wrong.status_code == 401
    allowed = await getattr(api, method)(path, headers={"X-Job-Token": _JOB_TOKEN})
    assert allowed.status_code == 200, allowed.text


@pytest.mark.asyncio
async def test_simulate_is_disabled_without_dev_flag(api: AsyncClient, production_like: None) -> None:  # noqa: F811
    await _traveller(api)
    response = await api.post(f"/api/v1/checkout/{uuid4()}/simulate", json={"outcome": "succeeded"})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_simulate_only_touches_your_own_booking(
    api: AsyncClient,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_realistic")  # intents stay "created"
    owner, booking_id, _ = await _booking_with_open_payment(api)
    stranger = await _client()
    await _traveller(stranger)
    foreign = await stranger.post(f"/api/v1/checkout/{booking_id}/simulate", json={"outcome": "cancelled"})
    assert foreign.status_code == 404
    assert (await owner.get(f"/api/v1/checkout/{booking_id}")).json()["status"] == "pending"
    bogus = await owner.post(f"/api/v1/checkout/{booking_id}/simulate", json={"outcome": "refunded"})
    assert bogus.status_code == 422
    own = await owner.post(f"/api/v1/checkout/{booking_id}/simulate", json={"outcome": "succeeded"})
    assert own.status_code == 200, own.text
    await owner.aclose()
    await stranger.aclose()


@pytest.mark.asyncio
async def test_webhooks_require_the_configured_secret(
    api: AsyncClient,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_realistic")
    guest, booking_id, paid = await _booking_with_open_payment(api)
    payload = json.dumps(
        {
            "id": f"evt_{uuid4().hex[:8]}",
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": paid["payment"]["provider_ref"], "status": "succeeded"}},
        }
    ).encode("utf-8")
    forged = sign_stripe_payload(payload, "whsec_local_stub")
    assert (
        await api.post("/api/v1/webhooks/payments", content=payload, headers={"stripe-signature": forged})
    ).status_code == 503
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_real_secret")
    assert (
        await api.post("/api/v1/webhooks/payments", content=payload, headers={"stripe-signature": forged})
    ).status_code == 400
    assert (await guest.get(f"/api/v1/checkout/{booking_id}")).json()["status"] == "pending"
    genuine = sign_stripe_payload(payload, "whsec_real_secret")
    accepted = await api.post("/api/v1/webhooks/payments", content=payload, headers={"stripe-signature": genuine})
    assert accepted.status_code == 200, accepted.text
    assert (await guest.get(f"/api/v1/checkout/{booking_id}")).json()["status"] == "confirmed"
    await guest.aclose()


@pytest.mark.asyncio
async def test_signed_file_download_cannot_escape_storage(api: AsyncClient) -> None:  # noqa: F811
    payload = json.dumps({"k": "../../../../../../etc/hostname", "e": 9999999999}, separators=(",", ":"))
    import hashlib
    import hmac

    digest = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(f"{payload}.{digest}".encode()).decode()
    response = await api.get(f"/api/v1/portal/files/{token}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_uploads_check_permission_before_writing(
    api: AsyncClient,  # noqa: F811
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "private_storage_dir", str(tmp_path))
    await _register(api, _email("owner"))
    org = (await api.post("/api/v1/portal/organizations", json={"name": f"Kitchen {uuid4().hex[:6]}"})).json()
    outsider = await _client()
    await _register(outsider, _email("outsider"))
    body = {
        "filename": "doc.pdf",
        "content_type": "application/pdf",
        "content_base64": base64.b64encode(b"%PDF-1.4 fake").decode(),
        "purpose": "verification",
    }
    denied = await outsider.post(f"/api/v1/portal/organizations/{org['id']}/files", json=body)
    assert denied.status_code == 403
    assert not any(path.is_file() for path in tmp_path.rglob("*"))

    mislabelled = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/files",
        json={**body, "content_base64": base64.b64encode(b"MZ executable").decode()},
    )
    assert mislabelled.status_code == 415
    wrong_type = await api.post(
        f"/api/v1/portal/organizations/{org['id']}/files", json={**body, "content_type": "text/html"}
    )
    assert wrong_type.status_code == 415
    monkeypatch.setattr(settings, "max_upload_bytes", 8)
    too_big = await api.post(f"/api/v1/portal/organizations/{org['id']}/files", json=body)
    assert too_big.status_code == 413
    assert not any(path.is_file() for path in tmp_path.rglob("*"))
    await outsider.aclose()


@pytest.mark.asyncio
async def test_signin_is_rate_limited(api: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setattr(settings, "signin_email_limit", 3)
    email = _email("victim")
    statuses = [
        (await api.post("/api/v1/auth/signin", json={"email": email, "password": "wrong-password"})).status_code
        for _ in range(4)
    ]
    assert statuses == [401, 401, 401, 429]


@pytest.mark.asyncio
async def test_register_is_rate_limited(api: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setattr(settings, "register_ip_limit", 1)
    await _register(api, _email("first"))
    blocked = await api.post(
        "/api/v1/auth/register",
        json={"email": _email("second"), "password": "long-enough-secret", "display_name": "B", "locale": "en"},
    )
    assert blocked.status_code == 429


def _request(headers: dict[str, str], host: str = "10.0.0.5") -> Request:
    scope = {
        "type": "http",
        "headers": [(key.lower().encode(), value.encode()) for key, value in headers.items()],
        "client": (host, 1234),
    }
    return Request(scope)


def test_client_ip_ignores_forwarded_for_without_trusted_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_count", 0)
    assert client_ip(_request({"x-forwarded-for": "1.2.3.4"})) == "10.0.0.5"


def test_client_ip_uses_entry_added_by_trusted_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_count", 1)
    assert client_ip(_request({"x-forwarded-for": "6.6.6.6, 203.0.113.9"})) == "203.0.113.9"
    assert client_ip(_request({})) == "10.0.0.5"


@pytest.mark.parametrize("value", ["=HYPERLINK(1)", "+1", "-2", "@SUM(A1)", "\tcmd"])
def test_csv_safe_neutralises_formulas(value: str) -> None:
    assert csv_safe(value) == "'" + value


def test_csv_safe_keeps_plain_values() -> None:
    assert csv_safe("Lunch for two") == "Lunch for two"
    assert csv_safe(42) == 42


def _db_error(sqlstate: str | None, message: str) -> SimpleNamespace:
    return SimpleNamespace(orig=SimpleNamespace(sqlstate=sqlstate, diag=SimpleNamespace(message_primary=message)))


@pytest.mark.parametrize(
    ("sqlstate", "message", "status_code", "detail"),
    [
        ("42501", "capability denied", 403, "capability denied"),
        ("P0002", "booking not found", 404, "booking not found"),
        ("22023", "invalid party", 422, "invalid party"),
        ("P0001", "insufficient capacity", 422, "insufficient capacity"),
        ("23505", "email already registered", 409, "email already registered"),
        ("23505", 'duplicate key value violates unique constraint "x"', 409, "Conflicts with an existing record"),
        ("23503", 'insert violates foreign key constraint "y"', 422, 'insert violates foreign key constraint "y"'),
        ("22P02", "invalid input syntax for type uuid", 422, "Invalid data"),
        ("57014", "canceling statement due to statement timeout", 503, "Please try again"),
        ("42P01", 'relation "app.secret" does not exist', 500, "Internal error"),
        (None, "connection refused", 500, "Internal error"),
    ],
)
def test_database_errors_map_to_safe_responses(
    sqlstate: str | None, message: str, status_code: int, detail: str
) -> None:
    with pytest.raises(HTTPException) as caught:
        raise_from_db(_db_error(sqlstate, message))
    assert caught.value.status_code == status_code
    assert caught.value.detail == detail


def test_asyncpg_error_messages_do_not_leak_class_names() -> None:
    orig = SimpleNamespace(sqlstate="P0001")
    orig.__str__ = lambda: "x"  # type: ignore[method-assign]

    class Wrapped(Exception):
        sqlstate = "P0001"

        def __str__(self) -> str:
            return "<class 'asyncpg.exceptions.RaiseError'>: invalid payment transition"

    with pytest.raises(HTTPException) as caught:
        raise_from_db(SimpleNamespace(orig=Wrapped()))
    assert caught.value.detail == "invalid payment transition"
