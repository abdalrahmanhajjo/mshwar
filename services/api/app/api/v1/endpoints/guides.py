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

from app.core import access, imagekit
from app.core.auth_session import require_session, require_verified_user
from app.core.licences import COMMONS_IMAGE, COMMONS_PAGE, license_allowed
from app.core.rate_limit import limit
from app.core.sql import fetch_json
from app.core.storage import delete_private_bytes, media_url, put_private_bytes
from app.core.uploads import inspect_or_reject, validate_upload
from app.dependencies import get_auth_db
from app.schemas.guides import (
    EngagementAnswerIn,
    EngagementCancelIn,
    EngagementDecisionIn,
    EngagementProposalIn,
    EngagementRequestIn,
    GuideAgreementIn,
    GuideAvailabilityIn,
    GuideCredentialIn,
    GuideDocumentUploadIn,
    GuideProfileIn,
    GuideReportIn,
    GuideReviewIn,
    GuideTourIn,
    HireTermsIn,
    ProposalIn,
    ProposalPhotoIn,
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


@router.put("/me", dependencies=[access.SESSION, limit("guide-write")])
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


@router.put("/me/documents", dependencies=[access.SESSION, limit("guide-write")])
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


@router.post("/me/documents/upload", dependencies=[access.SESSION, limit("guide-write")])
async def upload_guide_document(
    payload: GuideDocumentUploadIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Upload a document file. It goes to private storage; the application keeps only its key."""
    uid = await _uid(request, db)
    raw = validate_upload(payload.content_base64, payload.content_type, "verification")
    inspect_or_reject(raw, payload.content_type)
    stored = put_private_bytes(raw, payload.filename, payload.content_type)
    body = {
        "kind": payload.kind,
        "document_key": stored["object_key"],
        "reference": payload.reference,
        "issuer": payload.issuer,
        "issued_on": payload.issued_on.isoformat() if payload.issued_on else None,
        "expires_on": payload.expires_on.isoformat() if payload.expires_on else None,
    }
    try:
        return await fetch_json(
            db,
            "SELECT app.guide_put_credential(CAST(:uid AS uuid), CAST(:body AS jsonb))",
            {"uid": uid, "body": json.dumps(body)},
        )
    except Exception:
        delete_private_bytes(stored["object_key"])
        raise


@router.post("/me/submit", dependencies=[access.SESSION, limit("guide-write")])
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


@router.put("/me/tours", dependencies=[access.SESSION, limit("guide-write")])
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


@router.post("/me/tours/{tour_id}/publish", dependencies=[access.SESSION, limit("guide-write")])
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


@router.post("/me/tours/{tour_id}/slots", dependencies=[access.SESSION, limit("guide-write")])
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


@router.put("/me/availability", dependencies=[access.SESSION, limit("guide-write")])
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


@router.post("/me/requests/{booking_id}/respond", dependencies=[access.SESSION, limit("guide-write")])
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


# ---- G3: hire a guide from the planner ------------------------------------------------


@router.put("/me/hire-terms", dependencies=[access.SESSION, limit("guide-write")])
async def set_hire_terms(
    payload: HireTermsIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A licensed guide's day rate and largest group. A host has neither."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_set_hire_terms(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": _payload(payload)},
    )


@router.get("/me/engagements", dependencies=[access.SESSION])
async def my_engagements(
    request: Request,
    state: str | None = None,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Days travellers have asked this guide to run, soonest first."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_list_engagements(CAST(:uid AS uuid), :state)",
        {"uid": uid, "state": state},
    )


@router.post("/me/engagements/{engagement_id}/answer", dependencies=[access.SESSION, limit("guide-write")])
async def answer_engagement(
    engagement_id: str,
    payload: EngagementAnswerIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_answer_engagement(CAST(:uid AS uuid), CAST(:id AS uuid), :answer, :reason)",
        {"uid": uid, "id": engagement_id, "answer": payload.answer, "reason": payload.reason},
    )


@router.post("/me/engagements/{engagement_id}/proposal", dependencies=[access.SESSION, limit("guide-write")])
async def propose_changes(
    engagement_id: str,
    payload: EngagementProposalIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Answer with changes: the stops the guide would run, diffed against the plan."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_propose_changes(CAST(:uid AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "id": engagement_id, "body": _payload(payload)},
    )


@router.get("/match", dependencies=[access.SESSION, limit("search")])
async def match_guides(
    request: Request,
    version_id: str,
    language: str | None = None,
    party_size: int | None = None,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Licensed guides who cover the plan's places, speak the language and are free that day."""
    uid = await _uid(request, db)
    filters = {key: value for key, value in (("language", language), ("party_size", party_size)) if value}
    return await fetch_json(
        db,
        "SELECT app.match_guides_for_version(CAST(:uid AS uuid), CAST(:version AS uuid), CAST(:filters AS jsonb))",
        {"uid": uid, "version": version_id, "filters": json.dumps(filters)},
    )


@router.post("/engagements", dependencies=[access.VERIFIED, limit("guide-hire"), limit("booking-ip")])
async def request_engagement(
    payload: EngagementRequestIn,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
) -> Any:
    """Ask a guide to run a planned day. Nothing is paid through Mshwar."""
    return await fetch_json(
        db,
        "SELECT app.request_guide_engagement(CAST(:uid AS uuid), CAST(:version AS uuid), :slug, CAST(:body AS jsonb))",
        {
            "uid": str(user["user_id"]),
            "version": payload.version_id,
            "slug": payload.guide_slug,
            "body": _payload(payload),
        },
    )


@router.get("/trips/{trip_id}/engagements", dependencies=[access.SESSION])
async def trip_engagements(
    trip_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_trip_engagements(CAST(:uid AS uuid), CAST(:trip AS uuid))",
        {"uid": uid, "trip": trip_id},
    )


@router.get("/engagements/{engagement_id}", dependencies=[access.SESSION])
async def get_engagement(
    engagement_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """One engagement, as whichever side is asking sees it."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.get_engagement(CAST(:uid AS uuid), CAST(:id AS uuid))",
        {"uid": uid, "id": engagement_id},
    )


@router.post("/engagements/{engagement_id}/decision", dependencies=[access.SESSION, limit("guide-write")])
async def decide_engagement(
    engagement_id: str,
    payload: EngagementDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The traveller confirms, or accepts or rejects the guide's changes."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.traveller_decide_engagement(CAST(:uid AS uuid), CAST(:id AS uuid), :decision)",
        {"uid": uid, "id": engagement_id, "decision": payload.decision},
    )


@router.post("/engagements/{engagement_id}/cancel", dependencies=[access.SESSION, limit("guide-write")])
async def cancel_engagement(
    engagement_id: str,
    payload: EngagementCancelIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.cancel_engagement(CAST(:uid AS uuid), CAST(:id AS uuid), :reason)",
        {"uid": uid, "id": engagement_id, "reason": payload.reason},
    )


# ---- G4: place proposals and corrections -------------------------------------------------

_PHOTO_SUFFIX = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _with_photo_urls(proposal: Any) -> Any:
    """Add a viewable URL to each photo; the database keeps only provider and key."""
    if isinstance(proposal, dict):
        for photo in proposal.get("photos") or []:
            photo["url"] = media_url(photo.get("provider"), photo.get("object_key"))
    return proposal


@router.get("/me/proposals", dependencies=[access.SESSION])
async def my_proposals(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The guide's proposals, newest first, with today's allowance."""
    uid = await _uid(request, db)
    body = await fetch_json(db, "SELECT app.guide_list_proposals(CAST(:uid AS uuid))", {"uid": uid})
    for proposal in (body or {}).get("proposals", []):
        _with_photo_urls(proposal)
    return body


@router.post("/me/proposals", dependencies=[access.SESSION, limit("guide-contribute")])
async def submit_proposal(
    payload: ProposalIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Propose a new place or a correction. Evidence is required; nothing changes until review."""
    uid = await _uid(request, db)
    try:
        return await fetch_json(
            db,
            "SELECT app.guide_submit_proposal(CAST(:uid AS uuid), CAST(:body AS jsonb))",
            {"uid": uid, "body": json.dumps(payload.model_dump(mode="json", exclude_none=True))},
        )
    except HTTPException as exc:
        # The reputation gate is a rate limit, so it answers like one.
        if exc.status_code == 413 and "daily proposal limit" in str(exc.detail):
            raise HTTPException(status_code=429, detail=exc.detail, headers={"Retry-After": "3600"}) from exc
        raise


@router.post("/me/proposals/{proposal_id}/withdraw", dependencies=[access.SESSION, limit("guide-contribute")])
async def withdraw_proposal(
    proposal_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return _with_photo_urls(
        await fetch_json(
            db,
            "SELECT app.guide_withdraw_proposal(CAST(:uid AS uuid), CAST(:id AS uuid))",
            {"uid": uid, "id": proposal_id},
        )
    )


@router.post("/me/proposals/{proposal_id}/photos", dependencies=[access.SESSION, limit("guide-contribute")])
async def add_proposal_photo(
    proposal_id: str,
    payload: ProposalPhotoIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A photo for a proposal: the guide's own (with their grant) or a Commons file under an allowed licence."""
    uid = await _uid(request, db)
    if payload.content_base64:
        if not payload.rights_granted:
            raise HTTPException(status_code=422, detail="confirm you took this photo and let Mshwar publish it")
        content_type = payload.content_type or ""
        if content_type not in _PHOTO_SUFFIX:
            raise HTTPException(status_code=422, detail="photos must be JPEG, PNG or WebP")
        raw = validate_upload(payload.content_base64, content_type, "listing")
        inspected = inspect_or_reject(raw, content_type)
        stored_key: str | None = None
        photo: dict[str, Any]
        if imagekit.enabled():
            uploaded = await imagekit.get_client().upload(
                raw,
                filename=f"{uuid4().hex}{_PHOTO_SUFFIX[content_type]}",
                folder=f"/proposals/{proposal_id}",
                content_type=content_type,
            )
            photo = {
                "provider": "imagekit",
                "object_key": uploaded.file_path.lstrip("/"),
                "provider_file_id": uploaded.file_id,
            }
        else:
            stored = put_private_bytes(raw, payload.filename or f"photo{_PHOTO_SUFFIX[content_type]}", content_type)
            stored_key = stored["object_key"]
            photo = {"provider": "local", "object_key": stored_key}
        photo |= {
            "source": "guide-upload",
            "content_type": inspected.content_type,
            "byte_size": len(raw),
            "width": inspected.width,
            "height": inspected.height,
            "rights_granted": True,
            "alt_text": payload.alt_text,
        }
        try:
            body = await fetch_json(
                db,
                "SELECT app.guide_attach_proposal_photo(CAST(:uid AS uuid), CAST(:id AS uuid), CAST(:photo AS jsonb))",
                {"uid": uid, "id": proposal_id, "photo": json.dumps(photo)},
            )
        except Exception:
            if stored_key:
                delete_private_bytes(stored_key)
            raise
        return _with_photo_urls(body)

    page, image = payload.commons_page_url or "", payload.commons_image_url or ""
    if not COMMONS_PAGE.fullmatch(page) or not COMMONS_IMAGE.fullmatch(image):
        raise HTTPException(status_code=422, detail="give the Commons file page and its upload.wikimedia.org image")
    if not payload.license or not license_allowed(payload.license, payload.license_url or ""):
        raise HTTPException(status_code=422, detail="that licence does not allow Mshwar to publish the photo")
    commons: dict[str, Any] = {
        "source": "wikimedia-commons",
        "provider": "external",
        "object_key": image,
        "source_url": page,
        "license": payload.license,
        "license_url": payload.license_url,
        "attribution": payload.attribution or "",
        "alt_text": payload.alt_text,
    }
    return _with_photo_urls(
        await fetch_json(
            db,
            "SELECT app.guide_attach_proposal_photo(CAST(:uid AS uuid), CAST(:id AS uuid), CAST(:photo AS jsonb))",
            {"uid": uid, "id": proposal_id, "photo": json.dumps(commons)},
        )
    )


@router.get("/places/{place_slug}/contributors", dependencies=[access.PUBLIC])
async def place_contributors(
    place_slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """The guides who added or corrected a place, for the credit line on its page."""
    rows = await fetch_json(db, "SELECT app.place_contributors(:slug)", {"slug": place_slug})
    return list(rows or [])


# ---- G5: running the day ----------------------------------------------------------------


@router.get("/me/days", dependencies=[access.SESSION])
async def my_days(
    request: Request,
    days: int = 14,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Tour starts with confirmed travellers and confirmed hired days, soonest first."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_list_days(CAST(:uid AS uuid), :days)",
        {"uid": uid, "days": max(1, min(days, 60))},
    )


@router.get("/me/days/{day_id}", dependencies=[access.SESSION])
async def day_sheet(
    day_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The day sheet: stops, times, legs, the group and what to know about them."""
    uid = await _uid(request, db)
    return await fetch_json(
        db, "SELECT app.guide_day_sheet(CAST(:uid AS uuid), CAST(:id AS uuid))", {"uid": uid, "id": day_id}
    )


@router.post("/me/days/{day_id}/start", dependencies=[access.SESSION, limit("guide-write")])
async def start_day(
    day_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(
        db, "SELECT app.guide_start_day(CAST(:uid AS uuid), CAST(:id AS uuid))", {"uid": uid, "id": day_id}
    )


@router.post("/me/days/{day_id}/complete", dependencies=[access.SESSION, limit("guide-write")])
async def complete_day(
    day_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Close the day. Bookings are completed and both sides are asked for a review."""
    uid = await _uid(request, db)
    return await fetch_json(
        db, "SELECT app.guide_complete_day(CAST(:uid AS uuid), CAST(:id AS uuid))", {"uid": uid, "id": day_id}
    )


@router.get("/reviews/inbox", dependencies=[access.SESSION])
async def review_inbox(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Reviews still owed, in either role, and the released reviews about the caller."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_review_inbox(CAST(:uid AS uuid))", {"uid": uid})


@router.post("/reviews", dependencies=[access.SESSION, limit("community-write")])
async def write_review(
    payload: GuideReviewIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Write one half. It stays hidden from the other side until both halves exist or 14 days pass."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.write_guide_review(CAST(:uid AS uuid), CAST(:run AS uuid), CAST(:traveller AS uuid), :rating, :body)",
        {
            "uid": uid,
            "run": payload.run_id,
            "traveller": payload.traveller_id,
            "rating": payload.rating,
            "body": payload.body,
        },
    )


@router.get("/{slug}/reviews", dependencies=[access.PUBLIC])
async def guide_reviews(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Released traveller reviews of a guide, with the average."""
    return await fetch_json(db, "SELECT app.public_guide_reviews(:slug)", {"slug": slug})


# ---- G6: trust and safety -----------------------------------------------------------------


@router.put("/me/agreement", dependencies=[access.SESSION, limit("guide-write")])
async def accept_agreement(
    payload: GuideAgreementIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Accept the guide agreement and code of conduct, at the version the guide was shown."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_accept_agreement(CAST(:uid AS uuid), :version)",
        {"uid": uid, "version": payload.version},
    )


@router.post("/reports", dependencies=[access.SESSION, limit("community-write")])
async def report_day(
    payload: GuideReportIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Either side of a day reports a problem. It opens a support case; safety is escalated."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.report_guide_day(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": _payload(payload)},
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
