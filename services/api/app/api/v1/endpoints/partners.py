"""Partner accounts: drivers and money changers.

A partner applies, uploads private documents, proves their phone and turns on
an authenticator app, accepts the partner agreement and sends the application.
Mshwar checks every document against its issuer, meets the partner on a video
call or in person, and decides. Trust is derived in the database: a lapsed
document takes the partner off every public list the day it lapses.

Every route hands the caller's id to a SECURITY DEFINER function, as elsewhere.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access, imagekit, totp
from app.core.auth_session import require_session
from app.core.config import settings
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.rate_limit import enforce_rate_limit, limit
from app.core.sms import SmsError, get_sms
from app.core.sql import fetch_json
from app.core.storage import delete_private_bytes, media_url, put_private_bytes
from app.core.uploads import inspect_or_reject, validate_upload
from app.dependencies import get_auth_db
from app.schemas.partners import (
    PHOTO_KINDS,
    AgreementIn,
    CodeIn,
    PartnerDocumentUploadIn,
    PartnerProfileIn,
    PhoneStartIn,
    VehicleIn,
)

router = APIRouter()

KINDS = ("driver", "changer")
_IMAGE_SUFFIX = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _kind(kind: str) -> str:
    if kind not in KINDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return kind


def present_partner(payload: Any) -> Any:
    """Swap stored photo keys for URLs a browser can load, at any depth. Keys never leave the API."""
    if isinstance(payload, list):
        return [present_partner(item) for item in payload]
    if isinstance(payload, dict):
        if "photo" in payload:
            photo = payload.pop("photo")
            payload["photo_url"] = (
                media_url(photo.get("provider"), photo.get("key")) if isinstance(photo, dict) else None
            )
        for key, value in payload.items():
            if isinstance(value, dict | list):
                payload[key] = present_partner(value)
    return payload


async def _session(request: Request, db: AsyncSession) -> dict[str, Any]:
    return await require_session(request, db)


# ---- Security: phone and authenticator ------------------------------------------------


@router.get("/security", dependencies=[access.SESSION])
async def security_status(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await _session(request, db)
    return await fetch_json(
        db, "SELECT app.partner_security_status(CAST(:uid AS uuid))", {"uid": str(session["user_id"])}
    )


@router.post("/security/phone", dependencies=[access.SESSION, limit("partner-security")])
async def start_phone_check(
    payload: PhoneStartIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Text a six-digit code to the partner's phone. Only its keyed hash is stored."""
    session = await _session(request, db)
    uid = str(session["user_id"])
    code = totp.new_phone_code()
    result = await fetch_json(
        db,
        "SELECT app.security_start_phone(CAST(:uid AS uuid), :phone, :hash)",
        {"uid": uid, "phone": payload.phone, "hash": totp.hash_phone_code(uid, code, settings.secret_key)},
    )
    try:
        await get_sms().send(payload.phone, f"Your Mshwar code is {code}. It expires in 10 minutes.", code=code)
    except SmsError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="We could not send the code") from exc
    return result


@router.post("/security/phone/confirm", dependencies=[access.SESSION, limit("partner-security")])
async def confirm_phone(
    payload: CodeIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    uid = str(session["user_id"])
    code = "".join(ch for ch in payload.code if ch.isdigit())
    result = await fetch_json(
        db,
        "SELECT app.security_confirm_phone(CAST(:uid AS uuid), :hash)",
        {"uid": uid, "hash": totp.hash_phone_code(uid, code, settings.secret_key)},
    )
    if isinstance(result, dict) and result.get("ok") is False:
        # The failed attempt is already counted; the transaction commits it.
        await db.commit()
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="That code is not right")
    return result


@router.post("/security/totp", dependencies=[access.SESSION, limit("partner-security")])
async def begin_totp(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """A new secret to scan. It only counts once a code from it is confirmed."""
    session = await _session(request, db)
    uid = str(session["user_id"])
    secret = totp.new_secret()
    await fetch_json(db, "SELECT app.security_totp_begin(CAST(:uid AS uuid), :secret)", {"uid": uid, "secret": secret})
    account = str(session.get("email") or session.get("display_name") or uid)
    return {"secret": secret, "otpauth_uri": totp.provisioning_uri(secret, account)}


async def _totp_step(db: AsyncSession, uid: str, code: str, *, pending: bool) -> int:
    secret = await fetch_json(
        db, "SELECT to_jsonb(app.security_totp_secret(CAST(:uid AS uuid), :pending))", {"uid": uid, "pending": pending}
    )
    step = totp.matching_step(secret, code) if isinstance(secret, str) else None
    if step is None:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="That code is not right")
    return step


