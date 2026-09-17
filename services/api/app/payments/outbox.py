from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.mailer import get_mailer
from app.payments import metrics
from app.payments.confirmations import confirmation_email

logger = logging.getLogger("mshwar.payments")


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
    claimed = (await db.execute(text("SELECT app.claim_confirmation_emails(50)"))).scalar()
    rows = claimed if isinstance(claimed, list) else []
    mailer = get_mailer()
    for row in rows:
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        message = confirmation_email(str(row.get("email") or ""), str(row.get("event_type") or ""), payload)
        try:
            await mailer.send(message)
            sent = True
        except Exception:  # noqa: BLE001 - one failed email must not stop the batch
            logger.warning("confirmation email failed notification_id=%s", row.get("id"), exc_info=True)
            metrics.increment("notification_email_failed")
            sent = False
        await db.execute(
            text("SELECT app.mark_confirmation_email(:id, :sent)"),
            {"id": str(row["id"]), "sent": sent},
        )
