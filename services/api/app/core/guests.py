from __future__ import annotations

import hashlib
import secrets
from typing import Any

from fastapi import HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import _load_session
from app.core.portal_auth import fetch_json
from app.core.sessions import COOKIE_NAME

GUEST_COOKIE = "mshwar_guest"


def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def set_guest_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=GUEST_COOKIE,
        value=token,
        max_age=60 * 60 * 24 * 30,
        httponly=True,
        samesite="lax",
        path="/",
    )


async def optional_user(request: Request, db: AsyncSession) -> dict[str, Any] | None:
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        return None
    return session


async def resolve_guest_id(request: Request, db: AsyncSession, display_name: str = "Guest") -> str | None:
    token = request.cookies.get(GUEST_COOKIE)
    if not token:
        return None
    guest_id = await fetch_json(
        db,
        "SELECT app.ensure_guest(:token_hash, :name)",
        {"token_hash": hash_opaque_token(token), "name": display_name},
    )
    return str(guest_id) if guest_id else None


async def actor_ids(
    request: Request,
    db: AsyncSession,
    *,
    require_any: bool = False,
) -> tuple[str | None, str | None]:
    session = await optional_user(request, db)
    user_id = str(session["user_id"]) if session else None
    guest_id = None if user_id else await resolve_guest_id(request, db)
    if require_any and user_id is None and guest_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user_id, guest_id
