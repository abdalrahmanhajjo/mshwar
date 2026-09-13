from __future__ import annotations

import uuid
from contextvars import ContextVar

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_current_user_id: ContextVar[uuid.UUID | None] = ContextVar("current_user_id", default=None)
_current_organization_id: ContextVar[uuid.UUID | None] = ContextVar("current_organization_id", default=None)
_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def set_session_context(user_id: uuid.UUID, organization_id: uuid.UUID, request_id: str | None = None) -> None:
    """Set the session context for RLS enforcement. Must be called at the start of every request."""
    _current_user_id.set(user_id)
    _current_organization_id.set(organization_id)
    if request_id:
        _request_id.set(request_id)


def clear_session_context() -> None:
    """Clear the session context on request release. Ensures no context leaks between requests."""
    _current_user_id.set(None)
    _current_organization_id.set(None)
    _request_id.set(None)


def get_current_user_id() -> uuid.UUID | None:
    """Get the current user ID from the session context."""
    return _current_user_id.get()


def get_current_organization_id() -> uuid.UUID | None:
    """Get the current organization ID from the session context."""
    return _current_organization_id.get()


async def set_local_gucs(
    db: AsyncSession,
    *,
    user_id: str,
    organization_id: str,
    request_id: str = "",
) -> None:
    """Apply transaction-local GUCs. ``SET LOCAL`` cannot take bind parameters."""
    await db.execute(text("SELECT set_config('app.user_id', :value, true)"), {"value": user_id})
    await db.execute(text("SELECT set_config('app.organization_id', :value, true)"), {"value": organization_id})
    if request_id:
        await db.execute(text("SELECT set_config('app.request_id', :value, true)"), {"value": request_id})


async def set_db_session_context(db: AsyncSession) -> None:
    """Set the PostgreSQL session context for RLS enforcement. Uses SET LOCAL so it's transaction-scoped."""
    user_id = _current_user_id.get()
    org_id = _current_organization_id.get()
    request_id = _request_id.get() or ""

    if user_id and org_id:
        await set_local_gucs(
            db,
            user_id=str(user_id),
            organization_id=str(org_id),
            request_id=request_id,
        )
    else:
        raise PermissionError("Session context not set: user_id and organization_id are required")


async def clear_db_session_context(db: AsyncSession) -> None:
    """Reset the PostgreSQL session context after request processing."""
    await db.execute(text("RESET app.user_id"))
    await db.execute(text("RESET app.organization_id"))
    await db.execute(text("RESET app.request_id"))
    clear_session_context()


async def get_current_actor(db: AsyncSession) -> dict[str, uuid.UUID]:
    """Verify the session context is set and return the current actor. Used as a FastAPI dependency."""
    user_id = _current_user_id.get()
    org_id = _current_organization_id.get()

    if not user_id or not org_id:
        raise PermissionError("Authentication required: session context not set")

    await set_db_session_context(db)
    return {"user_id": user_id, "organization_id": org_id}
