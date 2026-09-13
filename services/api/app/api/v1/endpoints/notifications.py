from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.hub_query import page_args, raise_hub_error
from app.api.v1.session import require_session
from app.dependencies import get_auth_db
from app.schemas.hub import NotificationListOut, NotificationOut

router = APIRouter()


def _notification_out(row: Any) -> NotificationOut:
    return NotificationOut(
        id=row[0],
        title=str(row[1]),
        body=str(row[2]),
        category=str(row[3]),
        read_at=row[4],
        created_at=row[5],
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
                "SELECT id, title, body, category, read_at, created_at, total "
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
                    "SELECT id, title, body, category, read_at, created_at "
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
    return _notification_out(row)
