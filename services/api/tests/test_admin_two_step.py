"""Two-step sign-in for the operations console (SR-14, migration 052)."""

from __future__ import annotations

from collections.abc import AsyncGenerator, Iterator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import totp
from app.core.config import Settings, settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app


def test_deployed_environments_cannot_turn_it_off() -> None:
    base = {
        "secret_key": "x" * 64,
        "internal_job_token": "y" * 64,
        "rate_limit_store": "redis",
        "public_web_origin": "https://staging.mshwar.example",
        "enable_dev_endpoints": False,
    }
    with pytest.raises(ValueError, match="ADMIN_MFA cannot be turned off"):
        Settings(environment="staging", admin_mfa=False, **base)
    assert Settings(environment="development").admin_mfa_required is False
    assert Settings(environment="development", admin_mfa=True).admin_mfa_required is True


@pytest.fixture
def _required() -> Iterator[None]:
    before = settings.admin_mfa
    settings.admin_mfa = True
    yield
    settings.admin_mfa = before


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


@pytest.mark.asyncio
@pytest.mark.usefixtures("_required")
async def test_the_console_needs_an_authenticator_code(api: AsyncClient) -> None:
    from tests.test_booking_payments import _grant_admin, _register

    admin = await _register(api, f"admin-{uuid4().hex[:8]}@example.com", "Admin")
    await _grant_admin(admin["id"])

    blocked = await api.get("/api/v1/admin/me")
    assert blocked.status_code == 403 and blocked.json()["code"] == "admin_mfa_setup_required"
    state = (await api.get("/api/v1/admin/mfa")).json()
    assert state == {"enrolled": False, "verified": False, "verified_until": None, "required": True}

    begun = (await api.post("/api/v1/partners/security/totp")).json()
    secret = begun["secret"]
    step = totp.current_step()
    confirmed = await api.post("/api/v1/partners/security/totp/confirm", json={"code": totp.code_at(secret, step)})
    assert confirmed.status_code == 200, confirmed.text

    still = await api.get("/api/v1/admin/me")
    assert still.status_code == 403 and still.json()["code"] == "admin_mfa_required", "set up is not verified"
    bad = next(code for code in ("000000", "111111", "222222", "333333") if totp.matching_step(secret, code) is None)
    wrong = await api.post("/api/v1/admin/mfa/verify", json={"code": bad})
    assert wrong.status_code == 422
    code = totp.code_at(secret, step + 1)
    verified = await api.post("/api/v1/admin/mfa/verify", json={"code": code})
    assert verified.status_code == 200, verified.text
    assert verified.json()["verified"] is True
    assert (await api.get("/api/v1/admin/me")).status_code == 200
    replay = await api.post("/api/v1/admin/mfa/verify", json={"code": code})
    assert replay.status_code == 422, "a code counts once"

    itself = await api.post(f"/api/v1/admin/users/{admin['id']}/mfa/reset", json={"reason": "Lost my phone today"})
    assert itself.status_code in {403, 404}, "an admin cannot reset their own authenticator"


@pytest.mark.asyncio
async def test_nothing_changes_where_it_is_not_required(api: AsyncClient) -> None:
    from tests.test_booking_payments import _grant_admin, _register

    assert settings.admin_mfa_required is False  # tests run as ENVIRONMENT=test
    admin = await _register(api, f"admin-{uuid4().hex[:8]}@example.com", "Admin")
    await _grant_admin(admin["id"])
    assert (await api.get("/api/v1/admin/me")).status_code == 200
    assert (await api.get("/api/v1/admin/mfa")).json()["required"] is False
