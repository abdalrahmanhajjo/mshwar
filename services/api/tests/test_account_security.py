"""Account security (security plan SEC-21 to SEC-25, SEC-63 to SEC-65).

What must hold: a common password is refused; changing the password needs the current one
and signs out every other session; a person sees their sessions and can end any of them;
an email change only happens from a link sent to the new address, and the old address is
told; deleting an account clears the guide data and cancels future tour bookings with
notice; the export carries the guide data; and the nightly purge deletes what is past its
retention period.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.password_policy import password_problem
from app.core.rate_limit import limiter
from app.core.sessions import COOKIE_NAME, COOKIE_NAMES, session_token
from tests.conftest import TestingSessionLocal
from tests.test_guide_after_booking import _book, _ready, _slot
from tests.test_guide_tours import _client, _register

PASSWORD = "long-enough-secret"


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    made = {name: _client() for name in ("a", "b", "c", "guide", "admin", "traveller", "anon", "other")}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


@pytest.fixture
def mailer() -> RecordingMailer:
    recording = RecordingMailer()
    set_mailer(recording)
    return recording


async def _sign_in(client: AsyncClient, email: str, password: str = PASSWORD) -> int:
    response = await client.post("/api/v1/auth/signin", json={"email": email, "password": password})
    return response.status_code


async def _sql(query: str, params: dict[str, Any] | None = None) -> Any:
    async with TestingSessionLocal() as session:
        value = (await session.execute(text(query), params or {})).scalar()
        await session.commit()
        return value


def test_common_and_personal_passwords_are_refused() -> None:
    assert password_problem("password123") is not None
    assert password_problem("QWERTYUIOP") is not None, "case does not matter"
    assert password_problem("aaaaaaaaaaaa") is not None, "one repeated character"
    assert password_problem("maya.haddad-2026", "maya.haddad@example.com") is not None
    assert password_problem("walk the cedars at dawn") is None


def test_the_cookie_keeps_working_across_the_rename() -> None:
    assert COOKIE_NAME in COOKIE_NAMES
    assert session_token({settings.session_cookie_name: "legacy"}) == "legacy"
    if settings.session_cookie_name != COOKIE_NAME:  # deployed: __Host- wins over the old name
        assert session_token({COOKIE_NAME: "current", settings.session_cookie_name: "legacy"}) == "current"
    else:
        assert (settings.session_cookie_name,) == COOKIE_NAMES
    assert session_token({}) is None


@pytest.mark.asyncio
async def test_register_refuses_a_common_password(clients: dict[str, AsyncClient], mailer: RecordingMailer) -> None:
    response = await clients["a"].post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": f"weak-{uuid4().hex[:8]}@example.com",
            "password": "password1234",
            "display_name": "Weak",
            "locale": "en",
        },
    )
    assert response.status_code == 422
    assert "leaked passwords" in response.json()["detail"]
    assert "password1234" not in response.text, "the password is never echoed"


@pytest.mark.asyncio
async def test_sessions_and_password_change(clients: dict[str, AsyncClient], mailer: RecordingMailer) -> None:
    phone, laptop = clients["a"], clients["b"]
    user = await _register(phone, "sessions")
    email = user["email"]
    assert await _sign_in(laptop, email) == 200

    listed = (await phone.get("/api/v1/auth/sessions")).json()
    assert len(listed) == 2 and listed[0]["current"] is True and listed[1]["current"] is False
    assert "token_hash" not in listed[0], "only what the person needs to recognise a session"

    wrong = await phone.post(
        "/api/v1/auth/password", json={"current_password": "not-it-at-all", "new_password": "x" * 12}
    )
    assert wrong.status_code == 403
    weak = await phone.post(
        "/api/v1/auth/password", json={"current_password": PASSWORD, "new_password": "password1234"}
    )
    assert weak.status_code == 422
    changed = await phone.post(
        "/api/v1/auth/password", json={"current_password": PASSWORD, "new_password": "cedar trails at dusk"}
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["sessions_revoked"] == 1
    assert (await laptop.get("/api/v1/auth/me")).status_code == 401, "the other device is signed out"
    assert (await phone.get("/api/v1/auth/me")).status_code == 200, "this device stays signed in"
    assert await _sign_in(clients["c"], email) == 401
    assert await _sign_in(clients["c"], email, "cedar trails at dusk") == 200
    assert any(m.to == email and m.purpose == "password_changed" for m in mailer.messages)

    # End one session by id, then all the others at once.
    await _sign_in(laptop, email, "cedar trails at dusk")
    sessions = (await phone.get("/api/v1/auth/sessions")).json()
    other = next(s for s in sessions if not s["current"])
    assert (await phone.delete(f"/api/v1/auth/sessions/{other['id']}")).status_code == 200
    assert (await phone.delete(f"/api/v1/auth/sessions/{other['id']}")).status_code == 404
    ended = (await phone.post("/api/v1/auth/sessions/revoke-others")).json()
    assert ended["revoked"] >= 1
    assert [s["current"] for s in (await phone.get("/api/v1/auth/sessions")).json()] == [True]

    # Someone else's session id cannot be ended.
    stranger = await _register(clients["guide"], "stranger")
    assert stranger
    theirs = (await clients["guide"].get("/api/v1/auth/sessions")).json()[0]["id"]
    assert (await phone.delete(f"/api/v1/auth/sessions/{theirs}")).status_code == 404
    assert (await clients["guide"].get("/api/v1/auth/me")).status_code == 200


@pytest.mark.asyncio
async def test_email_change_needs_the_new_address(clients: dict[str, AsyncClient], mailer: RecordingMailer) -> None:
    client = clients["a"]
    user = await _register(client, "mover")
    old = user["email"]
    new = f"moved-{uuid4().hex[:8]}@example.com"

    wrong = await client.post("/api/v1/auth/email", json={"new_email": new, "password": "not-my-password"})
    assert wrong.status_code == 403
    asked = await client.post("/api/v1/auth/email", json={"new_email": new, "password": PASSWORD})
    assert asked.status_code == 200, asked.text
    assert (await client.get("/api/v1/auth/me")).json()["email"] == old, "nothing changes before the link"
    notice = [m for m in mailer.messages if m.to == old and m.purpose == "email_change_notice"]
    assert notice, "the current address is told at once"
    token = next(m.token for m in mailer.messages if m.to == new and m.purpose == "email_change")
    assert token

    confirmed = await clients["anon"].post("/api/v1/auth/email/confirm", json={"token": token})
    assert confirmed.status_code == 200, confirmed.text
    me = (await client.get("/api/v1/auth/me")).json()
    assert me["email"] == new and me["email_verified"] is True
    assert await _sign_in(clients["b"], new) == 200
    assert await _sign_in(clients["c"], old) == 401
    assert any(m.to == old and m.purpose == "email_changed" for m in mailer.messages)
    again = await clients["anon"].post("/api/v1/auth/email/confirm", json={"token": token})
    assert again.status_code == 422, "a link works once"

    # Another account's address: the request looks normal, but the link does not take it.
    taken = (await _register(clients["guide"], "taken"))["email"]
    await client.post("/api/v1/auth/email", json={"new_email": taken, "password": PASSWORD})
    steal = next(m.token for m in reversed(mailer.messages) if m.to == taken and m.purpose == "email_change")
    refused = await clients["anon"].post("/api/v1/auth/email/confirm", json={"token": steal})
    assert refused.status_code == 422
    assert (await client.get("/api/v1/auth/me")).json()["email"] == new


@pytest.mark.asyncio
async def test_deleting_an_account_clears_the_guide_data(
    clients: dict[str, AsyncClient], mailer: RecordingMailer
) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, f"Deletion walk {uuid4().hex[:6]}")
    tour = ready["tour"]
    await _register(traveller, "leaver", verify=True)
    booking = await _book(traveller, tour["slug"], await _slot(tour["id"], timedelta(days=3)))
    chat = await traveller.post(
        "/api/v1/guides/conversations", json={"guide_slug": ready["profile"]["slug"], "body": "Call me on 70123456"}
    )
    assert chat.status_code == 200, chat.text

    exported = await traveller.get("/api/v1/privacy/export")
    assert exported.status_code == 200
    guides = exported.json()["guides"]
    assert [b["id"] for b in guides["tour_bookings"]] == [booking["id"]]
    assert guides["conversations"][0]["messages"][0]["mine"] is True

    gone = await traveller.post("/api/v1/privacy/delete-account", json={"confirmation": "DELETE"})
    assert gone.status_code == 200, gone.text
    status = await _sql("SELECT status FROM app.bookings WHERE id = CAST(:b AS uuid)", {"b": booking["id"]})
    assert status == "cancelled", "the future tour booking is cancelled"
    told = await _sql(
        "SELECT count(*) FROM app.notifications WHERE user_id = CAST(:u AS uuid) AND event_type = 'guide.booking_cancelled'",
        {"u": ready["guide_user"]},
    )
    assert told >= 1, "the guide is told"
    body = await _sql(
        "SELECT m.body FROM app.guide_messages m JOIN app.guide_conversations c ON c.id = m.conversation_id "
        "WHERE c.id = CAST(:c AS uuid)",
        {"c": chat.json()["id"]},
    )
    assert body == "[deleted]"

    # A guide closing their account: the profile is emptied and suspended.
    closed = await guide.post("/api/v1/privacy/delete-account", json={"confirmation": "DELETE"})
    assert closed.status_code == 200, closed.text
    row = await _sql(
        "SELECT status || '|' || phone || '|' || display_name FROM app.guide_profiles WHERE id = CAST(:g AS uuid)",
        {"g": ready["profile"]["id"]},
    )
    assert row == "suspended||Former guide"
    assert (await clients["anon"].get(f"/api/v1/guides/{ready['profile']['slug']}")).status_code == 404


@pytest.mark.asyncio
async def test_the_nightly_purge(clients: dict[str, AsyncClient], mailer: RecordingMailer) -> None:
    user = await _register(clients["a"], "purge")
    await _sql(
        "UPDATE app.sessions SET revoked_at = now() - interval '40 days' WHERE user_id = CAST(:u AS uuid) RETURNING 1",
        {"u": user["id"]},
    )
    result = await clients["anon"].post("/api/v1/privacy/ops/purge", headers={"X-Job-Token": settings.job_token})
    assert result.status_code == 200, result.text
    assert result.json()["sessions"] >= 1
    left = await _sql("SELECT count(*) FROM app.sessions WHERE user_id = CAST(:u AS uuid)", {"u": user["id"]})
    assert left == 0
