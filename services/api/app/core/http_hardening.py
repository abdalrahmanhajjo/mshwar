"""HTTP hardening for every API response (security plan SEC-15 and SEC-16).

Two jobs, done before any route runs:

* **Body size.** A request body larger than it can legitimately be is refused with 413 before
  it is read into memory. Uploads (base64 in JSON) may be as large as the upload ceiling
  allows; everything else is capped at ``MAX_JSON_BYTES``. A client that lies about
  ``Content-Length``, or sends no length, is counted while streaming and cut off.
* **Headers.** Every response says ``nosniff``, is not framed, is not readable by other
  origins' ``no-cors`` requests, sends no referrer, and a response to a request carrying a
  session is never cached. Once deployed, HSTS is set here too, so it holds even when a
  proxy in front forgets it.
"""

from __future__ import annotations

import json
import re

from fastapi import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import settings
from app.core.request_context import current_request_id

MAX_JSON_BYTES = 2 * 1024 * 1024

# Routes that accept a file as base64 in JSON. Everything else gets the small cap.
UPLOAD_PATHS = (
    re.compile(r"^/api/v1/guides/me/documents/upload$"),
    re.compile(r"^/api/v1/guides/me/proposals/[^/]+/photos$"),
    re.compile(r"^/api/v1/partners/me/[^/]+/documents$"),
    re.compile(r"^/api/v1/portal/organizations/[^/]+/files$"),
)


def upload_ceiling() -> int:
    """Base64 grows a file by a third; allow that plus room for the other fields."""
    return settings.max_upload_bytes * 4 // 3 + 64 * 1024


def body_limit(path: str) -> int:
    return upload_ceiling() if any(pattern.match(path) for pattern in UPLOAD_PATHS) else MAX_JSON_BYTES


class BodyTooLarge(HTTPException):
    """Raised while streaming. An ``HTTPException`` so FastAPI's body parsing re-raises it as 413."""

    def __init__(self) -> None:
        super().__init__(status_code=413, detail="This request is too large.")


def _security_headers(has_session: bool) -> list[tuple[bytes, bytes]]:
    headers = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"no-referrer"),
        (b"cross-origin-resource-policy", b"same-origin"),
    ]
    if settings.is_deployed:
        headers.append((b"strict-transport-security", b"max-age=63072000; includeSubDomains"))
    if has_session:
        headers.append((b"cache-control", b"no-store"))
    return headers


def _has_cookie(scope: Scope) -> bool:
    return any(name == b"cookie" for name, _ in scope.get("headers", []))


class HttpHardening:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = body_limit(scope.get("path", ""))
        declared = next((value for name, value in scope.get("headers", []) if name == b"content-length"), None)
        if declared is not None and declared.isdigit() and int(declared) > limit:
            await self._too_large(send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise BodyTooLarge
            return message

        extra = _security_headers(_has_cookie(scope))
        started = False

        async def send_with_headers(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                present = {name.lower() for name, _ in message.get("headers", [])}
                # A route that set its own caching (a public feed, a file) keeps it.
                message["headers"] = list(message.get("headers", [])) + [
                    (name, value) for name, value in extra if name not in present
                ]
            await send(message)

        try:
            await self.app(scope, limited_receive, send_with_headers)
        except BodyTooLarge:
            if not started:
                await self._too_large(send)

    @staticmethod
    async def _too_large(send: Send) -> None:
        body = json.dumps({"detail": "This request is too large.", "request_id": current_request_id()}).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    *_security_headers(False),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
