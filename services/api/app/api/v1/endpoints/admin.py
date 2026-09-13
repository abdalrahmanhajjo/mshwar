from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import _load_session
from app.core.portal_auth import fetch_json, raise_from_db, require_session
from app.core.sessions import COOKIE_NAME
from app.dependencies import get_auth_db
from app.schemas.portal import AdminVerificationAction

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


@router.get("/organizations")
async def list_organizations(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_admin_organizations(:admin_id)",
        {"admin_id": str(session["user_id"])},
    )


@router.post("/organizations/{org_id}/verify")
async def verify_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "verified", payload.reason)


@router.post("/organizations/{org_id}/reject")
async def reject_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "rejected", payload.reason)


@router.post("/organizations/{org_id}/revoke")
async def revoke_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "revoked", payload.reason)


async def _transition(
    request: Request,
    db: AsyncSession,
    org_id: UUID,
    decision: str,
    reason: str,
) -> Any:
    session = await require_session(request, db)
    try:
        result = await db.execute(
            text("SELECT app.admin_transition_verification(:admin_id, :org_id, :decision, :reason)"),
            {
                "admin_id": str(session["user_id"]),
                "org_id": str(org_id),
                "decision": decision,
                "reason": reason,
            },
        )
        return result.scalar_one()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
