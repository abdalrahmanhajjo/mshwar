"""G1: a guide applies, an admin verifies, the public page goes live.

The rules worth protecting are the ones a UI cannot hold: the badge is granted
by Mshwar and never self-assigned, a lapsed licence drops it on its own, and a
public page never carries the documents behind it.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from tests.conftest import TestingSessionLocal


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}@example.com"


async def _register(api: AsyncClient, prefix: str) -> dict[str, Any]:
    response = await api.post(
        "/api/v1/auth/register",
        json={
            "accept_terms": True,
            "email": _email(prefix),
            "password": "long-enough-secret",
            "display_name": "Rami",
            "locale": "en",
        },
    )
    assert response.status_code == 201, response.text
    return dict(response.json())


async def _grant_admin(user_id: str) -> None:
    async with TestingSessionLocal() as session:
        await session.execute(text("SELECT app.grant_platform_admin(:user_id, NULL, 'ops')"), {"user_id": user_id})
        await session.commit()


async def _apply(api: AsyncClient, tier: str = "licensed") -> dict[str, Any]:
    response = await api.put(
        "/api/v1/guides/me",
        json={
            "tier": tier,
            "display_name": "Rami Haddad",
            "headline": "Tripoli old city, on foot",
            "languages": ["ar", "en"],
            "regions": ["north-lebanon"],
        },
    )
    assert response.status_code == 200, response.text
    return dict(response.json())


async def _document(api: AsyncClient, kind: str, expires: date | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"kind": kind, "document_key": f"private/{kind}-{uuid4().hex[:8]}.pdf"}
    if expires is not None:
        body["expires_on"] = expires.isoformat()
    response = await api.put("/api/v1/guides/me/documents", json=body)
    assert response.status_code == 200, response.text
    return dict(response.json())


@pytest.mark.asyncio
async def test_a_guide_applies_is_verified_and_gets_a_public_page(api: AsyncClient) -> None:
    await _register(api, "guide")
    profile = await _apply(api)
    assert profile["status"] == "draft"
    assert profile["slug"], "an application gets a readable handle straight away"
    assert profile["badge"] is False, "nothing is granted on the way in"
    assert set(profile["required_documents"]) == {"id", "licence"}

    # Not in the directory, and no page, until somebody says yes.
    assert (await api.get(f"/api/v1/guides/{profile['slug']}")).status_code == 404

    too_early = await api.post("/api/v1/guides/me/submit")
    assert too_early.status_code == 422, "a submission without documents is refused"

    await _document(api, "id")
    await _document(api, "licence", expires=date.today() + timedelta(days=365))
    submitted = await api.post("/api/v1/guides/me/submit")
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"

    admin = await _register(api, "admin")
    await _grant_admin(admin["id"])

    queue = await api.get("/api/v1/admin/guides", params={"status": "submitted"})
    assert queue.status_code == 200, queue.text
    assert any(row["id"] == profile["id"] for row in queue.json())

    early = await api.post(f"/api/v1/admin/guides/{profile['id']}", json={"decision": "approved"})
    assert early.status_code == 422, "the badge is granted by Mshwar, not by the applicant's upload"

    case = await api.get(f"/api/v1/admin/guides/{profile['id']}")
    assert case.status_code == 200, case.text
    for document in case.json()["documents"]:
        decided = await api.post(f"/api/v1/admin/guides/documents/{document['id']}", json={"decision": "verified"})
        assert decided.status_code == 200, decided.text

    approved = await api.post(f"/api/v1/admin/guides/{profile['id']}", json={"decision": "approved"})
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
    assert approved.json()["badge"] is True
    assert approved.json()["organization_id"], "approval creates the guide's solo organisation"

    page = await api.get(f"/api/v1/guides/{profile['slug']}")
    assert page.status_code == 200, page.text
    assert page.json()["display_name"] == "Rami Haddad"
    assert "documents" not in page.json(), "a public page never carries the documents behind it"
    assert "phone" not in page.json()

    directory = await api.get("/api/v1/guides", params={"region": "north-lebanon"})
    assert directory.status_code == 200
    assert any(row["slug"] == profile["slug"] for row in directory.json())


@pytest.mark.asyncio
async def test_a_lapsed_licence_drops_the_badge_on_its_own(api: AsyncClient) -> None:
    await _register(api, "lapsing")
    profile = await _apply(api)
    await _document(api, "id")
    await _document(api, "licence", expires=date.today() + timedelta(days=30))
    await api.post("/api/v1/guides/me/submit")

    admin = await _register(api, "admin")
    await _grant_admin(admin["id"])
    case = await api.get(f"/api/v1/admin/guides/{profile['id']}")
    for document in case.json()["documents"]:
        await api.post(f"/api/v1/admin/guides/documents/{document['id']}", json={"decision": "verified"})
    approved = await api.post(f"/api/v1/admin/guides/{profile['id']}", json={"decision": "approved"})
    assert approved.json()["badge"] is True

    async with TestingSessionLocal() as session:
        await session.execute(
            text(
                "UPDATE app.guide_credentials SET expires_on = current_date - 1 "
                "WHERE guide_profile_id = :profile AND kind = 'licence'"
            ),
            {"profile": profile["id"]},
        )
        await session.commit()

    page = await api.get(f"/api/v1/guides/{profile['slug']}")
    assert page.json()["badge"] is False, "the badge is derived, so expiry drops it with nothing to run"
    assert page.json()["status"] == "approved", "the guide is still a guide; only the badge lapsed"


@pytest.mark.asyncio
async def test_a_local_host_owes_only_an_id(api: AsyncClient) -> None:
    await _register(api, "host")
    profile = await _apply(api, tier="host")
    assert profile["required_documents"] == ["id"]
    await _document(api, "id")
    submitted = await api.post("/api/v1/guides/me/submit")
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["tier"] == "host"


@pytest.mark.asyncio
async def test_an_application_is_private_to_the_applicant(api: AsyncClient) -> None:
    await _register(api, "owner")
    profile = await _apply(api)
    assert (await api.get("/api/v1/guides/me")).json()["id"] == profile["id"]

    await _register(api, "stranger")
    theirs = await api.get("/api/v1/guides/me")
    assert theirs.status_code == 200
    assert theirs.json() is None, "a different account has no application, not somebody else's"

    denied = await api.get(f"/api/v1/admin/guides/{profile['id']}")
    assert denied.status_code in {401, 403, 404}, "reviewing is an admin capability"


@pytest.mark.asyncio
async def test_signing_out_is_required_to_apply(api: AsyncClient) -> None:
    anonymous = await api.put("/api/v1/guides/me", json={"tier": "host", "display_name": "Nobody"})
    assert anonymous.status_code == 401


@pytest.mark.asyncio
async def test_a_rejected_application_goes_back_to_the_guide(api: AsyncClient) -> None:
    await _register(api, "rejected")
    profile = await _apply(api)
    await _document(api, "id")
    await _document(api, "licence")
    await api.post("/api/v1/guides/me/submit")

    admin = await _register(api, "admin")
    await _grant_admin(admin["id"])
    rejected = await api.post(
        f"/api/v1/admin/guides/{profile['id']}", json={"decision": "rejected", "reason": "Licence unreadable"}
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["decision_reason"] == "Licence unreadable"
