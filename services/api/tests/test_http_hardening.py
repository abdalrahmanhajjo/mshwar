"""Security headers, request size limits and hidden API docs (security plan SEC-13, SEC-15, SEC-16)."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.http_hardening import MAX_JSON_BYTES, body_limit, upload_ceiling
from app.main import api_doc_urls, app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def test_the_api_docs_are_off_when_deployed() -> None:
    assert api_doc_urls(True) == {"docs_url": None, "redoc_url": None, "openapi_url": None}
    assert api_doc_urls(False)["docs_url"] == "/docs"


def test_uploads_get_the_upload_ceiling_and_everything_else_the_small_cap() -> None:
    assert body_limit("/api/v1/portal/organizations/abc/files") == upload_ceiling()
    assert body_limit("/api/v1/guides/me/documents/upload") == upload_ceiling()
    assert body_limit("/api/v1/guides/me/proposals/p1/photos") == upload_ceiling()
    assert body_limit("/api/v1/partners/me/driver/documents") == upload_ceiling()
    assert body_limit("/api/v1/auth/signin") == MAX_JSON_BYTES
    assert body_limit("/api/v1/portal/organizations/abc/files/extra") == MAX_JSON_BYTES
    assert upload_ceiling() > settings.max_upload_bytes


@pytest.mark.asyncio
async def test_every_response_carries_the_security_headers() -> None:
    async with _client() as client:
        public = await client.get("/health")
        client.cookies.set(settings.session_cookie_name, "anything")
        private = await client.get("/api/v1/auth/me")
    for response in (public, private):
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert response.headers["cross-origin-resource-policy"] == "same-origin"
    assert "no-store" not in public.headers.get("cache-control", ""), "public answers may be cached"
    assert private.headers["cache-control"] == "no-store", "nothing answered to a session is cached"


@pytest.mark.asyncio
async def test_an_oversized_body_is_refused_before_the_route() -> None:
    big = b"{" + b" " * (MAX_JSON_BYTES + 10) + b"}"
    async with _client() as client:
        declared = await client.post("/api/v1/auth/signin", content=big, headers={"Content-Type": "application/json"})

        async def stream() -> AsyncIterator[bytes]:
            for _ in range(3):
                yield b" " * (MAX_JSON_BYTES // 2 + 1)

        streamed = await client.post(
            "/api/v1/auth/signin", content=stream(), headers={"Content-Type": "application/json"}
        )
        upload = await client.post(
            "/api/v1/portal/organizations/00000000-0000-0000-0000-000000000000/files",
            content=big,
            headers={"Content-Type": "application/json"},
        )
    assert declared.status_code == 413
    assert declared.json()["detail"] == "This request is too large."
    assert declared.headers["x-content-type-options"] == "nosniff"
    assert streamed.status_code == 413, "a body without a length is counted as it arrives"
    assert upload.status_code != 413, "an upload route accepts more than the small cap"
