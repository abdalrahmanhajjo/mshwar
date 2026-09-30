"""Opaque session tokens stored as SHA-256 hashes. Cookie flags documented here.

Schedule:
- Absolute/sliding lifetime: ``settings.session_ttl_seconds`` (default 7 days).
- GET /auth/me and POST /auth/refresh extend expiry by a full TTL when less
  than half the lifetime remains.
- POST /auth/signout revokes the server row and clears the cookie.
"""

from __future__ import annotations

import hashlib
import secrets
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

from fastapi import Response

from app.core.config import settings

# Deployed, the cookie carries the __Host- prefix (security plan SEC-21): browsers then accept
# it only when it is Secure, has Path=/ and no Domain, so no subdomain can set or overwrite it.
LEGACY_COOKIE_NAME = settings.session_cookie_name
COOKIE_NAME = (
    f"__Host-{LEGACY_COOKIE_NAME}"
    if settings.is_deployed and not LEGACY_COOKIE_NAME.startswith("__Host-")
    else LEGACY_COOKIE_NAME
)
COOKIE_NAMES = tuple(dict.fromkeys((COOKIE_NAME, LEGACY_COOKIE_NAME)))


def session_token(cookies: Mapping[str, str]) -> str | None:
    """The session token from either name, so switching names signs nobody out."""
    for name in COOKIE_NAMES:
        value = cookies.get(name)
        if value:
            return value
    return None


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expiry(now: datetime | None = None) -> datetime:
    current = now or datetime.now(UTC)
    return current + timedelta(seconds=settings.session_ttl_seconds)


def should_refresh(expires_at: datetime, now: datetime | None = None) -> bool:
    current = now or datetime.now(UTC)
    remaining = (expires_at - current).total_seconds()
    return remaining < (settings.session_ttl_seconds / 2)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.is_deployed,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    for name in COOKIE_NAMES:
        response.delete_cookie(key=name, path="/", secure=settings.is_deployed, httponly=True, samesite="lax")
