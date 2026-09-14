from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import _load_session
from app.core.sessions import COOKIE_NAME

ORG_HEADER = "x-organization-id"

LISTINGS_ROLES = frozenset({"owner", "manager", "inventory"})
BOOKINGS_ROLES = frozenset({"owner", "manager", "bookings"})
FINANCE_ROLES = frozenset({"owner", "manager", "finance"})
SETTINGS_ROLES = frozenset({"owner", "manager"})
TEAM_ROLES = frozenset({"owner", "manager"})

CAPABILITY_ROLES = {
    "listings": LISTINGS_ROLES,
    "bookings": BOOKINGS_ROLES,
    "finance": FINANCE_ROLES,
    "settings": SETTINGS_ROLES,
    "team": TEAM_ROLES,
}


def roles_for(capability: str) -> frozenset[str]:
    return CAPABILITY_ROLES[capability]


def role_allows(role: str, capability: str) -> bool:
    return role in CAPABILITY_ROLES.get(capability, frozenset())


async def require_session(request: Request, db: AsyncSession) -> dict[str, Any]:
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session


def resolve_org_id(request: Request, explicit: str | None = None) -> str | None:
    return explicit or request.headers.get(ORG_HEADER)


def raise_from_db(exc: object) -> None:
    orig = getattr(exc, "orig", None)
    sqlstate = getattr(orig, "sqlstate", None) or getattr(orig, "pgcode", None)
    cause = exc if isinstance(exc, BaseException) else None
    if sqlstate == "42501":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied") from cause
    if sqlstate == "P0002":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found") from cause
    if sqlstate in {"23505", "23P01"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Conflict") from cause
    detail = "Invalid request"
    if sqlstate == "22023" and "org_unverified" in str(orig):
        detail = "Listing cannot be published: org_unverified"
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail) from cause


async def fetch_json(db: AsyncSession, sql: str, params: dict[str, Any]) -> Any:
    try:
        result = await db.execute(text(sql), params)
        return result.scalar_one_or_none()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise


def assert_capability(role: str, capability: str, *, allowed: Iterable[str] | None = None) -> None:
    permitted = frozenset(allowed) if allowed is not None else roles_for(capability)
    if role not in permitted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"capability denied: {capability}")
