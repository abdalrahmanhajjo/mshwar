from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.config import settings
from app.core.log_scrubbing import REDACTED, ScrubbingFilter, before_send, scrub
from app.core.permissions import ADMIN, CAPABILITY, GUEST, PUBLIC, enforce_endpoint, require_object
from app.core.rate_limit import limiter
from app.core.security_limits import client_ip, enforce_limits, metrics, policy, reserve
from app.core.storage import read_private_bytes, sign_object_url, verify_signed_token
from app.core.uploads import validate_upload
from app.main import app


def test_every_api_route_has_default_deny_guard_and_exceptions_exist() -> None:
    names = set()
    routes = []
    for entry in app.routes:
        if hasattr(entry, "effective_route_contexts"):
            routes.extend(entry.effective_route_contexts())
        elif isinstance(entry, APIRoute):
            routes.append(entry)
    for route in routes:
        if route.path.startswith("/api/v1"):
            assert any(d.call is enforce_endpoint for d in route.dependant.dependencies), route.path
            names.add(f"{route.endpoint.__module__.rsplit('.', 1)[-1]}.{route.endpoint.__name__}")
    assert (PUBLIC | CAPABILITY | GUEST | ADMIN) <= names


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/admin/audit",
        "/api/v1/profile",
        "/api/v1/checkout/mine",
        "/api/v1/trips",
        "/api/v1/portal/organizations",
        "/api/v1/privacy/export",
        "/api/v1/planner/sessions/" + str(uuid4()),
    ],
)
def test_identity_headers_cannot_authenticate(path: str) -> None:
    with TestClient(app) as client:
        response = client.get(path, headers={"x-user-id": str(uuid4()), "x-organization-id": str(uuid4())})
    assert response.status_code == 401


@pytest.mark.parametrize(
    "key",
    [
        "password",
        "access_token",
        "clientSecret",
        "Stripe-Signature",
        "payment_id",
        "provider_ref",
        "authorization",
        "content_base64",
        "email",
    ],
)
def test_sensitive_registry_recursive(key: str) -> None:
    assert scrub({"nested": [{key: "do-not-log"}]}) == {"nested": [{key: REDACTED}]}


@pytest.mark.parametrize(
    "value",
    [
        "password: hunter2",
        "Bearer opaque-secret",
        "https://host/reset?token=opaque-secret",
        "/api/v1/portal/files/opaque-secret",
        "/join/opaque-secret",
        "postgresql+asyncpg://user:opaque-secret@localhost/db",
        "pi_privatepaymentreference",
        "eyJabc.eyJxyz.signature",
    ],
)
def test_scrub_free_text(value: str) -> None:
    clean = scrub(value)
    assert clean != value
    assert "opaque-secret" not in clean
    assert "hunter2" not in clean


def test_sentry_drops_locals_and_request_input() -> None:
    event = {
        "request": {"cookies": "opaque", "data": "opaque", "query_string": "opaque"},
        "user": {"email": "test@example.com"},
        "exception": {"values": [{"stacktrace": {"frames": [{"vars": {"unlabelled": "opaque"}}]}}]},
    }
    clean = before_send(event)
    assert "opaque" not in json.dumps(clean)
    assert "user" not in clean


def test_logging_formats_args_scrubs_extras_and_exceptions() -> None:
    record = logging.LogRecord("app", logging.ERROR, "", 1, "password: %s", ("hunter2",), None)
    record.payment_id = "opaque"
    assert ScrubbingFilter().filter(record)
    assert "hunter2" not in record.getMessage()
    assert record.payment_id == REDACTED
    try:
        raise ValueError("token: dont-print")
    except ValueError:
        import sys

        record.exc_info = sys.exc_info()
    ScrubbingFilter().filter(record)
    assert "dont-print" not in (record.exc_text or "")


@pytest.mark.parametrize(
    ("content_type", "data", "purpose"),
    [
        ("image/png", b"\x89PNG\r\n\x1a\nimage", "listing"),
        ("image/jpeg", b"\xff\xd8\xffimage\xff\xd9", "listing"),
        ("image/webp", b"RIFFxxxxWEBPimage", "listing"),
        ("application/pdf", b"%PDF-1.7\n%%EOF", "verification"),
    ],
)
def test_upload_magic_bytes(content_type: str, data: bytes, purpose: str) -> None:
    validate_upload(data, content_type, purpose)
    with pytest.raises(HTTPException) as exc:
        validate_upload(b"<html>active content</html>", content_type, purpose)
    assert exc.value.status_code == 415


