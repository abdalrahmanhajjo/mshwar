from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import _load_session
from app.core.sessions import COOKIE_NAME
from app.dependencies import get_auth_db
from app.schemas.preferences import PreferenceValues, TripCreate, TripOut, merge_plan_defaults

router = APIRouter()


async def _require_session(request: Request, db: AsyncSession) -> dict[str, Any]:
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return session


@router.get("")
async def list_trips() -> list[dict[str, object]]:
    return []


@router.post("", response_model=TripOut)
async def create_trip(
    trip: TripCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> TripOut:
    session = await _require_session(request, db)
    overrides = (
        trip.preference_overrides.model_dump(mode="json", exclude_unset=True) if trip.preference_overrides else {}
    )
    try:
        row = (
            await db.execute(
                text(
                    "SELECT trip_id, title, status, preference_overrides "
                    "FROM app.create_trip_draft(:user_id, :title, CAST(:overrides AS jsonb))"
                ),
                {
                    "user_id": str(session["user_id"]),
                    "title": trip.name.strip(),
                    "overrides": json.dumps(overrides) if overrides else "{}",
                },
            )
        ).first()
    except DBAPIError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid trip") from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not create trip")
    stored_overrides = row[3] if isinstance(row[3], dict) else {}
    profile_row = (
        await db.execute(
            text("SELECT preferences FROM app.get_profile(:user_id)"),
            {"user_id": str(session["user_id"])},
        )
    ).first()
    profile_prefs = PreferenceValues.model_validate(profile_row[0] if profile_row else {})
    return TripOut(
        id=row[0],
        name=row[1],
        status=row[2],
        preference_overrides=stored_overrides,
        effective_defaults=merge_plan_defaults(profile_prefs, stored_overrides),
    )
