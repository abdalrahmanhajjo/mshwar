from __future__ import annotations

from typing import Any

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_session import require_session
from app.core.client_ip import client_ip
from app.core.config import settings
from app.core.errors import ApiError
from app.core.sql import raise_from_db


async def lookup_admin_tier(db: AsyncSession, user_id: object) -> str | None:
    result = await db.execute(text("SELECT app.admin_tier(:user_id)"), {"user_id": str(user_id)})
    return result.scalar_one_or_none()


async def touch_admin_session(request: Request, db: AsyncSession, session: dict[str, Any]) -> Any:
    try:
        result = await db.execute(
            text("SELECT app.touch_admin_session(:user_id, :session_id, :ip, :user_agent)"),
            {
                "user_id": str(session["user_id"]),
                "session_id": str(session.get("session_id")) if session.get("session_id") else None,
                "ip": client_ip(request),
                "user_agent": (request.headers.get("user-agent") or "")[:300],
            },
        )
        return result.scalar_one_or_none()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise


async def admin_mfa_state(db: AsyncSession, session: dict[str, Any]) -> dict[str, Any]:
    result = await db.execute(
        text("SELECT app.admin_mfa_state(CAST(:user_id AS uuid), CAST(:session_id AS uuid))"),
        {
            "user_id": str(session["user_id"]),
            "session_id": str(session["session_id"]) if session.get("session_id") else None,
        },
    )
    state: Any = result.scalar_one()
    return state if isinstance(state, dict) else {}


async def _require_second_step(db: AsyncSession, session: dict[str, Any]) -> None:
    """Every admin route but the two-step screen itself needs a session verified in the last 12 hours."""
    state = await admin_mfa_state(db, session)
    if state.get("verified"):
        return
    enrolled = bool(state.get("enrolled"))
    raise ApiError(
        403,
        "Confirm it's you with your authenticator code" if enrolled else "Set up two-step sign-in to use the console",
        "admin_mfa_required" if enrolled else "admin_mfa_setup_required",
    )


async def require_admin(
    request: Request,
    db: AsyncSession,
    *,
    elevated: bool = False,
    second_step: bool = True,
) -> dict[str, Any]:
    """An admin; ``elevated`` for the sensitive actions. ``second_step=False`` only for the screen that
    shows and takes the authenticator code - everything else needs a verified session (SR-14)."""
    checked: dict[str, Any] | None = getattr(request.state, "admin_session", None)
    if checked is not None and (not elevated or checked.get("admin_elevated")):
        if second_step and settings.admin_mfa_required and not checked.get("admin_mfa_verified"):
            await _require_second_step(db, checked)
            request.state.admin_session = {**checked, "admin_mfa_verified": True}
        return dict(checked)
    session = await require_session(request, db)
    try:
        result = await db.execute(
            text("SELECT app.require_admin(:user_id, :elevated)"),
            {"user_id": str(session["user_id"]), "elevated": elevated},
        )
        session["admin_tier"] = result.scalar_one()
    except DBAPIError as exc:
        raise_from_db(exc)
        raise
    session["admin_elevated"] = elevated
    if checked is None:
        await touch_admin_session(request, db, session)
    if second_step and settings.admin_mfa_required:
        await _require_second_step(db, session)
        session["admin_mfa_verified"] = True
    request.state.admin_session = dict(session)
    return session


async def close_admin_sessions(db: AsyncSession, user_id: object) -> None:
    await db.execute(text("SELECT app.close_admin_sessions(:user_id)"), {"user_id": str(user_id)})
