"""The guide portal.

G1 is identity: an application, its private documents, an admin decision, and the
page that goes live when the decision is yes. G2 adds the work: tours (listings on
the guide's solo organisation), a weekly rhythm that becomes slots, and the
requests travellers send. A tour is always a request and is paid on the day, so
nothing here moves money.

Every route hands the caller's id to a SECURITY DEFINER function and lets that
function decide what may be touched, the same way the rest of the API works.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.auth_session import require_session, require_verified_user
from app.core.rate_limit import limit
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.guides import (
    GuideAvailabilityIn,
    GuideCredentialIn,
    GuideProfileIn,
    GuideTourIn,
    TourRequestIn,
    TourRequestResponseIn,
)

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


# ---- G2: the guide's own tours --------------------------------------------------------


async def _uid(request: Request, db: AsyncSession) -> str:
    session = await require_session(request, db)
    return str(session["user_id"])


@router.get("/me/tours", dependencies=[access.SESSION])
async def my_tours(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Every tour the guide has written, drafts included. 404 until approved."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_list_tours(CAST(:uid AS uuid))", {"uid": uid})


@router.put("/me/tours", dependencies=[access.SESSION])
async def upsert_tour(
    payload: GuideTourIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Create or edit a tour. A local host's tour is free, whatever the body says."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_upsert_tour(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": _payload(payload)},
    )


@router.post("/me/tours/{tour_id}/publish", dependencies=[access.SESSION])
async def publish_tour(
    tour_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Publish through the same report every listing passes (photo, price, policy, place)."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_publish_tour(CAST(:uid AS uuid), CAST(:tour AS uuid))",
        {"uid": uid, "tour": tour_id},
    )


@router.post("/me/tours/{tour_id}/slots", dependencies=[access.SESSION])
async def generate_tour_slots(
    tour_id: str,
    request: Request,
    days: int = 28,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Turn the weekly rhythm into bookable starts, respecting notice and the daily cap."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_generate_tour_slots(CAST(:uid AS uuid), CAST(:tour AS uuid), :days)",
        {"uid": uid, "tour": tour_id, "days": max(1, min(days, 90))},
    )


@router.get("/me/availability", dependencies=[access.SESSION])
async def my_availability(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_get_availability(CAST(:uid AS uuid))", {"uid": uid})


@router.put("/me/availability", dependencies=[access.SESSION])
async def set_availability(
    payload: GuideAvailabilityIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_set_availability(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": _payload(payload)},
    )


@router.get("/me/requests", dependencies=[access.SESSION])
async def my_requests(
    request: Request,
    status: str | None = None,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The request inbox: what travellers asked for, newest first."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_list_requests(CAST(:uid AS uuid), :status)",
        {"uid": uid, "status": status},
    )


@router.post("/me/requests/{booking_id}/respond", dependencies=[access.SESSION])
async def respond_request(
    booking_id: str,
    payload: TourRequestResponseIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Accept or decline. The traveller hears either way, with the guide's reason."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_respond_request(CAST(:uid AS uuid), CAST(:booking AS uuid), :status, :reason, :message)",
        {
            "uid": uid,
            "booking": booking_id,
            "status": payload.status,
            "reason": payload.reason,
            "message": payload.message,
        },
    )


# ---- G2: the traveller's side ---------------------------------------------------------


@router.post("/tours/{tour_slug}/request", dependencies=[access.VERIFIED, limit("booking"), limit("booking-ip")])
async def request_tour(
    tour_slug: str,
    payload: TourRequestIn,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    """Ask for a place on a tour. The guide confirms; payment happens on the day, to the guide."""
    key = (idempotency_key or payload.idempotency_key or f"tour-{uuid4().hex}").strip()
    body = {"tour": tour_slug, "slot_id": payload.slot_id, "party_size": payload.party_size}
    digest = hashlib.sha256(json.dumps(body, sort_keys=True).encode("utf-8")).hexdigest()
    return await fetch_json(
        db,
        "SELECT app.guide_request_tour(CAST(:uid AS uuid), :slug, CAST(:slot AS uuid), :party, :key, :hash)",
        {
            "uid": str(user["user_id"]),
            "slug": tour_slug,
            "slot": payload.slot_id,
            "party": payload.party_size,
            "key": key,
            "hash": digest,
        },
    )


@router.get("/{slug}/tours", dependencies=[access.PUBLIC])
async def guide_tours(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """A guide's published tours with their next open starts."""
    rows = await fetch_json(db, "SELECT app.public_guide_tours(:slug)", {"slug": slug})
    return list(rows or [])


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
