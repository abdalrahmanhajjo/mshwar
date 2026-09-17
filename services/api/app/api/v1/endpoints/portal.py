from __future__ import annotations

import csv
import io
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access, imagekit
from app.core.auth_session import require_session
from app.core.config import settings
from app.core.geo import lebanon_bounds, point_in_lebanon
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.imagekit import UploadedImage
from app.core.mailer import MailMessage, get_mailer
from app.core.media_inspect import Inspected
from app.core.rate_limit import enforce_rate_limit
from app.core.sessions import hash_session_token, new_session_token
from app.core.sql import fetch_json
from app.core.storage import (
    content_type_for,
    delete_private_bytes,
    media_url,
    put_private_bytes,
    read_private_bytes,
    sign_object_url,
    verify_signed_token,
)
from app.core.uploads import inspect_or_reject, validate_upload
from app.dependencies import get_auth_db
from app.schemas.groups import ReviewResponseIn
from app.schemas.notifications import EscalationIn, RolePrefIn
from app.schemas.portal import (
    AnalyticsCaptureIn,
    BlackoutIn,
    BookingRespondIn,
    ExperienceStatusUpdate,
    ExperienceUpsert,
    FileUploadIn,
    OpeningExceptionIn,
    OpeningHoursReplace,
    OrganizationContactsUpdate,
    OrganizationCreate,
    SlotGenerateIn,
    StaffInviteAccept,
    StaffInviteCreate,
    VenueUpsert,
    VerificationSubmit,
)

router = APIRouter()


async def _session(request: Request, db: AsyncSession) -> dict[str, Any]:
    return await require_session(request, db)


def _user_id(session: dict[str, Any]) -> str:
    return str(session["user_id"])


@router.get("/geo/lebanon", dependencies=[access.PUBLIC])
async def get_lebanon_bounds() -> dict[str, Any]:
    return {"bounds": lebanon_bounds(), "picker": "map"}


