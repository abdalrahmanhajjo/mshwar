from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.permissions import require_object
from app.core.portal_auth import assert_capability
from app.core.security_limits import reject, reserve


def validate_upload(data: bytes, content_type: str, purpose: str) -> None:
    if len(data) > settings.upload_max_bytes:
        raise HTTPException(413, "File exceeds upload size limit")
    signatures = {
        "image/png": data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9"),
        "image/webp": len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP",
        "application/pdf": data.startswith(b"%PDF-") and b"%%EOF" in data[-1024:],
    }
    if purpose not in {"listing", "verification"} or not signatures.get(content_type, False):
        raise HTTPException(415, "File content does not match an allowed type")
    if purpose == "listing" and content_type == "application/pdf":
        raise HTTPException(415, "Listing images must be PNG, JPEG or WebP")


async def authorize_upload(db: AsyncSession, actor: str, org_id: str, experience_id: object, purpose: str) -> None:
    await require_object(db, actor, "organization", org_id)
    role = await db.scalar(text("SELECT app.member_role(:actor, :org)"), {"actor": actor, "org": org_id})
    assert_capability(str(role), "listings" if purpose == "listing" else "settings")
    if purpose == "listing":
        if experience_id is None:
            raise HTTPException(422, "experience_id required")
        from app.core.portal_auth import fetch_json

        await fetch_json(
            db,
            "SELECT app.get_experience_portal(:actor, :org, :id)",
            {"actor": actor, "org": org_id, "id": str(experience_id)},
        )


async def reserve_upload(org_id: str, size: int) -> None:
    day = datetime.now(timezone.utc).date().isoformat()
    for key, limit, window, amount in (
        (f"upload-count:{org_id}", settings.upload_org_hourly_count, 3600, 1),
        (f"upload-bytes:{org_id}:{day}", settings.upload_org_daily_bytes, 86400, size),
    ):
        retry = await reserve(key, limit, window, amount, durable=True)
        if retry:
            reject(retry, "upload")
