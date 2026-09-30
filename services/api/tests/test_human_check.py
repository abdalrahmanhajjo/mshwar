"""The optional human check on sign-up and password reset (security plan SEC-55)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from uuid import uuid4

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.core import human_check
from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app


@pytest.fixture
async def api() -> AsyncIterator[AsyncClient]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


def _registration(token: str | None) -> dict[str, object]:
    return {
        "email": f"human-{uuid4().hex[:10]}@example.com",
        "password": "cedar trails at dusk",
        "display_name": "Human",
        "accept_terms": True,
        "human_check": token,
    }


@pytest.fixture
def turnstile(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, str]]:
    seen: list[dict[str, str]] = []

    def answer(request: httpx.Request) -> httpx.Response:
        form = dict(httpx.QueryParams(request.content.decode()))
        seen.append(form)
        if form["response"] == "down":
            raise httpx.ConnectError("unreachable", request=request)
        ok = form["response"].startswith("good") and form["secret"] == "test-secret"
        action = form["response"].removeprefix("good-") if ok and "-" in form["response"] else None
        return httpx.Response(200, json={"success": ok, "action": action, "error-codes": [] if ok else ["invalid"]})

    monkeypatch.setattr(settings, "turnstile_secret_key", "test-secret")
    monkeypatch.setattr(human_check, "transport", httpx.MockTransport(answer))
    return seen


@pytest.mark.asyncio
async def test_off_without_a_secret(api: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "turnstile_secret_key", "")
    assert (await api.post("/api/v1/auth/register", json=_registration(None))).status_code == 201


@pytest.mark.asyncio
async def test_sign_up_needs_a_passing_check(api: AsyncClient, turnstile: list[dict[str, str]]) -> None:
    missing = await api.post("/api/v1/auth/register", json=_registration(None))
    assert missing.status_code == 400 and "human check" in missing.json()["detail"]
    assert turnstile == [], "no token, no call"
    assert (await api.post("/api/v1/auth/register", json=_registration("bad"))).status_code == 400
    wrong_action = await api.post("/api/v1/auth/register", json=_registration("good-reset"))
    assert wrong_action.status_code == 400, "a token made for another form is refused"
    assert (await api.post("/api/v1/auth/register", json=_registration("good-register"))).status_code == 201
    assert turnstile[-1]["remoteip"], "the caller's address is sent along"

    # Cloudflare down: sign-ups go on (the rate limits still apply).
    assert (await api.post("/api/v1/auth/register", json=_registration("down"))).status_code == 201


@pytest.mark.asyncio
async def test_password_reset_needs_a_passing_check(api: AsyncClient, turnstile: list[dict[str, str]]) -> None:
    refused = await api.post("/api/v1/auth/forgot-password", json={"email": "someone@example.com"})
    assert refused.status_code == 400
    passed = await api.post(
        "/api/v1/auth/forgot-password", json={"email": "someone@example.com", "human_check": "good"}
    )
    assert passed.status_code == 200
