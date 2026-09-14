from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.mailer import get_mailer
from app.payments import metrics
from app.payments.confirmations import confirmation_email


async def publish_outbox(db: AsyncSession, *, limit: int = 50) -> dict[str, Any]:
    row = (await db.execute(text("SELECT app.publish_outbox_batch(:lim)"), {"lim": limit})).scalar()
    payload = row if isinstance(row, dict) else {}
    published = int(payload.get("published") or 0)
    retrying = int(payload.get("retrying") or 0)
    dead = int(payload.get("dead_lettered") or 0)
    metrics.increment("outbox_published", published)
    metrics.increment("outbox_retrying", retrying)
    metrics.increment("outbox_dead_lettered", dead)
    await _deliver_email_notifications(db)
    return {"published": published, "retrying": retrying, "dead_lettered": dead}


async def outbox_metrics(db: AsyncSession) -> dict[str, Any]:
    row = (await db.execute(text("SELECT app.outbox_metrics()"))).scalar()
    sql = row if isinstance(row, dict) else {}
    return {**sql, "counters": metrics.snapshot()}


async def _deliver_email_notifications(db: AsyncSession) -> None:
    rows = (
        await db.execute(
            text(
                """
                SELECT n.id, p.email, n.category, o.payload, o.event_type
                FROM app.notifications n
                JOIN app.outbox o ON o.id = n.outbox_id
                JOIN app.user_private p ON p.user_id = n.user_id
                WHERE n.channel = 'email' AND n.status = 'pending' AND p.email IS NOT NULL
                ORDER BY n.created_at
                LIMIT 50
                """
            )
        )
    ).all()
    mailer = get_mailer()
    for row in rows:
        payload = row[3] if isinstance(row[3], dict) else {}
        message = confirmation_email(str(row[1] or ""), str(row[4] or ""), payload)
        try:
            await mailer.send(message)
            await db.execute(text("UPDATE app.notifications SET status = 'sent' WHERE id = :id"), {"id": row[0]})
        except Exception:  # noqa: BLE001
            await db.execute(
                text("UPDATE app.notifications SET status = 'failed', attempts = attempts + 1 WHERE id = :id"),
                {"id": row[0]},
            )
            metrics.increment("notification_email_failed")
