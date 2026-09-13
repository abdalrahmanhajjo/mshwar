from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import _load_session
from app.core.sessions import COOKIE_NAME
from app.dependencies import get_auth_db

router = APIRouter()


class AdminUserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    locale: str
    status: str
    email_verified: bool
    email_verified_at: datetime | None = None


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[AdminUserOut]:
    # Phase-0 stub: any signed-in operator can read verification state.
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    rows = (
        await db.execute(
            text(
                "SELECT user_id, email, display_name, locale, status, email_verified_at "
                "FROM app.list_user_verification_states()"
            )
        )
    ).all()
    return [
        AdminUserOut(
            id=row[0],
            email=row[1],
            display_name=row[2],
            locale=row[3],
            status=row[4],
            email_verified=row[5] is not None,
            email_verified_at=row[5],
        )
        for row in rows
    ]
