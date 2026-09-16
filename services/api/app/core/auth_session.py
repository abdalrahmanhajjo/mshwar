"""Loading the signed-in user from the session cookie.

Shared by routers and core helpers, so it must not import from app.api.
"""

from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sessions import COOKIE_NAME, hash_session_token
from app.dependencies import get_auth_db


async def load_session(db: AsyncSession, token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    result = await db.execute(
        text(
            "SELECT session_id, user_id, display_name, email, locale, status, expires_at, "
            "email_verified_at FROM app.get_session(:token_hash)"
        ),
        {"token_hash": hash_session_token(token)},
    )
    row = result.mappings().first()
    return dict(row) if row else None


async def optional_session(request: Request, db: AsyncSession) -> dict[str, Any] | None:
    session = await load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        return None
    return session


async def require_session(request: Request, db: AsyncSession) -> dict[str, Any]:
    session = await optional_session(request, db)
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session


async def require_verified_user(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await require_session(request, db)
    if not session.get("email_verified_at"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verify your email before booking")
    return session
