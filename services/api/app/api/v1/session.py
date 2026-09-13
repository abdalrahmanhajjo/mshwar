from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import _load_session
from app.core.sessions import COOKIE_NAME


async def require_session(request: Request, db: AsyncSession) -> dict[str, Any]:
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session
