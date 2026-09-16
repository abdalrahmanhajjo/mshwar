from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.payments.factory import get_payment_provider
from app.payments.stripe_test import WebhookNotConfigured
from app.payments.webhook import payload_hash, sanitize_event, verify_or_reject

router = APIRouter()


@router.post("/payments")
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    raw = await request.body()
    signature = request.headers.get("stripe-signature") or request.headers.get("x-mshwar-signature") or ""
    provider = get_payment_provider()
    try:
        event = verify_or_reject(provider, raw, signature)
    except WebhookNotConfigured as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="webhooks not configured") from exc
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unverified webhook") from exc
    digest = payload_hash(raw)
    sanitized = sanitize_event(event)
    inbox = await fetch_json(
        db,
        "SELECT app.ingest_webhook(:provider, :account, :live, :event_id, :hash, CAST(:payload AS jsonb))",
        {
            "provider": event.provider,
            "account": event.provider_account,
            "live": event.live_mode,
            "event_id": event.event_id,
            "hash": digest,
            "payload": json.dumps(sanitized),
        },
    )
    if not isinstance(inbox, dict) or inbox.get("processed_at") or inbox.get("replayed"):
        return {"ok": True, "replayed": True, "inbox": inbox}
    processed = await fetch_json(
        db,
        "SELECT app.process_webhook_inbox(:inbox_id)",
        {"inbox_id": str(inbox["id"])},
    )
    return {"ok": True, "replayed": False, "result": processed}
