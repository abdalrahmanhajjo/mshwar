from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.hub_query import page_args, raise_hub_error
from app.core.auth_session import require_session
from app.core.job_auth import require_job_token
from app.core.notifications.service import dispatch, emit_event, escalate
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.hub import NotificationListOut, NotificationOut
from app.schemas.notifications import CommunicationPreferencesIn, EmitNotificationIn, MaterialChangeIn

router = APIRouter()


def _notification_out(row: Any) -> NotificationOut:
    return NotificationOut(
        id=row[0],
        title=str(row[1]),
        body=str(row[2]),
        category=str(row[3]),
        read_at=row[4],
        created_at=row[5],
        deep_link=row[7] if len(row) > 7 else None,
        event_type=row[8] if len(row) > 8 else None,
        locale=row[9] if len(row) > 9 else None,
    )


@router.get("/preferences")
async def get_preferences(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.get_communication_preferences(:user_id)",
        {"user_id": str(session["user_id"])},
    )


@router.put("/preferences")
async def put_preferences(
    payload: CommunicationPreferencesIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.set_communication_preferences(:user_id, :email, :in_app, 'preferences')",
        {
            "user_id": str(session["user_id"]),
            "email": payload.marketing_email,
            "in_app": payload.marketing_in_app,
        },
    )


@router.get("/consent")
async def consent_history(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_consent_history(:user_id)",
        {"user_id": str(session["user_id"])},
    )


@router.get("/unsubscribe/{token}")
async def lookup_unsubscribe(
    token: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await fetch_json(db, "SELECT app.lookup_unsubscribe_token(:token)", {"token": token})


@router.post("/unsubscribe/{token}")
async def apply_unsubscribe(
    token: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await fetch_json(
        db,
        "SELECT app.unsubscribe_marketing(:token, 'unsubscribe_link')",
        {"token": token},
    )


@router.post("/dispatch", dependencies=[Depends(require_job_token)])
async def dispatch_outbox(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await dispatch(db)


@router.post("/escalate", dependencies=[Depends(require_job_token)])
async def escalate_requests(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await escalate(db)


@router.post("/itinerary-change")
async def notify_itinerary_change(
    payload: MaterialChangeIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.notify_material_itinerary_change(:trip, :owner, CAST(:before AS jsonb), CAST(:after AS jsonb))",
        {
            "trip": str(payload.trip_id),
            "owner": str(session["user_id"]),
            "before": json.dumps(payload.before),
            "after": json.dumps(payload.after),
        },
    )


@router.post("/events")
async def emit_for_session(
    payload: EmitNotificationIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Composition seam for tests and Epic 9. Authenticated caller only; no booking writes."""
    session = await require_session(request, db)
    user_id = str(payload.user_id or session["user_id"])
    if user_id != str(session["user_id"]) and not session.get("admin_tier"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="cannot emit for another user")
    return await emit_event(
        db,
        payload.event_type,
        str(payload.aggregate_id),
        user_id,
        str(payload.organization_id) if payload.organization_id else None,
        payload.payload,
    )


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    paging: tuple[int, int, int] = Depends(page_args),
) -> NotificationListOut:
    session = await require_session(request, db)
    page, page_size, offset = paging
    rows = (
        await db.execute(
            text(
                "SELECT id, title, body, category, read_at, created_at, total, deep_link, event_type, locale "
                "FROM app.list_my_notifications(:user_id, :lim, :off)"
            ),
            {"user_id": str(session["user_id"]), "lim": page_size, "off": offset},
        )
    ).all()
    total = int(rows[0][6]) if rows else 0
    return NotificationListOut(
        items=[_notification_out(row) for row in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> NotificationOut:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text(
                    "SELECT id, title, body, category, read_at, created_at, deep_link, event_type, locale "
                    "FROM app.mark_my_notification_read(:user_id, :notification_id)"
                ),
                {"user_id": str(session["user_id"]), "notification_id": str(notification_id)},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Notification not found")
        raise
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return NotificationOut(
        id=row[0],
        title=str(row[1]),
        body=str(row[2]),
        category=str(row[3]),
        read_at=row[4],
        created_at=row[5],
        deep_link=row[6] if len(row) > 6 else None,
        event_type=row[7] if len(row) > 7 else None,
        locale=row[8] if len(row) > 8 else None,
    )
