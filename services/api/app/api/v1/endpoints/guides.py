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
import re
import secrets
from datetime import date, datetime, timedelta
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core import access, ical_import, imagekit, secret_box, virus_scan
from app.core.auth_session import require_session, require_verified_user
from app.core.config import settings
from app.core.ics import CalendarEvent, calendar
from app.core.licences import COMMONS_IMAGE, COMMONS_PAGE, license_allowed
from app.core.rate_limit import limit
from app.core.sql import fetch_json
from app.core.storage import delete_private_bytes, media_url, put_private_bytes
from app.core.uploads import inspect_or_reject, validate_upload, without_metadata
from app.dependencies import get_auth_db
from app.planner.weather import WeatherService
from app.schemas.guides import (
    BookingSettingsIn,
    BusyBlockIn,
    CheckInIn,
    ConversationCloseIn,
    ConversationStartIn,
    EngagementAnswerIn,
    EngagementCancelIn,
    EngagementDecisionIn,
    EngagementProposalIn,
    EngagementRequestIn,
    ExternalCalendarIn,
    GuideAgreementIn,
    GuideAvailabilityIn,
    GuideCredentialIn,
    GuideDocumentUploadIn,
    GuideProfileIn,
    GuideReportIn,
    GuideReviewIn,
    GuideTourIn,
    HireTermsIn,
    MessageIn,
    PaymentRecordIn,
    ProposalIn,
    ProposalPhotoIn,
    RescheduleAnswerIn,
    RescheduleIn,
    ReviewReplyIn,
    TourBookingIn,
    TourCancelIn,
    TourContentIn,
    TourRequestIn,
    TourRequestResponseIn,
    TourScheduleIn,
)

router = APIRouter()
BEIRUT = ZoneInfo("Asia/Beirut")


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


@router.get("/programme", dependencies=[access.PUBLIC])
async def founding_programme(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """How many Founding Guide places are left (migration 060): a count, never a guess."""
    return await fetch_json(db, "SELECT app.founding_guide_programme()", {})


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
    raw = without_metadata(raw, payload.content_type)
    await virus_scan.scan_or_reject(raw, "guide-document")
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
    # Only what was sent: a field left out keeps the guide's earlier choice.
    body = json.dumps(payload.model_dump(mode="json", exclude_unset=True), default=str)
    return await fetch_json(
        db,
        "SELECT app.guide_set_availability(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": body},
    )


# ---- Step 2: schedules per tour and blocked time ---------------------------------------


@router.get("/me/tours/{tour_id}/schedules", dependencies=[access.SESSION])
async def tour_schedules(
    tour_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A tour's recurring schedules, each with how many starts it has open."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_list_schedules(CAST(:uid AS uuid), CAST(:tour AS uuid))",
        {"uid": uid, "tour": tour_id},
    )


@router.put("/me/tours/{tour_id}/schedules", dependencies=[access.SESSION, limit("guide-write")])
async def save_tour_schedule(
    tour_id: str,
    payload: TourScheduleIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Create or change one schedule and fill its next 120 days. Booked starts are never moved."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_save_schedule(CAST(:uid AS uuid), CAST(:tour AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "tour": tour_id, "body": _payload(payload)},
    )


@router.delete("/me/schedules/{schedule_id}", dependencies=[access.SESSION, limit("guide-write")])
async def delete_tour_schedule(
    schedule_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Stop a schedule. Its empty future starts go; starts with a booking stay."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_delete_schedule(CAST(:uid AS uuid), CAST(:schedule AS uuid))",
        {"uid": uid, "schedule": schedule_id},
    )


@router.get("/me/blocks", dependencies=[access.SESSION])
async def my_blocks(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Blocked time from now on."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_list_blocks(CAST(:uid AS uuid))", {"uid": uid})


@router.post("/me/blocks", dependencies=[access.SESSION, limit("guide-write")])
async def add_block(
    payload: BusyBlockIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Block time. Refused over a live booking, so no traveller is stranded."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_add_block(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": _payload(payload)},
    )


