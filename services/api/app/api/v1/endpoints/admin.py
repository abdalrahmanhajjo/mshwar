from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_auth import require_admin
from app.core.data_quality import run_checks, scheduler_status
from app.core.portal_auth import fetch_json
from app.core.search_reindex import reindex_provider
from app.core.storage import sign_object_url
from app.dependencies import get_auth_db
from app.schemas.admin import (
    AdminGrantIn,
    AdminRevokeIn,
    BulkModerationIn,
    ConfigPutIn,
    FlagPutIn,
    ModerationIn,
    ReasonIn,
    SupportAssignIn,
    SupportCaseCreateIn,
    SupportNoteIn,
    SupportResolveIn,
    TaxonomyCreateIn,
    TaxonomyMergeIn,
    TaxonomyRenameIn,
)
from app.schemas.planner import ThresholdIn
from app.schemas.portal import AdminVerificationAction


class WeatherSensitivityIn(BaseModel):
    weather_sensitivity: str = Field(min_length=5, max_length=32)
    organization_id: UUID


router = APIRouter()


class AdminUserOut(BaseModel):
    id: UUID
    email: str | None = None
    display_name: str
    locale: str
    status: str
    email_verified: bool
    email_verified_at: datetime | None = None


async def _admin(request: Request, db: AsyncSession, *, elevated: bool = False) -> dict[str, Any]:
    return await require_admin(request, db, elevated=elevated)


def _uid(session: dict[str, Any]) -> str:
    return str(session["user_id"])


@router.get("/me")
async def admin_me(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return {
        "id": session["user_id"],
        "email": session.get("email"),
        "display_name": session.get("display_name"),
        "tier": session.get("admin_tier"),
        "elevated": session.get("admin_tier") == "elevated",
    }


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[AdminUserOut]:
    await _admin(request, db)
    rows = (
        await db.execute(
            text(
                "SELECT user_id, email, display_name, locale, status, email_verified_at "
                "FROM app.list_user_verification_states()"
            )
        )
    ).all()
    return [
        AdminUserOut(
            id=row[0],
            email=row[1],
            display_name=row[2],
            locale=row[3],
            status=row[4],
            email_verified=row[5] is not None,
            email_verified_at=row[5],
        )
        for row in rows
    ]


@router.get("/roles")
async def list_roles(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_platform_admins(:admin_id)",
        {"admin_id": _uid(session)},
    )


@router.post("/roles")
async def grant_role(
    payload: AdminGrantIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db, elevated=True)
    return await fetch_json(
        db,
        "SELECT app.admin_grant_role(:actor, :user_id, :tier)",
        {"actor": _uid(session), "user_id": str(payload.user_id), "tier": payload.tier},
    )


@router.post("/roles/{user_id}/revoke")
async def revoke_role(
    user_id: UUID,
    payload: AdminRevokeIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db, elevated=True)
    return await fetch_json(
        db,
        "SELECT app.admin_revoke_role(:actor, :user_id, :reason)",
        {"actor": _uid(session), "user_id": str(user_id), "reason": payload.reason},
    )


@router.get("/sessions")
async def list_sessions(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_admin_sessions(:admin_id)",
        {"admin_id": _uid(session)},
    )


@router.get("/organizations")
async def list_organizations(
    request: Request,
    verification: str | None = None,
    sla_hours_min: int | None = Query(default=None, ge=0),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    filt: dict[str, Any] = {}
    if verification:
        filt["verification"] = verification
    if sla_hours_min is not None:
        filt["sla_hours_min"] = sla_hours_min
    return await fetch_json(
        db,
        "SELECT app.list_verification_queue(:admin_id, CAST(:filt AS jsonb))",
        {"admin_id": _uid(session), "filt": json.dumps(filt)},
    )


@router.get("/organizations/{org_id}")
async def get_organization(
    org_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    payload = await fetch_json(
        db,
        "SELECT app.get_verification_case(:admin_id, :org_id)",
        {"admin_id": _uid(session), "org_id": str(org_id)},
    )
    if isinstance(payload, dict):
        for doc in payload.get("documents") or []:
            key = doc.get("object_key")
            if key:
                signed = sign_object_url(key)
                doc["signed_url"] = signed.get("url")
                doc["signed_expires_at"] = signed.get("expires_at")
    return payload


@router.post("/organizations/{org_id}/verify")
async def verify_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "verified", payload.reason)


@router.post("/organizations/{org_id}/reject")
async def reject_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "rejected", payload.reason)


@router.post("/organizations/{org_id}/revoke")
async def revoke_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "revoked", payload.reason)


@router.post("/organizations/{org_id}/suspend")
async def suspend_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "suspended", payload.reason)