@router.get("/taxonomy", dependencies=[access.PUBLIC])
async def get_taxonomy(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    return await fetch_json(db, "SELECT app.list_taxonomy_catalog()", {})


@router.post("/organizations", status_code=status.HTTP_201_CREATED, dependencies=[access.SESSION])
async def create_organization(
    payload: OrganizationCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    contact = payload.public_contact.model_dump(exclude_none=True) if payload.public_contact else {}
    return await fetch_json(
        db,
        "SELECT app.register_organization(:user_id, :name, CAST(:contact AS jsonb))",
        {"user_id": _user_id(session), "name": payload.name, "contact": json.dumps(contact)},
    )


@router.get("/organizations", dependencies=[access.SESSION])
async def list_organizations(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(db, "SELECT app.list_my_organizations(:user_id)", {"user_id": _user_id(session)})


@router.get("/organizations/{org_id}", dependencies=[access.SESSION])
async def get_organization(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.get_organization_portal(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )


@router.put("/organizations/{org_id}/contacts", dependencies=[access.SESSION])
async def update_contacts(
    org_id: UUID,
    payload: OrganizationContactsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.update_organization_contacts(:user_id, :org_id, :name, CAST(:public AS jsonb), CAST(:internal AS jsonb), :fulfilment)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "name": payload.name,
            "public": json.dumps(payload.public_contact.model_dump(exclude_none=True))
            if payload.public_contact
            else None,
            "internal": json.dumps(payload.internal_contact.model_dump(exclude_none=True))
            if payload.internal_contact
            else None,
            "fulfilment": payload.fulfilment_instructions,
        },
    )


@router.get("/organizations/{org_id}/notification-preferences", dependencies=[access.SESSION])
async def list_notification_preferences(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_role_notification_prefs(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )


@router.put("/organizations/{org_id}/notification-preferences", dependencies=[access.SESSION])
async def put_notification_preference(
    org_id: UUID,
    payload: RolePrefIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.put_role_notification_pref(:user_id, :org_id, :role, :event, :email, :in_app)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "role": payload.role,
            "event": payload.event_type,
            "email": payload.email_enabled,
            "in_app": payload.in_app_enabled,
        },
    )


@router.put("/organizations/{org_id}/escalation", dependencies=[access.SESSION])
async def put_escalation(
    org_id: UUID,
    payload: EscalationIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.put_escalation_settings(:user_id, :org_id, :first, :repeat, :max)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "first": payload.first_minutes,
            "repeat": payload.repeat_minutes,
            "max": payload.max,
        },
    )


@router.get("/organizations/{org_id}/onboarding", dependencies=[access.SESSION])
async def get_onboarding(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    await fetch_json(
        db,
        "SELECT app.get_organization_portal(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )
    return await fetch_json(db, "SELECT app.onboarding_checklist(:org_id)", {"org_id": str(org_id)})


@router.post("/organizations/{org_id}/verification", dependencies=[access.SESSION])
async def submit_verification(
    org_id: UUID,
    payload: VerificationSubmit,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.submit_verification(:user_id, :org_id, CAST(:details AS jsonb))",
        {"user_id": _user_id(session), "org_id": str(org_id), "details": payload.model_dump_json()},
    )


@router.get("/organizations/{org_id}/verification/documents", dependencies=[access.SESSION])
async def list_verification_documents(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_verification_documents(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )


@router.post("/organizations/{org_id}/files", dependencies=[access.SESSION])
async def upload_org_file(
    org_id: UUID,
    payload: FileUploadIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Listing images and verification documents (MSHWAR-112).

    Order matters: permission and per-organisation limits first, then content
    checks, and only then does anything get stored.
    """
    session = await _session(request, db)
    user_id = _user_id(session)
    if payload.purpose == "listing" and payload.experience_id is None:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="experience_id required")
    raw = validate_upload(payload.content_base64, payload.content_type, payload.purpose)
    await fetch_json(
        db,
        "SELECT app.check_upload_allowance(:user_id, :org_id, :purpose, :experience_id, :bytes, :quota, :max_images)",
        {
            "user_id": user_id,
            "org_id": str(org_id),
            "purpose": payload.purpose,
            "experience_id": str(payload.experience_id) if payload.experience_id else None,
            "bytes": len(raw),
            "quota": settings.upload_org_quota_bytes,
            "max_images": settings.max_images_per_experience,
        },
    )
    await enforce_rate_limit(request, "upload-org", subject=str(org_id))
    inspected = inspect_or_reject(raw, payload.content_type)
    if payload.purpose == "listing":
        return await _store_listing_image(db, user_id, org_id, payload, raw, inspected)
    return await _store_verification_document(db, user_id, org_id, payload, raw)


async def _store_listing_image(
    db: AsyncSession, user_id: str, org_id: UUID, payload: FileUploadIn, raw: bytes, inspected: Inspected
) -> dict[str, Any]:
    uploaded: UploadedImage | None = None
    stored: dict[str, str] | None = None
    if imagekit.enabled():
        try:
            uploaded = await imagekit.get_client().upload(
                raw,
                filename=f"{uuid4().hex}{_IMAGE_SUFFIX[payload.content_type]}",
                folder=f"/listings/{org_id}/{payload.experience_id}",
                content_type=payload.content_type,
            )
        except imagekit.ImageKitError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        # Stored without the leading slash: keys are relative to the ImageKit URL endpoint.
        provider, object_key, file_id = "imagekit", uploaded.file_path.lstrip("/"), uploaded.file_id
    else:
        stored = put_private_bytes(raw, payload.filename, payload.content_type, public=False)
        provider, object_key, file_id = "local", stored["object_key"], None
    try:
        media = await fetch_json(
            db,
            "SELECT app.attach_listing_image(:user_id, :org_id, :experience_id, :provider, :object_key, :file_id, "
            ":alt, :content_type, :bytes, :width, :height, :quota, :max_images)",
            {
                "user_id": user_id,
                "org_id": str(org_id),
                "experience_id": str(payload.experience_id),
                "provider": provider,
                "object_key": object_key,
                "file_id": file_id,
                "alt": payload.alt_text or payload.filename,
                "content_type": inspected.content_type,
                "bytes": len(raw),
                "width": inspected.width,
                "height": inspected.height,
                "quota": settings.upload_org_quota_bytes,
                "max_images": settings.max_images_per_experience,
            },
        )
    except Exception:
        if uploaded is not None:
            await imagekit.get_client().delete(uploaded.file_id)
        if stored is not None:
            delete_private_bytes(stored["object_key"])
        raise
    return {
        "object_key": object_key,
        "provider": provider,
        "backend": provider,
        "filename": payload.filename,
        "content_type": inspected.content_type,
        "width": inspected.width,
        "height": inspected.height,
        "media": media,
        "preview_url": media_url(provider, object_key),
        "public": False,
    }


async def _store_verification_document(
    db: AsyncSession, user_id: str, org_id: UUID, payload: FileUploadIn, raw: bytes
) -> dict[str, Any]:
    stored = put_private_bytes(raw, payload.filename, payload.content_type, public=False)
    try:
        document = await fetch_json(
            db,
            "SELECT app.attach_verification_document(:user_id, :org_id, :object_key, :filename, :content_type, :byte_size)",
            {
                "user_id": user_id,
                "org_id": str(org_id),
                "object_key": stored["object_key"],
                "filename": payload.filename,
                "content_type": payload.content_type,
                "byte_size": len(raw),
            },
        )
    except Exception:
        delete_private_bytes(stored["object_key"])
        raise
    signed = sign_object_url(stored["object_key"])
    return {**stored, "document": document, "signed": signed, "public": False}


_IMAGE_SUFFIX = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


@router.get("/files/{token}", dependencies=[access.TOKEN])
async def download_signed_file(token: str) -> Response:
    """Serve a private file to the holder of a short-lived signed link, never as active content."""
    try:
        object_key = verify_signed_token(token)
        data = read_private_bytes(object_key)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not available") from exc
    media_type = content_type_for(object_key)
    disposition = "inline" if media_type.startswith("image/") else "attachment"
    filename = object_key.rsplit("/", 1)[-1].split("-", 1)[-1]
    return Response(
        content=data,
        media_type=media_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
            "Cross-Origin-Resource-Policy": "same-origin",
        },
    )


@router.get("/organizations/{org_id}/staff", dependencies=[access.SESSION])
async def list_staff(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_staff(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )


@router.post(
    "/organizations/{org_id}/staff/invitations", status_code=status.HTTP_201_CREATED, dependencies=[access.SESSION]
)
async def invite_staff(
    org_id: UUID,
    payload: StaffInviteCreate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    token = new_session_token()
    expires = datetime.now(UTC) + timedelta(seconds=settings.staff_invite_ttl_seconds)
    row = await fetch_json(
        db,
        "SELECT app.invite_staff(:user_id, :org_id, :email, :role, :token_hash, :expires_at)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "email": payload.email.strip().lower(),
            "role": payload.role,
            "token_hash": hash_session_token(token),
            "expires_at": expires,
        },
    )
    await get_mailer().send(
        MailMessage(
            to=payload.email.strip().lower(),
            subject="Mshwar staff invitation",
            text_body=f"You were invited to join a Mshwar organisation. Use this link:\n{_invite_link(token)}",
            purpose="staff_invite",
            token=token,
        )
    )
    return row


@router.post("/organizations/{org_id}/staff/invitations/{invite_id}/revoke", dependencies=[access.SESSION])
async def revoke_invite(
    org_id: UUID,
    invite_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, bool]:
    session = await _session(request, db)
    ok = await fetch_json(
        db,
        "SELECT app.revoke_staff_invite(:user_id, :org_id, :invite_id)",
        {"user_id": _user_id(session), "org_id": str(org_id), "invite_id": str(invite_id)},
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="invitation not found")
    return {"ok": True}


@router.post("/invitations/accept", dependencies=[access.SESSION])
async def accept_invite(
    payload: StaffInviteAccept,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.accept_staff_invite(:user_id, :email, :token_hash)",
        {
            "user_id": _user_id(session),
            "email": session["email"],
            "token_hash": hash_session_token(payload.token),
        },
    )


@router.post("/organizations/{org_id}/venues", dependencies=[access.SESSION])
async def upsert_venue(
    org_id: UUID,
    payload: VenueUpsert,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    if not point_in_lebanon(payload.lng, payload.lat):
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="coordinates must fall inside Lebanon")
    return await fetch_json(
        db,
        "SELECT app.upsert_venue(:user_id, :org_id, :venue_id, :name, :address, :lng, :lat, :destination)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "venue_id": str(payload.id) if payload.id else None,
            "name": payload.name,
            "address": payload.address,
            "lng": payload.lng,
            "lat": payload.lat,
            "destination": payload.destination_slug,
        },
    )


@router.get("/organizations/{org_id}/experiences", dependencies=[access.SESSION])
async def list_experiences(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_experiences_portal(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )


@router.post("/organizations/{org_id}/experiences", dependencies=[access.SESSION])
async def upsert_experience(
    org_id: UUID,
    payload: ExperienceUpsert,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    body = await fetch_json(
        db,
        "SELECT app.upsert_experience(:user_id, :org_id, CAST(:payload AS jsonb))",
        {"user_id": _user_id(session), "org_id": str(org_id), "payload": payload.model_dump_json()},
    )
    if payload.weather_sensitivity:
        body = await fetch_json(
            db,
            "SELECT app.set_experience_weather_sensitivity(:user_id, :org_id, :experience_id, :value)",
            {
                "user_id": _user_id(session),
                "org_id": str(org_id),
                "experience_id": str(body["id"]) if isinstance(body, dict) else payload.id,
                "value": payload.weather_sensitivity,
            },
        )
    return body


@router.get("/organizations/{org_id}/experiences/{experience_id}", dependencies=[access.SESSION])
async def get_experience(
    org_id: UUID,
    experience_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.get_experience_portal(:user_id, :org_id, :experience_id)",
        {"user_id": _user_id(session), "org_id": str(org_id), "experience_id": str(experience_id)},
    )


@router.post("/organizations/{org_id}/experiences/{experience_id}/publish", dependencies=[access.SESSION])
async def publish_experience(
    org_id: UUID,
    experience_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.publish_experience(:user_id, :org_id, :experience_id)",
        {"user_id": _user_id(session), "org_id": str(org_id), "experience_id": str(experience_id)},
    )


@router.post("/organizations/{org_id}/experiences/{experience_id}/status", dependencies=[access.SESSION])
async def set_experience_status(
    org_id: UUID,
    experience_id: UUID,
    payload: ExperienceStatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.set_experience_status(:user_id, :org_id, :experience_id, :status)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "experience_id": str(experience_id),
            "status": payload.status,
        },
    )


@router.put("/organizations/{org_id}/opening-hours", dependencies=[access.SESSION])
async def replace_hours(
    org_id: UUID,
    payload: OpeningHoursReplace,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.replace_opening_hours(:user_id, :org_id, :venue_id, CAST(:hours AS jsonb), :source)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "venue_id": str(payload.venue_id),
            "hours": json.dumps([item.model_dump() for item in payload.hours]),
            "source": payload.source,
        },
    )


@router.post("/organizations/{org_id}/opening-exceptions", dependencies=[access.SESSION])
async def upsert_exception(
    org_id: UUID,
    payload: OpeningExceptionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.upsert_opening_exception(:user_id, :org_id, :venue_id, :local_date, :closed, :opens, :closes, :source)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "venue_id": str(payload.venue_id),
            "local_date": payload.local_date,
            "closed": payload.closed,
            "opens": payload.opens,
            "closes": payload.closes,
            "source": payload.source,
        },
    )


@router.post("/organizations/{org_id}/blackouts", dependencies=[access.SESSION])
async def create_blackout(
    org_id: UUID,
    payload: BlackoutIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.upsert_blackout(:user_id, :org_id, :experience_id, :start, :end, :reason, :source)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "experience_id": str(payload.experience_id),
            "start": payload.start,
            "end": payload.end,
            "reason": payload.reason,
            "source": payload.source,
        },
    )


@router.delete("/organizations/{org_id}/blackouts/{blackout_id}", dependencies=[access.SESSION])
async def remove_blackout(
    org_id: UUID,
    blackout_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, bool]:
    session = await _session(request, db)
    ok = await fetch_json(
        db,
        "SELECT app.delete_blackout(:user_id, :org_id, :blackout_id)",
        {"user_id": _user_id(session), "org_id": str(org_id), "blackout_id": str(blackout_id)},
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="blackout not found")
    return {"ok": True}


@router.post("/organizations/{org_id}/slots/generate", dependencies=[access.SESSION])
async def generate_slots(
    org_id: UUID,
    payload: SlotGenerateIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.generate_slots(:user_id, :org_id, :experience_id, :start_date, :end_date, :capacity, :source)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "experience_id": str(payload.experience_id),
            "start_date": payload.start_date,
            "end_date": payload.end_date,
            "capacity": payload.capacity,
            "source": payload.source,
        },
    )


@router.get("/organizations/{org_id}/experiences/{experience_id}/availability", dependencies=[access.SESSION])
async def list_availability(
    org_id: UUID,
    experience_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_availability(:user_id, :org_id, :experience_id)",
        {"user_id": _user_id(session), "org_id": str(org_id), "experience_id": str(experience_id)},
    )


@router.get("/organizations/{org_id}/bookings", dependencies=[access.SESSION])
async def list_bookings(
    org_id: UUID,
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    experience_id: UUID | None = Query(default=None),  # noqa: B008
    date_from: datetime | None = Query(default=None, alias="from"),  # noqa: B008
    date_to: datetime | None = Query(default=None, alias="to"),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_portal_bookings(:user_id, :org_id, :status, :experience_id, :date_from, :date_to)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "status": status_filter,
            "experience_id": str(experience_id) if experience_id else None,
            "date_from": date_from,
            "date_to": date_to,
        },
    )


@router.get("/organizations/{org_id}/bookings.csv", dependencies=[access.SESSION])
async def export_bookings_csv(
    org_id: UUID,
    request: Request,
    status_filter: str | None = Query(default=None, alias="status"),
    experience_id: UUID | None = Query(default=None),  # noqa: B008
    date_from: datetime | None = Query(default=None, alias="from"),  # noqa: B008
    date_to: datetime | None = Query(default=None, alias="to"),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> StreamingResponse:
    rows = await list_bookings(org_id, request, status_filter, experience_id, date_from, date_to, db)
    return StreamingResponse(
        iter([bookings_to_csv(rows or [])]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bookings.csv"},
    )


@router.post("/organizations/{org_id}/bookings/{booking_id}/respond", dependencies=[access.SESSION])
async def respond_booking(
    org_id: UUID,
    booking_id: UUID,
    payload: BookingRespondIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.respond_portal_booking(:user_id, :org_id, :booking_id, :status, :reason, :message)",
        {
            "user_id": _user_id(session),
            "org_id": str(org_id),
            "booking_id": str(booking_id),
            "status": payload.status,
            "reason": payload.reason,
            "message": payload.message,
        },
    )


@router.post("/organizations/{org_id}/bookings/{booking_id}/cancel", dependencies=[access.SESSION])
async def cancel_portal_booking(
    org_id: UUID,
    booking_id: UUID,
    payload: BookingRespondIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.cancel_checkout_booking(:user_id, :booking_id, :reason, true, :org_id)",
        {
            "user_id": _user_id(session),
            "booking_id": str(booking_id),
            "reason": payload.reason,
            "org_id": str(org_id),
        },
    )


@router.get("/organizations/{org_id}/metrics", dependencies=[access.SESSION])
async def get_metrics(
    org_id: UUID,
    request: Request,
    date_from: datetime | None = Query(default=None, alias="from"),  # noqa: B008
    date_to: datetime | None = Query(default=None, alias="to"),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    end = date_to or datetime.now(UTC)
    start = date_from or (end - timedelta(days=30))
    return await fetch_json(
        db,
        "SELECT app.aggregate_org_metrics(:user_id, :org_id, :date_from, :date_to)",
        {"user_id": _user_id(session), "org_id": str(org_id), "date_from": start, "date_to": end},
    )


@router.post("/organizations/{org_id}/metrics/events", dependencies=[access.SESSION])
async def capture_metric(
    org_id: UUID,
    payload: AnalyticsCaptureIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await _session(request, db)
    event_id = await fetch_json(
        db,
        "SELECT app.capture_org_event(:user_id, :org_id, :experience_id, :name, CAST(:properties AS jsonb), :dedupe)",
        {
            "name": payload.event_name,
            "org_id": str(org_id),
            "experience_id": str(payload.experience_id) if payload.experience_id else None,
            "user_id": _user_id(session),
            "properties": json.dumps(payload.properties),
            "dedupe": payload.dedupe_key,
        },
    )
    return {"id": event_id, "recorded": True}


@router.get("/organizations/{org_id}/metrics.csv", dependencies=[access.SESSION])
async def export_metrics_csv(
    org_id: UUID,
    request: Request,
    date_from: datetime | None = Query(default=None, alias="from"),  # noqa: B008
    date_to: datetime | None = Query(default=None, alias="to"),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> PlainTextResponse:
    metrics = await get_metrics(org_id, request, date_from, date_to, db)
    return PlainTextResponse(metrics_to_csv(metrics or {}), media_type="text/csv")


@router.get("/organizations/{org_id}/reviews", dependencies=[access.SESSION])
async def list_portal_reviews(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_portal_reviews(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )


@router.post("/organizations/{org_id}/reviews/{review_id}/responses", dependencies=[access.SESSION])
async def respond_to_review(
    org_id: UUID,
    review_id: UUID,
    payload: ReviewResponseIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    await fetch_json(
        db,
        "SELECT app.get_organization_portal(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )
    return await fetch_json(
        db,
        "SELECT app.respond_to_review(:user_id, :review_id, :body)",
        {"user_id": _user_id(session), "review_id": str(review_id), "body": payload.body},
    )


async def _forbid_review_mutation(org_id: UUID, review_id: UUID, request: Request, db: AsyncSession) -> Any:
    session = await _session(request, db)
    await fetch_json(
        db,
        "SELECT app.get_organization_portal(:user_id, :org_id)",
        {"user_id": _user_id(session), "org_id": str(org_id)},
    )
    return await fetch_json(
        db,
        "SELECT app.forbid_business_review_mutation(:user_id, :review_id)",
        {"user_id": _user_id(session), "review_id": str(review_id)},
    )


@router.post("/organizations/{org_id}/reviews/{review_id}/hide", dependencies=[access.SESSION])
async def hide_review_forbidden(
    org_id: UUID,
    review_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _forbid_review_mutation(org_id, review_id, request, db)


@router.delete("/organizations/{org_id}/reviews/{review_id}", dependencies=[access.SESSION])
async def delete_review_forbidden(
    org_id: UUID,
    review_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _forbid_review_mutation(org_id, review_id, request, db)


_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value: Any) -> Any:
    """Neutralise spreadsheet formulas in user-supplied text (CSV injection)."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def bookings_to_csv(rows: list[dict[str, Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "id",
            "status",
            "party_size",
            "experience_title",
            "starts_at",
            "capacity",
            "reserved",
            "remaining",
            "total_minor",
            "currency",
            "traveller_note",
        ],
    )
    writer.writeheader()
    for row in rows:
        writer.writerow({key: csv_safe(row.get(key, "")) for key in writer.fieldnames})
    return buffer.getvalue()


def metrics_to_csv(metrics: dict[str, Any]) -> str:
    current = metrics.get("current") or {}
    previous = metrics.get("previous") or {}
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["metric", "current", "previous", "from", "to", "comparison_from", "comparison_to"])
    for key in ("views", "saves", "itinerary_inclusions", "requests", "confirmations", "revenue_minor"):
        writer.writerow(
            [
                key,
                current.get(key, 0),
                previous.get(key, 0),
                metrics.get("from"),
                metrics.get("to"),
                metrics.get("comparison_from"),
                metrics.get("comparison_to"),
            ]
        )
    return buffer.getvalue()


def _invite_link(token: str) -> str:
    return f"{settings.public_web_origin}/business/team?invite={token}"