@router.post("/security/totp/confirm", dependencies=[access.SESSION, limit("partner-security")])
async def confirm_totp(
    payload: CodeIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    uid = str(session["user_id"])
    step = await _totp_step(db, uid, payload.code, pending=True)
    return await fetch_json(
        db, "SELECT app.security_totp_confirm(CAST(:uid AS uuid), :step)", {"uid": uid, "step": step}
    )


@router.post("/security/step-up", dependencies=[access.SESSION, limit("partner-security")])
async def step_up(
    payload: CodeIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Confirm it's you for 15 minutes before changing a plate, an address or rates."""
    session = await _session(request, db)
    uid = str(session["user_id"])
    step = await _totp_step(db, uid, payload.code, pending=False)
    return await fetch_json(
        db,
        "SELECT app.security_step_up(CAST(:uid AS uuid), CAST(:sid AS uuid), :step)",
        {"uid": uid, "sid": str(session["session_id"]), "step": step},
    )


# ---- The application ----------------------------------------------------------------------


@router.get("/public/{slug}", dependencies=[access.PUBLIC, limit("search")])
async def public_partner(slug: str, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """A live partner's public page. Hidden the moment a document lapses."""
    payload = await fetch_json(
        db,
        "SELECT app.public_partner_page(:slug)",
        {"slug": slug},
    )
    if not payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return present_partner(payload)


@router.get("/me/{kind}", dependencies=[access.SESSION])
async def my_partner(kind: str, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await _session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.get_my_partner(CAST(:uid AS uuid), :kind)",
            {"uid": str(session["user_id"]), "kind": _kind(kind)},
        )
    )


@router.put("/me/{kind}", dependencies=[access.SESSION, limit("partner-write")])
async def upsert_partner(
    kind: str,
    payload: PartnerProfileIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.partner_upsert_profile(CAST(:uid AS uuid), :kind, CAST(:body AS jsonb))",
            {"uid": str(session["user_id"]), "kind": _kind(kind), "body": payload.model_dump_json()},
        )
    )


@router.put("/me/driver/vehicles", dependencies=[access.SESSION, limit("partner-write")])
async def upsert_vehicle(
    payload: VehicleIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Add or change a vehicle. On a live account this needs a fresh authenticator code."""
    session = await _session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.partner_upsert_vehicle(CAST(:uid AS uuid), CAST(:sid AS uuid), CAST(:body AS jsonb))",
            {"uid": str(session["user_id"]), "sid": str(session["session_id"]), "body": payload.model_dump_json()},
        )
    )


@router.post("/me/{kind}/documents", dependencies=[access.SESSION, limit("partner-write")])
async def upload_partner_document(
    kind: str,
    payload: PartnerDocumentUploadIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Upload one document. Files go to private storage; replacing one sends it back for review."""
    session = await _session(request, db)
    uid = str(session["user_id"])
    purpose = "listing" if payload.kind in PHOTO_KINDS else "verification"
    raw = validate_upload(payload.content_base64, payload.content_type, purpose)
    await enforce_rate_limit(request, "upload-org", subject=f"partner:{uid}")
    inspect_or_reject(raw, payload.content_type)
    provider, key, uploaded_id = "local", "", None
    stored: dict[str, str] | None = None
    if payload.kind == "profile_photo" and imagekit.enabled():
        # The face travellers are shown lives on the image CDN, like listing photos.
        try:
            uploaded = await imagekit.get_client().upload(
                raw,
                filename=f"{uuid4().hex}{_IMAGE_SUFFIX.get(payload.content_type, '.jpg')}",
                folder="/partners",
                content_type=payload.content_type,
            )
        except imagekit.ImageKitError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
        provider, key, uploaded_id = "imagekit", uploaded.file_path.lstrip("/"), uploaded.file_id
    else:
        stored = put_private_bytes(raw, payload.filename, payload.content_type)
        key = stored["object_key"]
    body = {
        "kind": payload.kind,
        "document_key": key,
        "provider": provider,
        "vehicle_id": payload.vehicle_id,
        "office_id": payload.office_id,
        "reference": payload.reference,
        "issuer": payload.issuer,
        "issued_on": payload.issued_on.isoformat() if payload.issued_on else None,
        "expires_on": payload.expires_on.isoformat() if payload.expires_on else None,
    }
    try:
        return present_partner(
            await fetch_json(
                db,
                "SELECT app.partner_put_document(CAST(:uid AS uuid), :kind, CAST(:body AS jsonb))",
                {"uid": uid, "kind": _kind(kind), "body": json.dumps(body)},
            )
        )
    except Exception:
        if stored is not None:
            delete_private_bytes(stored["object_key"])
        if uploaded_id is not None:
            await imagekit.get_client().delete(uploaded_id)
        raise


@router.put("/me/{kind}/agreement", dependencies=[access.SESSION, limit("partner-write")])
async def accept_agreement(
    kind: str,
    payload: AgreementIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.partner_accept_agreement(CAST(:uid AS uuid), :kind, :version)",
            {"uid": str(session["user_id"]), "kind": _kind(kind), "version": payload.version},
        )
    )


@router.post("/me/{kind}/submit", dependencies=[access.SESSION, limit("partner-write")])
async def submit_application(kind: str, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Refused until documents, agreement, phone and authenticator are all in place."""
    session = await _session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.partner_submit(CAST(:uid AS uuid), :kind)",
            {"uid": str(session["user_id"]), "kind": _kind(kind)},
        )
    )


# ---- The daily sweep ------------------------------------------------------------------


@router.post("/ops/sweep", dependencies=[access.JOB])
async def trust_sweep(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Expiry warnings (30 and 7 days), lapses, stale transport cards and venue checks. Run daily."""
    return await fetch_json(db, "SELECT app.trust_sweep()", {})