@router.post("/organizations/{org_id}/re-verify")
async def reverify_organization(
    org_id: UUID,
    payload: AdminVerificationAction,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await _transition(request, db, org_id, "re_verified", payload.reason)


async def _transition(
    request: Request,
    db: AsyncSession,
    org_id: UUID,
    decision: str,
    reason: str,
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_transition_verification(:admin_id, :org_id, :decision, :reason)",
        {
            "admin_id": _uid(session),
            "org_id": str(org_id),
            "decision": decision,
            "reason": reason,
        },
    )


@router.get("/moderation")
async def moderation_queue(
    request: Request,
    entity_type: str | None = None,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_moderation_queue(:admin_id, :entity_type)",
        {"admin_id": _uid(session), "entity_type": entity_type},
    )


@router.post("/moderation/{entity_type}/{entity_id}")
async def moderate(
    entity_type: str,
    entity_id: UUID,
    payload: ModerationIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.moderate_content(:admin_id, :entity_type, :entity_id, :action, :reason)",
        {
            "admin_id": _uid(session),
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "action": payload.action,
            "reason": payload.reason,
        },
    )


@router.post("/moderation/bulk")
async def bulk_moderate(
    payload: BulkModerationIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.bulk_moderate(:admin_id, :entity_type, string_to_array(:ids, ',')::uuid[], :action, :reason, :confirm)",
        {
            "admin_id": _uid(session),
            "entity_type": payload.entity_type,
            "ids": ",".join(str(item) for item in payload.ids),
            "action": payload.action,
            "reason": payload.reason,
            "confirm": payload.confirm,
        },
    )


@router.get("/moderation/events")
async def moderation_events(
    request: Request,
    entity_id: UUID | None = None,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_moderation_events(:admin_id, :entity_id)",
        {"admin_id": _uid(session), "entity_id": str(entity_id) if entity_id else None},
    )


@router.get("/taxonomy")
async def taxonomy_list(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(db, "SELECT app.list_taxonomy_admin(:admin_id)", {"admin_id": _uid(session)})


@router.post("/taxonomy")
async def taxonomy_create(
    payload: TaxonomyCreateIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    result = await fetch_json(
        db,
        "SELECT app.taxonomy_create(:admin_id, :kind, :slug, :label, :reason)",
        {
            "admin_id": _uid(session),
            "kind": payload.kind,
            "slug": payload.slug,
            "label": payload.label,
            "reason": payload.reason,
        },
    )
    if isinstance(result, dict):
        result["reindex"] = {"provider": reindex_provider(), "status": "queued"}
    return result


@router.post("/taxonomy/{term_id}/rename")
async def taxonomy_rename(
    term_id: UUID,
    payload: TaxonomyRenameIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.taxonomy_rename(:admin_id, :term_id, :label, :reason)",
        {
            "admin_id": _uid(session),
            "term_id": str(term_id),
            "label": payload.label,
            "reason": payload.reason,
        },
    )


@router.post("/taxonomy/{term_id}/retire")
async def taxonomy_retire(
    term_id: UUID,
    payload: ReasonIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.taxonomy_retire(:admin_id, :term_id, :reason)",
        {"admin_id": _uid(session), "term_id": str(term_id), "reason": payload.reason},
    )


@router.post("/taxonomy/{term_id}/merge")
async def taxonomy_merge(
    term_id: UUID,
    payload: TaxonomyMergeIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.taxonomy_merge(:admin_id, :source, :target, :reason)",
        {
            "admin_id": _uid(session),
            "source": str(term_id),
            "target": str(payload.target_id),
            "reason": payload.reason,
        },
    )


@router.get("/bookings")
async def list_bookings(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(db, "SELECT app.list_admin_bookings(:admin_id)", {"admin_id": _uid(session)})


@router.get("/bookings/{booking_id}")
async def inspect_booking(
    booking_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    payload = await fetch_json(
        db,
        "SELECT app.inspect_booking(:admin_id, :booking_id)",
        {"admin_id": _uid(session), "booking_id": str(booking_id)},
    )
    if isinstance(payload, dict):
        dumped = str(payload)
        if "sk_" in dumped:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="refusing secret leakage")
    return payload


@router.post("/bookings/{booking_id}/force-cancel")
async def force_cancel(
    booking_id: UUID,
    payload: ReasonIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db, elevated=True)
    return await fetch_json(
        db,
        "SELECT app.admin_force_cancel(:admin_id, :booking_id, :reason)",
        {"admin_id": _uid(session), "booking_id": str(booking_id), "reason": payload.reason},
    )


@router.post("/bookings/{booking_id}/mark-refunded")
async def mark_refunded(
    booking_id: UUID,
    payload: ReasonIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db, elevated=True)
    return await fetch_json(
        db,
        "SELECT app.admin_mark_refunded(:admin_id, :booking_id, :reason)",
        {"admin_id": _uid(session), "booking_id": str(booking_id), "reason": payload.reason},
    )


@router.post("/bookings/{booking_id}/resend-confirmation")
async def resend_confirmation(
    booking_id: UUID,
    payload: ReasonIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db, elevated=True)
    return await fetch_json(
        db,
        "SELECT app.admin_resend_confirmation(:admin_id, :booking_id, :reason)",
        {"admin_id": _uid(session), "booking_id": str(booking_id), "reason": payload.reason},
    )


@router.get("/config")
async def list_config(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(db, "SELECT app.list_configuration(:admin_id)", {"admin_id": _uid(session)})


@router.put("/config")
async def put_config(
    payload: ConfigPutIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.put_configuration(:admin_id, :key, CAST(:value AS jsonb), :reason)",
        {
            "admin_id": _uid(session),
            "key": payload.key,
            "value": json.dumps(payload.value),
            "reason": payload.reason,
        },
    )


@router.post("/config/{key}/rollback")
async def rollback_config(
    key: str,
    payload: ReasonIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.rollback_configuration(:admin_id, :key, :reason)",
        {"admin_id": _uid(session), "key": key, "reason": payload.reason},
    )


@router.get("/flags")
async def list_flags(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(db, "SELECT app.list_feature_flags(:admin_id)", {"admin_id": _uid(session)})


@router.put("/flags")
async def put_flag(
    payload: FlagPutIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.put_feature_flag(:admin_id, :key, :environment, :cohort, :enabled, CAST(:payload AS jsonb), :reason)",
        {
            "admin_id": _uid(session),
            "key": payload.key,
            "environment": payload.environment,
            "cohort": payload.cohort,
            "enabled": payload.enabled,
            "payload": json.dumps(payload.payload),
            "reason": payload.reason,
        },
    )


@router.get("/kpis")
async def kpis(
    request: Request,
    date_from: datetime | None = Query(default=None, alias="from"),  # noqa: B008
    date_to: datetime | None = Query(default=None, alias="to"),  # noqa: B008
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_kpis(:admin_id, :from_ts, :to_ts)",
        {"admin_id": _uid(session), "from_ts": date_from, "to_ts": date_to},
    )


@router.get("/cases")
async def list_cases(
    request: Request,
    case_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.list_support_cases(:admin_id, :status)",
        {"admin_id": _uid(session), "status": case_status},
    )


@router.post("/cases")
async def create_case(
    payload: SupportCaseCreateIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.create_support_case(:admin_id, :reason, :booking_id, :experience_id, :review_id, CAST(:evidence AS jsonb))",
        {
            "admin_id": _uid(session),
            "reason": payload.reason,
            "booking_id": str(payload.booking_id) if payload.booking_id else None,
            "experience_id": str(payload.experience_id) if payload.experience_id else None,
            "review_id": str(payload.review_id) if payload.review_id else None,
            "evidence": json.dumps(payload.evidence),
        },
    )


@router.post("/cases/{case_id}/assign")
async def assign_case(
    case_id: UUID,
    payload: SupportAssignIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.assign_support_case(:admin_id, :case_id, :assignee, :note)",
        {
            "admin_id": _uid(session),
            "case_id": str(case_id),
            "assignee": str(payload.assignee_id),
            "note": payload.note,
        },
    )


@router.post("/cases/{case_id}/escalate")
async def escalate_case(
    case_id: UUID,
    payload: SupportNoteIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.escalate_support_case(:admin_id, :case_id, :note)",
        {"admin_id": _uid(session), "case_id": str(case_id), "note": payload.note},
    )


@router.post("/cases/{case_id}/resolve")
async def resolve_case(
    case_id: UUID,
    payload: SupportResolveIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.resolve_support_case(:admin_id, :case_id, :outcome)",
        {"admin_id": _uid(session), "case_id": str(case_id), "outcome": payload.outcome},
    )


@router.get("/quality")
async def list_quality(
    request: Request,
    issue_status: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return {
        "issues": await fetch_json(
            db,
            "SELECT app.list_data_quality_issues(:admin_id, :status)",
            {"admin_id": _uid(session), "status": issue_status},
        ),
        "scheduler": scheduler_status(),
    }


@router.post("/quality/run")
async def run_quality(
    request: Request,
    notify: bool = True,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await run_checks(db, _uid(session), notify=notify)


@router.get("/payments/reconciliation")
async def list_reconciliation(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(db, "SELECT app.list_reconciliation_queue(:admin_id)", {"admin_id": _uid(session)})


@router.post("/payments/reconcile")
async def run_reconciliation(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.reconcile_payments(:admin_id, 100)",
        {"admin_id": _uid(session)},
    )


@router.post("/quality/{issue_id}/notify")
async def notify_quality(
    issue_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.notify_data_quality_issue(:admin_id, :issue_id)",
        {"admin_id": _uid(session), "issue_id": str(issue_id)},
    )


@router.get("/weather-thresholds")
async def admin_weather_thresholds(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    await _admin(request, db)
    return await fetch_json(db, "SELECT app.list_weather_thresholds()", {})


@router.put("/weather-thresholds")
async def admin_update_weather_threshold(
    payload: ThresholdIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.upsert_weather_threshold(:admin_id, :key, :value)",
        {"admin_id": _uid(session), "key": payload.key, "value": payload.value_numeric},
    )


@router.post("/experiences/{experience_id}/weather-sensitivity")
async def admin_set_weather_sensitivity(
    experience_id: UUID,
    payload: WeatherSensitivityIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await _admin(request, db)
    return await fetch_json(
        db,
        "SELECT app.set_experience_weather_sensitivity(:user_id, :org_id, :experience_id, :value)",
        {
            "user_id": _uid(session),
            "org_id": str(payload.organization_id),
            "experience_id": str(experience_id),
            "value": payload.weather_sensitivity,
        },
    )