def test_upload_rejects_pdf_listing_unknown_and_oversize(monkeypatch) -> None:
    for data, media, purpose in [
        (b"%PDF-1\n%%EOF", "application/pdf", "listing"),
        (b"<svg/>", "image/svg+xml", "listing"),
        (b"", "image/png", "unknown"),
    ]:
        with pytest.raises(HTTPException):
            validate_upload(data, media, purpose)
    monkeypatch.setattr(settings, "upload_max_bytes", 2)
    with pytest.raises(HTTPException) as exc:
        validate_upload(b"big", "image/png", "listing")
    assert exc.value.status_code == 413


def test_expired_signed_url_and_traversal(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(settings, "private_storage_dir", str(tmp_path / "private"))
    (tmp_path / "outside").write_bytes(b"secret")
    with pytest.raises(FileNotFoundError):
        read_private_bytes("../outside")
    payload = json.dumps({"k": "a", "e": 1}, separators=(",", ":"))
    digest = hmac.new(settings.secret_key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = base64.urlsafe_b64encode(f"{payload}.{digest}".encode()).decode()
    with pytest.raises(ValueError):
        verify_signed_token(token)
    signed = sign_object_url("a", ttl_seconds=10000)
    assert (datetime.fromisoformat(signed["expires_at"]) - datetime.now(timezone.utc)).total_seconds() <= 300


@pytest.mark.asyncio
async def test_object_helper_never_distinguishes_missing_from_foreign() -> None:
    db = SimpleNamespace(scalar=AsyncMock(return_value=False))
    for resource in ("booking", "trip", "planner", "organization", "experience"):
        with pytest.raises(HTTPException) as exc:
            await require_object(db, uuid4(), resource, uuid4())
        assert (exc.value.status_code, exc.value.detail) == (404, "Resource not found")
    db.scalar.return_value = True
    await require_object(db, uuid4(), "booking", uuid4())


def test_forwarded_headers_do_not_control_rate_identity() -> None:
    request = Request({"type": "http", "client": ("127.0.0.1", 123), "headers": [(b"x-forwarded-for", b"evil")]})
    assert client_ip(request) == "127.0.0.1"
    assert policy("catalogue.search_catalogue", True)[0] > policy("catalogue.search_catalogue", False)[0]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "key",
    [
        "auth.signin",
        "auth.reset_password",
        "catalogue.search_catalogue",
        "planner.create_or_plan",
        "checkout.commit_checkout",
    ],
)
async def test_per_endpoint_limit_retry_and_metrics(key: str) -> None:
    limiter.reset()
    request = Request({"type": "http", "method": "POST", "client": ("test", 123), "headers": []})
    limit, _ = policy(key, False)
    for _ in range(limit):
        await enforce_limits(request, key, None)
    with pytest.raises(HTTPException) as exc:
        await enforce_limits(request, key, None)
    assert exc.value.status_code == 429
    assert int(exc.value.headers["Retry-After"]) > 0
    assert metrics[f"{key}.denied"] > 0
    limiter.reset()


@pytest.mark.asyncio
async def test_ai_budget_denial_is_before_generation(monkeypatch) -> None:
    reserve_mock = AsyncMock(side_effect=[0, 0, 7200])
    monkeypatch.setattr("app.core.security_limits.reserve", reserve_mock)
    request = Request({"type": "http", "method": "POST", "client": ("test", 123), "headers": []})
    with pytest.raises(HTTPException) as exc:
        await enforce_limits(request, "planner.create_or_plan", {"user_id": uuid4()})
    assert exc.value.headers["X-RateLimit-Policy"] == "ai_budget"
    assert reserve_mock.call_args.kwargs["durable"] is True


@pytest.mark.asyncio
async def test_memory_limit_backend() -> None:
    limiter.reset()
    assert await reserve("unit", 1, 60) == 0
    assert await reserve("unit", 1, 60) > 0
    limiter.reset()


def test_correlation_id_is_valid_and_invalid_input_is_replaced() -> None:
    correlation = str(uuid4())
    with TestClient(app) as client:
        result = client.get("/health", headers={"X-Request-ID": correlation})
        assert result.headers["X-Request-ID"] == correlation
        assert result.headers["X-Content-Type-Options"] == "nosniff"
        assert client.get("/health", headers={"X-Request-ID": "token=secret"}).headers["X-Request-ID"] != "token=secret"