@router.delete("/me/blocks/{block_id}", dependencies=[access.SESSION, limit("guide-write")])
async def delete_block(
    block_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_delete_block(CAST(:uid AS uuid), CAST(:block AS uuid))",
        {"uid": uid, "block": block_id},
    )


# ---- Step 3: how a tour is booked -------------------------------------------------------


@router.put("/me/tours/{tour_id}/booking-settings", dependencies=[access.SESSION, limit("guide-write")])
async def set_booking_settings(
    tour_id: str,
    payload: BookingSettingsIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Instant or request, the reply window, the policy, a child price and extras. A host stays free."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_set_booking_settings(CAST(:uid AS uuid), CAST(:tour AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "tour": tour_id, "body": _payload(payload)},
    )


@router.get("/me/bookings/{booking_id}", dependencies=[access.SESSION])
async def guide_booking(
    booking_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """One booking on the guide's tours, with who is coming, extras and the traveller's note."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_tour_booking(CAST(:uid AS uuid), CAST(:booking AS uuid))",
        {"uid": uid, "booking": booking_id},
    )


# ---- Step 4: the tours marketplace ---------------------------------------------------------


def _with_tour_photos(value: Any) -> Any:
    """Turn stored photo keys into viewable URLs on a tour card, a tour page or a list of cards."""
    if isinstance(value, list):
        return [_with_tour_photos(item) for item in value]
    if isinstance(value, dict):
        for key in ("photo", "photos"):
            item = value.get(key)
            for photo in item if isinstance(item, list) else [item] if isinstance(item, dict) else []:
                photo["url"] = media_url(photo.pop("provider", None), photo.pop("object_key", None))
        if isinstance(value.get("tours"), list):
            value["tours"] = _with_tour_photos(value["tours"])
    return value


@router.get("/tours", dependencies=[access.PUBLIC, limit("search")])
async def search_tours(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    q: str | None = Query(default=None, max_length=80),
    destination: str | None = Query(default=None, max_length=80),
    language: str | None = Query(default=None, max_length=12),
    day: date | None = Query(default=None, alias="date"),  # noqa: B008
    max_duration: int | None = Query(default=None, ge=30, le=1440),
    max_price: int | None = Query(default=None, ge=0, le=100_000_000),
    instant: bool = False,
    sort: str = Query(default="recommended", pattern="^(recommended|price|duration|soonest)$"),
    limit_to: int = Query(default=60, ge=1, le=100, alias="limit"),
) -> Any:
    """Published tours by approved guides, filtered and sorted. Ratings are only released reviews."""
    filters = {
        "q": q,
        "destination": destination,
        "language": language,
        "date": day.isoformat() if day else None,
        "max_duration": max_duration,
        "max_price": max_price,
        "instant": instant,
        "sort": sort,
        "limit": limit_to,
    }
    row = await fetch_json(
        db,
        "SELECT app.public_tours_search(CAST(:filters AS jsonb))",
        {"filters": json.dumps({k: v for k, v in filters.items() if v is not None})},
    )
    return _with_tour_photos(row)


@router.get("/tour-slugs", dependencies=[access.PUBLIC])
async def tour_slugs(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Every listed tour, for the sitemap."""
    return await fetch_json(db, "SELECT app.public_tour_slugs()", {})


@router.get("/destinations/{destination_slug}/tours", dependencies=[access.PUBLIC])
async def destination_tours(
    destination_slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Guided tours that start in one destination, for its page."""
    rows = await fetch_json(db, "SELECT app.public_destination_tours(:slug, 6)", {"slug": destination_slug})
    return _with_tour_photos(rows or [])


@router.put("/me/tours/{tour_id}/content", dependencies=[access.SESSION, limit("guide-write")])
async def set_tour_content(
    tour_id: str,
    payload: TourContentIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Highlights, questions and answers, and accessibility for the tour page."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_set_tour_content(CAST(:uid AS uuid), CAST(:tour AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "tour": tour_id, "body": _payload(payload)},
    )


@router.get("/tours/{tour_slug}", dependencies=[access.PUBLIC])
async def public_tour(
    tour_slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """One published tour: photos, highlights, route, guide, real rating and how it books."""
    row = await fetch_json(db, "SELECT app.public_tour(:slug)", {"slug": tour_slug})
    if row is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    return _with_tour_photos(row)


@router.get("/tours/{tour_slug}/availability", dependencies=[access.PUBLIC])
async def tour_availability(
    tour_slug: str,
    month: str = Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A month of bookable starts, each day with its times and seats left."""
    row = await fetch_json(
        db,
        "SELECT app.public_tour_availability(:slug, CAST(:month AS date))",
        {"slug": tour_slug, "month": date.fromisoformat(f"{month}-01")},
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Tour not found")
    return row


@router.post("/tours/{tour_slug}/book", dependencies=[access.VERIFIED, limit("booking"), limit("booking-ip")])
async def book_tour(
    tour_slug: str,
    payload: TourBookingIn,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
    user: dict[str, Any] = Depends(require_verified_user),  # noqa: B008
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> Any:
    """Book a start. Instant tours are confirmed at once; others are a request. Paid on the day."""
    key = (idempotency_key or payload.idempotency_key or f"tour-{uuid4().hex}").strip()
    body = payload.model_dump(mode="json", exclude={"idempotency_key"})
    digest = hashlib.sha256(json.dumps({"tour": tour_slug, **body}, sort_keys=True).encode("utf-8")).hexdigest()
    return await fetch_json(
        db,
        "SELECT app.tour_book(CAST(:uid AS uuid), :slug, CAST(:body AS jsonb), :key, :hash)",
        {
            "uid": str(user["user_id"]),
            "slug": tour_slug,
            "body": json.dumps(body),
            "key": key,
            "hash": digest,
        },
    )


@router.get("/bookings/{booking_id}", dependencies=[access.SESSION])
async def my_tour_booking(
    booking_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The traveller's own tour booking: code, time, who is coming, the total and the policy."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.traveller_tour_booking(CAST(:uid AS uuid), CAST(:booking AS uuid))",
        {"uid": uid, "booking": booking_id},
    )


@router.post("/bookings/{booking_id}/cancel", dependencies=[access.SESSION, limit("booking")])
async def cancel_tour_booking(
    booking_id: str,
    payload: TourCancelIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Either side cancels, with a reason. Late traveller cancellations are recorded as late."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.tour_cancel(CAST(:uid AS uuid), CAST(:booking AS uuid), :reason)",
        {"uid": uid, "booking": booking_id, "reason": payload.reason},
    )


@router.post("/bookings/{booking_id}/reschedule", dependencies=[access.SESSION, limit("booking")])
async def propose_reschedule(
    booking_id: str,
    payload: RescheduleIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Propose another start of the same tour. The other side accepts or declines."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.tour_propose_reschedule(CAST(:uid AS uuid), CAST(:booking AS uuid), CAST(:slot AS uuid), :message)",
        {"uid": uid, "booking": booking_id, "slot": payload.slot_id, "message": payload.message},
    )


@router.post("/bookings/{booking_id}/reschedule/answer", dependencies=[access.SESSION, limit("booking")])
async def answer_reschedule(
    booking_id: str,
    payload: RescheduleAnswerIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Accept (the booking moves, with a new code) or decline another side's proposal."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.tour_answer_reschedule(CAST(:uid AS uuid), CAST(:booking AS uuid), :accept)",
        {"uid": uid, "booking": booking_id, "accept": payload.accept},
    )


# ---- Step 5: after booking --------------------------------------------------------------


@router.get("/my-bookings", dependencies=[access.SESSION])
async def my_tour_bookings(
    request: Request,
    when: str = Query(default="upcoming", pattern="^(upcoming|past)$"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The traveller's tour bookings: upcoming soonest first, or past most recent first."""
    uid = await _uid(request, db)
    return await fetch_json(
        db, "SELECT app.traveller_tour_bookings(CAST(:uid AS uuid), :when)", {"uid": uid, "when": when}
    )


@router.get("/bookings/{booking_id}/calendar.ics", dependencies=[access.SESSION])
async def tour_booking_calendar(
    booking_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Response:
    """The booking as a calendar file, for any calendar app."""
    uid = await _uid(request, db)
    row = await fetch_json(
        db,
        "SELECT app.traveller_tour_booking(CAST(:uid AS uuid), CAST(:booking AS uuid))",
        {"uid": uid, "booking": booking_id},
    )
    link = f"{settings.public_web_origin.rstrip('/')}/tour-bookings/{row['id']}"
    event = CalendarEvent(
        uid=f"tour-booking-{row['id']}@mshwar",
        starts_at=datetime.fromisoformat(row["starts_at"]),
        ends_at=datetime.fromisoformat(row["ends_at"]),
        summary=f"{row['tour_title']} ({row['code']})",
        location=row.get("meeting_point") or "",
        description=f"Guide: {row['guide_name']}\nBooking {row['code']}\n{link}",
        url=link,
        cancelled=row["status"] not in ("pending", "confirmed", "completed"),
    )
    return Response(
        content=calendar([event], name=row["tour_title"]),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="mshwar-{row["code"]}.ics"'},
    )


@router.post("/bookings/{booking_id}/arrived", dependencies=[access.SESSION, limit("booking")])
async def traveller_arrived(
    booking_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """ "I'm here": tell the guide the traveller has reached the meeting point."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.tour_traveller_arrived(CAST(:uid AS uuid), CAST(:booking AS uuid))",
        {"uid": uid, "booking": booking_id},
    )


@router.get("/conversations", dependencies=[access.SESSION])
async def my_conversations(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Every conversation the caller has, as a traveller or as a guide, newest first."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.list_guide_conversations(CAST(:uid AS uuid))", {"uid": uid})


@router.post("/conversations", dependencies=[access.VERIFIED, limit("community-write")])
async def start_conversation(
    payload: ConversationStartIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Write to a guide. Contact details stay masked until a booking with them is confirmed."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.start_guide_conversation(CAST(:uid AS uuid), :guide, :body)",
        {"uid": uid, "guide": payload.guide_slug, "body": payload.body},
    )


@router.get("/conversations/{conversation_id}", dependencies=[access.SESSION])
async def read_conversation(
    conversation_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """One conversation with its messages; the other side's messages are marked read."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.read_guide_conversation(CAST(:uid AS uuid), CAST(:conversation AS uuid))",
        {"uid": uid, "conversation": conversation_id},
    )


@router.post("/conversations/{conversation_id}/messages", dependencies=[access.SESSION])
async def send_message(
    conversation_id: str,
    payload: MessageIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.send_guide_message(CAST(:uid AS uuid), CAST(:conversation AS uuid), :body)",
        {"uid": uid, "conversation": conversation_id, "body": payload.body},
    )


@router.post("/conversations/{conversation_id}/close", dependencies=[access.SESSION, limit("community-write")])
async def close_conversation(
    conversation_id: str,
    payload: ConversationCloseIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Block the conversation; with a report, support gets the thread."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.close_guide_conversation(CAST(:uid AS uuid), CAST(:conversation AS uuid), :report, :reason)",
        {"uid": uid, "conversation": conversation_id, "report": payload.report, "reason": payload.reason},
    )


@router.post("/ops/reminders", dependencies=[access.JOB])
async def send_reminders(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Every 15 minutes: day-before and two-hour reminders, request nudges and tomorrow's manifests."""
    return await fetch_json(db, "SELECT app.tour_send_reminders()", {})


# Thresholds for a warning two days before an outdoor run.
RAIN_MM = 5.0
HEAT_C = 35.0
WIND_KMH = 50.0


@router.post("/ops/weather-alerts", dependencies=[access.JOB])
async def weather_alerts(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Every 6 hours: warn guides about rain, heat or wind for booked outdoor runs 36-60 hours out."""
    candidates = await fetch_json(db, "SELECT app.tour_weather_candidates()", {}) or []
    service = WeatherService()
    warned = 0
    checked = 0
    for run in candidates:
        if run.get("lat") is None or run.get("lng") is None:
            continue
        day = datetime.fromisoformat(run["starts_at"]).astimezone(BEIRUT).date()
        forecast = await run_in_threadpool(service.forecast, float(run["lat"]), float(run["lng"]), day)
        checked += 1
        if not forecast.available:
            continue
        reason = None
        if (forecast.precip_mm or 0) >= RAIN_MM:
            reason = "rain"
        elif (forecast.temp_max_c or 0) >= HEAT_C:
            reason = "heat"
        elif (forecast.wind_kmh or 0) >= WIND_KMH:
            reason = "wind"
        if reason:
            detail = {
                "precip_mm": forecast.precip_mm,
                "temp_max_c": forecast.temp_max_c,
                "wind_kmh": forecast.wind_kmh,
                "source": forecast.source,
            }
            recorded = await fetch_json(
                db,
                "SELECT app.tour_record_weather_alert(CAST(:slot AS uuid), :reason, CAST(:detail AS jsonb))",
                {"slot": run["slot_id"], "reason": reason, "detail": json.dumps(detail)},
            )
            warned += 1 if recorded else 0
    return {"checked": checked, "warned": warned}


@router.post("/ops/generate-slots", dependencies=[access.JOB])
async def generate_all_slots(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Nightly: keep every live schedule filled 120 days ahead."""
    return await fetch_json(db, "SELECT app.guide_generate_all_slots()", {})


@router.post("/ops/min-group-check", dependencies=[access.JOB])
async def min_group_check(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Hourly: cancel, with the reason, shared runs that missed their minimum group."""
    return await fetch_json(db, "SELECT app.guide_min_group_check()", {})


# ---- Step 6: the guide's workspace -------------------------------------------------------


@router.get("/me/calendar", dependencies=[access.SESSION])
async def my_calendar(
    request: Request,
    start: date = Query(alias="from"),  # noqa: B008
    end: date = Query(alias="to"),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Runs (with who booked), blocked and imported busy time, hired days and days off, up to two months."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_calendar(CAST(:uid AS uuid), :start, :end)",
        {"uid": uid, "start": start, "end": end},
    )


@router.get("/me/calendar-feed", dependencies=[access.SESSION])
async def calendar_feed_status(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Whether the guide has a private calendar address. The address itself is never shown again."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_calendar_feed_status(CAST(:uid AS uuid))", {"uid": uid})


def _feed_url(token: str) -> str:
    return f"{settings.public_web_origin.rstrip('/')}/api/v1/guides/feeds/{token}.ics"


@router.post("/me/calendar-feed", dependencies=[access.SESSION, limit("guide-write")])
async def new_calendar_feed(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A new private calendar address (the old one stops working). Shown once; only its hash is kept."""
    uid = await _uid(request, db)
    token = secrets.token_urlsafe(32)
    await fetch_json(
        db,
        "SELECT app.guide_new_calendar_feed(CAST(:uid AS uuid), :hash)",
        {"uid": uid, "hash": hashlib.sha256(token.encode()).hexdigest()},
    )
    status = await fetch_json(db, "SELECT app.guide_calendar_feed_status(CAST(:uid AS uuid))", {"uid": uid})
    return {**status, "url": _feed_url(token)}


@router.delete("/me/calendar-feed", dependencies=[access.SESSION, limit("guide-write")])
async def revoke_calendar_feed(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_revoke_calendar_feed(CAST(:uid AS uuid))", {"uid": uid})


@router.get("/feeds/{token}.ics", dependencies=[access.PUBLIC, limit("search")])
async def calendar_feed(
    token: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Response:
    """The guide's confirmed runs and hired days as a calendar subscription. The address is the key."""
    if not re.fullmatch(r"[A-Za-z0-9_-]{20,100}", token):
        raise HTTPException(status_code=404, detail="Calendar not found")
    feed = await fetch_json(
        db, "SELECT app.guide_calendar_feed(:hash)", {"hash": hashlib.sha256(token.encode()).hexdigest()}
    )
    if not feed:
        raise HTTPException(status_code=404, detail="Calendar not found")
    origin = settings.public_web_origin.rstrip("/")
    events = [
        CalendarEvent(
            uid=f"tour-run-{run['id']}@mshwar",
            starts_at=datetime.fromisoformat(run["starts_at"]),
            ends_at=datetime.fromisoformat(run["ends_at"]),
            summary=f"{run['title']} · {run['guests'] or 0} guests",
            location=run.get("meeting_point") or "",
            description=f"{origin}/guide/calendar",
            url=f"{origin}/guide/calendar",
        )
        for run in feed["runs"]
    ]
    for day in feed["hired_days"]:
        local = date.fromisoformat(day["local_date"])
        events.append(
            CalendarEvent(
                uid=f"hired-day-{day['id']}@mshwar",
                starts_at=datetime.combine(local, datetime.min.time(), BEIRUT),
                ends_at=datetime.combine(local + timedelta(days=1), datetime.min.time(), BEIRUT),
                summary="Hired for the day (Mshwar)",
                description=f"{origin}/guide/requests/{day['id']}",
                url=f"{origin}/guide/requests/{day['id']}",
            )
        )
    return Response(
        content=calendar(events, name=f"Mshwar · {feed['name']}"),
        media_type="text/calendar; charset=utf-8",
        headers={"Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex"},
    )


@router.get("/me/calendars", dependencies=[access.SESSION])
async def my_external_calendars(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Other calendars whose busy time keeps travellers from booking over it."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_list_external_calendars(CAST(:uid AS uuid))", {"uid": uid})


_CALENDAR_CONTEXT = "calendar-url"
_CALENDAR_URL = re.compile(r"^https://[^/\s]+/\S*$")


def normalise_calendar_url(raw: str) -> str:
    """webcal:// is how Google and Apple hand out the same address; anything else must be https."""
    url = raw.strip()
    if url.lower().startswith("webcal://"):
        url = "https://" + url[len("webcal://") :]
    if not _CALENDAR_URL.match(url) or len(url) > 1000:
        raise HTTPException(status_code=422, detail="paste the calendar's secret address (https:// or webcal://)")
    return url


def _calendar_host(url: str) -> str:
    return url.split("/", 3)[2][:255]


async def _calendar_url(db: AsyncSession, row: dict[str, Any]) -> str:
    """The address to read, decrypted. A row from before 068 (plain text) or one encrypted
    with a previous key is stored again under the current key."""
    if row.get("ciphertext"):
        url = secret_box.decrypt(row["ciphertext"], _CALENDAR_CONTEXT)
        if secret_box.is_current(row["ciphertext"]):
            return url
    else:
        url = str(row["url"])
    await fetch_json(
        db,
        "SELECT to_jsonb(app.guide_store_calendar_secret(CAST(:id AS uuid), :ciphertext, :fingerprint, :host))",
        {
            "id": row["id"],
            "ciphertext": secret_box.encrypt(url, _CALENDAR_CONTEXT),
            "fingerprint": secret_box.fingerprint(url, _CALENDAR_CONTEXT),
            "host": _calendar_host(url),
        },
    )
    return url


async def _sync_calendars(db: AsyncSession, uid: str | None, cap: int = 200) -> dict[str, int]:
    """Read each calendar and replace its busy time. A calendar that cannot be read keeps its last busy time."""
    rows = await fetch_json(
        db, "SELECT app.guide_calendars_to_sync(CAST(:uid AS uuid), :cap)", {"uid": uid, "cap": cap}
    )
    synced = failed = 0
    for row in rows or []:
        periods: list[dict[str, str]] = []
        error: str | None = None
        try:
            url = await _calendar_url(db, row)
            text_body = await run_in_threadpool(ical_import.fetch_calendar, url)
            periods = [period.as_json() for period in ical_import.busy_periods(text_body)]
        except ical_import.CalendarFetchError as exc:
            error = str(exc)
        except secret_box.SecretBoxError:
            error = "the saved address can no longer be read; connect the calendar again"
        await fetch_json(
            db,
            "SELECT to_jsonb(app.guide_replace_external_blocks(CAST(:id AS uuid), CAST(:periods AS jsonb), :error))",
            {"id": row["id"], "periods": json.dumps(periods), "error": error},
        )
        if error is None:
            synced += 1
        else:
            failed += 1
    return {"synced": synced, "failed": failed}


@router.post("/me/calendars", dependencies=[access.SESSION, limit("guide-write")])
async def add_external_calendar(
    payload: ExternalCalendarIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Connect a calendar and read it straight away. The address is stored encrypted (SEC-45)."""
    uid = await _uid(request, db)
    url = normalise_calendar_url(payload.url)
    await fetch_json(
        db,
        "SELECT app.guide_add_external_calendar_secret(CAST(:uid AS uuid), :ciphertext, :fingerprint, :host, :label)",
        {
            "uid": uid,
            "ciphertext": secret_box.encrypt(url, _CALENDAR_CONTEXT),
            "fingerprint": secret_box.fingerprint(url, _CALENDAR_CONTEXT),
            "host": _calendar_host(url),
            "label": payload.label,
        },
    )
    await _sync_calendars(db, uid)
    return await fetch_json(db, "SELECT app.guide_list_external_calendars(CAST(:uid AS uuid))", {"uid": uid})


@router.post("/me/calendars/sync", dependencies=[access.SESSION, limit("guide-write")])
async def sync_external_calendars(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Read the guide's calendars now instead of waiting for the next 15-minute round."""
    uid = await _uid(request, db)
    await _sync_calendars(db, uid)
    return await fetch_json(db, "SELECT app.guide_list_external_calendars(CAST(:uid AS uuid))", {"uid": uid})


@router.delete("/me/calendars/{calendar_id}", dependencies=[access.SESSION, limit("guide-write")])
async def remove_external_calendar(
    calendar_id: str,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Disconnect a calendar; its busy time goes with it."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_remove_external_calendar(CAST(:uid AS uuid), CAST(:calendar AS uuid))",
        {"uid": uid, "calendar": calendar_id},
    )


@router.post("/ops/calendar-sync", dependencies=[access.JOB])
async def calendar_sync(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Every 15 minutes: refresh busy time from every connected calendar."""
    return await _sync_calendars(db, None)


@router.post("/me/bookings/{booking_id}/check-in", dependencies=[access.SESSION, limit("guide-write")])
async def check_in(
    booking_id: str,
    payload: CheckInIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """On the day: the guests arrived, or did not come."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_check_in(CAST(:uid AS uuid), CAST(:booking AS uuid), :status)",
        {"uid": uid, "booking": booking_id, "status": payload.status},
    )


@router.post("/me/bookings/{booking_id}/payment", dependencies=[access.SESSION, limit("guide-write")])
async def record_payment(
    booking_id: str,
    payload: PaymentRecordIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """What the guide received on the day, and how."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_record_payment(CAST(:uid AS uuid), CAST(:booking AS uuid), :amount, :method)",
        {"uid": uid, "booking": booking_id, "amount": payload.amount_minor, "method": payload.method},
    )


@router.get("/me/earnings", dependencies=[access.SESSION])
async def my_earnings(
    request: Request,
    month: date = Query(),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A month's statement: what bookings said, what the guide recorded, the fee and what is theirs."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_earnings(CAST(:uid AS uuid), :month)", {"uid": uid, "month": month})


def _csv_cell(value: Any) -> str:
    """One cell, safe to open in a spreadsheet: a leading formula character is neutralised."""
    text_value = "" if value is None else str(value)
    return "'" + text_value if text_value[:1] in ("=", "+", "-", "@", "\t", "\r") else text_value


def _csv_line(values: list[Any]) -> str:
    """One RFC 4180 line. Every cell goes through ``_csv_cell``, so no cell can run a formula."""
    cells = []
    for value in values:
        cell = _csv_cell(value)
        if any(char in cell for char in (",", '"', "\n", "\r")):
            cell = '"' + cell.replace('"', '""') + '"'
        cells.append(cell)
    return ",".join(cells) + "\r\n"


def _money(minor: Any) -> str:
    return "" if minor is None else f"{int(minor) / 100:.2f}"


@router.get("/me/earnings.csv", dependencies=[access.SESSION])
async def my_earnings_csv(
    request: Request,
    month: date = Query(),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Response:
    """The month's statement as a spreadsheet, one row per booking."""
    uid = await _uid(request, db)
    statement = await fetch_json(
        db, "SELECT app.guide_earnings(CAST(:uid AS uuid), :month)", {"uid": uid, "month": month}
    )
    lines = [_csv_line(["date", "booking", "tour", "guests", "status", "expected_usd", "received_usd", "method"])]
    for row in statement["rows"]:
        lines.append(
            _csv_line(
                [
                    datetime.fromisoformat(row["starts_at"]).astimezone(BEIRUT).strftime("%Y-%m-%d %H:%M"),
                    row["code"],
                    row["tour_title"],
                    row["party_size"],
                    "no-show" if row["no_show"] else row["status"],
                    _money(row["expected_minor"]),
                    _money(row["paid_minor"]),
                    row["paid_method"],
                ]
            )
        )
    lines.append("\r\n")
    lines.append(_csv_line(["received_usd", _money(statement["recorded_minor"])]))
    lines.append(_csv_line(["mshwar_fee_percent", statement["fee_percent"]]))
    lines.append(_csv_line(["mshwar_fee_usd", _money(statement["fee_minor"])]))
    lines.append(_csv_line(["yours_usd", _money(statement["net_minor"])]))
    return Response(
        content="".join(lines),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="mshwar-earnings-{statement["month"]}.csv"'},
    )


@router.get("/me/insights", dependencies=[access.SESSION])
async def my_insights(
    request: Request,
    days: int = Query(default=90, ge=7, le=365),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Per tour: requests, confirmations, declines, lapses, cancellations, seats filled and reply speed."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_insights(CAST(:uid AS uuid), :days)", {"uid": uid, "days": days})


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
        raw = without_metadata(raw, content_type)
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
    """Write one half. It stays hidden from the other side until both halves exist or 14 days pass.

    A traveller may also rate knowledge, communication, value and route (each optional).
    """
    uid = await _uid(request, db)
    parts = payload.parts.model_dump(exclude_none=True) if payload.parts else {}
    return await fetch_json(
        db,
        "SELECT app.write_guide_review_full(CAST(:uid AS uuid), CAST(:run AS uuid), CAST(:traveller AS uuid), "
        ":rating, :body, CAST(:parts AS jsonb))",
        {
            "uid": uid,
            "run": payload.run_id,
            "traveller": payload.traveller_id,
            "rating": payload.rating,
            "body": payload.body,
            "parts": json.dumps(parts),
        },
    )


@router.post("/reviews/{review_id}/reply", dependencies=[access.SESSION, limit("community-write")])
async def reply_to_review(
    review_id: str,
    payload: ReviewReplyIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The guide answers a published review once, in public."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_reply_to_review(CAST(:uid AS uuid), CAST(:review AS uuid), :body)",
        {"uid": uid, "review": review_id, "body": payload.body},
    )


# ---- Step 7: quality, levels and ranking ---------------------------------------------------


@router.get("/me/quality", dependencies=[access.SESSION])
async def my_quality(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The guide's level, the numbers behind it, their ranking parts and any strikes."""
    uid = await _uid(request, db)
    return await fetch_json(db, "SELECT app.guide_my_quality(CAST(:uid AS uuid))", {"uid": uid})


@router.post("/ops/levels", dependencies=[access.JOB])
async def recompute_levels(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Nightly: levels and ranking scores from the last 12 months."""
    return await fetch_json(db, "SELECT app.guide_recompute_levels()", {})


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
