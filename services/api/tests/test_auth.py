from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Response
from fastapi.testclient import TestClient

from app.api.v1.endpoints.auth import RegisterRequest
from app.core.passwords import hash_password, verify_password
from app.core.sessions import COOKIE_NAME, hash_session_token, set_session_cookie, should_refresh
from app.main import app

client = TestClient(app)


def test_password_hash_is_not_plaintext() -> None:
    digest = hash_password("correct-horse-battery")
    assert "correct-horse-battery" not in digest
    assert digest.startswith("$argon2")
    assert verify_password(digest, "correct-horse-battery") is True
    assert verify_password(digest, "wrong-password") is False


def test_should_refresh_when_under_half_life() -> None:
    now = datetime.now(timezone.utc)
    assert should_refresh(now + timedelta(hours=1), now) is True
    assert should_refresh(now + timedelta(days=6), now) is False


def test_register_signin_me_refresh_signout() -> None:
    email = "traveller@example.com"
    password = "long-enough-secret"
    created = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "Lina", "locale": "en"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["email"] == email
    assert body["display_name"] == "Lina"
    assert "password" not in body
    assert COOKIE_NAME in created.cookies
    cookie = created.cookies[COOKIE_NAME]
    assert cookie
    assert hash_session_token(cookie) != cookie

    set_cookie = created.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie or "SameSite=Lax" in set_cookie
    assert "mshwar_session=" in set_cookie

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email

    refreshed = client.post("/api/v1/auth/refresh")
    assert refreshed.status_code == 200
    assert refreshed.json()["id"] == body["id"]

    signed_in = client.post("/api/v1/auth/signin", json={"email": email.upper(), "password": password})
    assert signed_in.status_code == 200
    assert signed_in.json()["display_name"] == "Lina"

    bad = client.post("/api/v1/auth/signin", json={"email": email, "password": "definitely-wrong"})
    assert bad.status_code == 401
    assert "password" not in bad.text.lower() or "Invalid email or password" in bad.text

    conflict = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "Other", "locale": "en"},
    )
    assert conflict.status_code == 409

    signed_out = client.post("/api/v1/auth/signout")
    assert signed_out.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_password_is_omitted_from_request_repr() -> None:
    payload = RegisterRequest.model_validate(
        {
            "email": "ada@example.com",
            "password": "long-enough-secret",
            "display_name": "Ada",
            "locale": "en",
        }
    )
    assert "long-enough-secret" not in repr(payload)


def test_session_cookie_is_httponly_samesite_and_path_scoped() -> None:
    response = Response()
    set_session_cookie(response, "opaque-token")
    header = response.headers.get("set-cookie", "")
    assert "mshwar_session=opaque-token" in header
    assert "HttpOnly" in header
    assert "Path=/" in header
    assert "SameSite=lax" in header or "SameSite=Lax" in header


def test_unauthenticated_me_and_refresh_are_rejected() -> None:
    fresh = TestClient(app)
    assert fresh.get("/api/v1/auth/me").status_code == 401
    assert fresh.post("/api/v1/auth/refresh").status_code == 401
    assert fresh.post("/api/v1/auth/signout").status_code == 204
    fresh.cookies.set(COOKIE_NAME, "not-a-real-session")
    assert fresh.get("/api/v1/auth/me").status_code == 401


def test_register_rejects_invalid_locale() -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "locale@example.com",
            "password": "long-enough-secret",
            "display_name": "Ada",
            "locale": "xx",
        },
    )
    assert response.status_code == 422


def test_register_rejects_short_password_and_bad_email() -> None:
    short = client.post(
        "/api/v1/auth/register",
        json={"email": "ok@example.com", "password": "short", "display_name": "A", "locale": "en"},
    )
    assert short.status_code == 422
    bad_email = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "long-enough-secret", "display_name": "A", "locale": "en"},
    )
    assert bad_email.status_code == 422
