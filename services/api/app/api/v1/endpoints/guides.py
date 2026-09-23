"""The guide portal, phase one: apply, be verified, have a public page.

Nothing here is bookable. This phase exists to find out whether guides will sign
up at all, so it stops at identity: an application, its private documents, an
admin decision, and the page that goes live when the decision is yes.

Every route hands the caller's id to a SECURITY DEFINER function and lets that
function decide what may be touched, the same way the rest of the API works.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.auth_session import require_session
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.guides import GuideCredentialIn, GuideProfileIn

router = APIRouter()


def _payload(model: Any) -> str:
    return json.dumps(model.model_dump(mode="json"), default=str)


@router.get("", dependencies=[access.PUBLIC])
async def list_guides(
    region: str | None = None,
    language: str | None = None,
    tier: str | None = None,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """The public directory. Only approved guides, never their documents."""
    filt = {key: value for key, value in (("region", region), ("language", language), ("tier", tier)) if value}
    rows = await fetch_json(
        db,
        "SELECT app.public_guide_directory(CAST(:filt AS jsonb))",
        {"filt": json.dumps(filt)},
    )
    return list(rows or [])


@router.get("/me", dependencies=[access.SESSION])
async def my_guide_profile(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The caller's own application, documents and all. Null before they apply."""
    session = await require_session(request, db)
    return await fetch_json(db, "SELECT app.get_my_guide_profile(CAST(:uid AS uuid))", {"uid": str(session["user_id"])})


@router.put("/me", dependencies=[access.SESSION])
async def upsert_guide_profile(
    payload: GuideProfileIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Start or edit an application. An approved guide edits their page, not their tier."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_upsert_profile(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": str(session["user_id"]), "body": _payload(payload)},
    )


@router.put("/me/documents", dependencies=[access.SESSION])
async def put_guide_document(
    payload: GuideCredentialIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Attach or replace one document. Replacing it sends it back for review."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_put_credential(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": str(session["user_id"]), "body": _payload(payload)},
    )


@router.post("/me/submit", dependencies=[access.SESSION])
async def submit_guide_application(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Hand the application to the queue. Refused while a required document is missing."""
    session = await require_session(request, db)
    return await fetch_json(db, "SELECT app.guide_submit(CAST(:uid AS uuid))", {"uid": str(session["user_id"])})


@router.get("/{slug}", dependencies=[access.PUBLIC])
async def guide_page(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A guide's public page. Unapproved guides do not have one."""
    row = await fetch_json(db, "SELECT app.public_guide_page(:slug)", {"slug": slug})
    if row is None:
        raise HTTPException(status_code=404, detail="Guide not found")
    return row


__all__ = ["router"]
