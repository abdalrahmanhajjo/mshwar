"""The verification queue for drivers and money changers (V1), and later phases.

Reviewers open each document through a short-lived signed link, record the
video call or visit, and decide. Every step lands in app.trust_events.
"""

from __future__ import annotations

import json
import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.partners import present_partner
from app.core import access
from app.core.admin_auth import require_admin
from app.core.sql import fetch_json
from app.core.storage import media_url, sign_object_url
from app.dependencies import get_auth_db
from app.schemas.partners import (
    CheckedVenueIn,
    ClaimDecisionIn,
    OfficeCheckIn,
    PartnerCheckIn,
    PartnerDecisionIn,
    PartnerDocumentDecisionIn,
    PlaceTypesIn,
    RateDecisionIn,
    RegisterLoadIn,
    TransportDecisionIn,
    TransportRouteIn,
    VenueCheckIn,
)

router = APIRouter()

_LOCAL_KEY = re.compile(r"\d{4}/\d{2}/[0-9a-f]{32}-[\w.-]+")


async def _admin_id(request: Request, db: AsyncSession) -> str:
    session = await require_admin(request, db)
    return str(session["user_id"])


def _with_links(case: Any) -> Any:
    """Short-lived links for each document; the storage keys themselves are dropped."""
    if isinstance(case, dict):
        links: dict[str, str | None] = {}
        for doc_id, ref in (case.pop("document_keys", None) or {}).items():
            provider, key = (ref or {}).get("provider"), (ref or {}).get("key")
            if provider == "local" and isinstance(key, str) and _LOCAL_KEY.fullmatch(key):
                links[doc_id] = sign_object_url(key, ttl_seconds=900)["url"]
            else:
                links[doc_id] = media_url(provider, key)
        case["document_links"] = links
    return present_partner(case)


@router.get("/partners", dependencies=[access.ADMIN])
async def list_partners(
    request: Request,
    kind: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Drivers and changers waiting, oldest submission first, with hours waited."""
    admin = await _admin_id(request, db)
    filt = {key: value for key, value in (("kind", kind), ("status", status_filter)) if value}
    return await fetch_json(
        db,
        "SELECT app.admin_list_partners(CAST(:admin AS uuid), CAST(:filt AS jsonb))",
        {"admin": admin, "filt": json.dumps(filt)},
    )


@router.get("/partners/recheck-sample", dependencies=[access.ADMIN])
async def recheck_sample(
    request: Request,
    kind: str = Query(pattern="^(driver|changer)$"),
    percent: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """This month's re-check list: the partners longest since a person last saw them."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_recheck_sample(CAST(:admin AS uuid), :kind, :pct)",
        {"admin": admin, "kind": kind, "pct": percent},
    )


@router.get("/partners/{partner_id}", dependencies=[access.ADMIN])
async def partner_case(
    partner_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return _with_links(
        await fetch_json(
            db,
            "SELECT app.admin_get_partner_case(CAST(:admin AS uuid), CAST(:id AS uuid))",
            {"admin": admin, "id": str(partner_id)},
        )
    )


@router.post("/partners/documents/{document_id}", dependencies=[access.ADMIN])
async def review_partner_document(
    document_id: UUID,
    payload: PartnerDocumentDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return _with_links(
        await fetch_json(
            db,
            "SELECT app.admin_review_partner_document(CAST(:admin AS uuid), CAST(:id AS uuid), :decision, :reason)",
            {"admin": admin, "id": str(document_id), "decision": payload.decision, "reason": payload.reason},
        )
    )


@router.post("/partners/{partner_id}/checks", dependencies=[access.ADMIN])
async def record_partner_check(
    partner_id: UUID,
    payload: PartnerCheckIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """A video call, a visit or a re-check, in the reviewer's own words."""
    admin = await _admin_id(request, db)
    return _with_links(
        await fetch_json(
            db,
            "SELECT app.admin_record_partner_check(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
            {"admin": admin, "id": str(partner_id), "body": payload.model_dump_json()},
        )
    )


@router.post("/partners/{partner_id}", dependencies=[access.ADMIN])
async def decide_partner(
    partner_id: UUID,
    payload: PartnerDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Approve (every document verified and a person has met them), reject or suspend."""
    admin = await _admin_id(request, db)
    return _with_links(
        await fetch_json(
            db,
            "SELECT app.admin_decide_partner(CAST(:admin AS uuid), CAST(:id AS uuid), :decision, :reason)",
            {"admin": admin, "id": str(partner_id), "decision": payload.decision, "reason": payload.reason},
        )
    )


# ---- V2: transport cards --------------------------------------------------------------


@router.get("/transport", dependencies=[access.ADMIN])
async def list_transport(
    request: Request,
    status_filter: str | None = Query(default="submitted", alias="status"),
    destination: str | None = None,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Cards waiting (new, flagged or past their review date) first."""
    admin = await _admin_id(request, db)
    filt = {"status": None if status_filter == "all" else status_filter, "destination": destination}
    return await fetch_json(
        db,
        "SELECT app.admin_list_transport(CAST(:admin AS uuid), CAST(:filt AS jsonb))",
        {"admin": admin, "filt": json.dumps({k: v for k, v in filt.items() if v})},
    )


@router.post("/transport", dependencies=[access.ADMIN])
async def create_transport(
    payload: TransportRouteIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_upsert_transport(CAST(:admin AS uuid), NULL, CAST(:body AS jsonb))",
        {"admin": admin, "body": payload.model_dump_json()},
    )


@router.put("/transport/{route_id}", dependencies=[access.ADMIN])
async def edit_transport(
    route_id: UUID,
    payload: TransportRouteIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Editing a published card sends it back through a decision."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_upsert_transport(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(route_id), "body": payload.model_dump_json()},
    )


@router.post("/transport/{route_id}/decision", dependencies=[access.ADMIN])
async def decide_transport(
    route_id: UUID,
    payload: TransportDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Publish with the field check (review date = check + 90 days), reject or retire."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_decide_transport(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(route_id), "body": payload.model_dump_json()},
    )


# ---- V4: money changers -----------------------------------------------------------------


@router.get("/exchange", dependencies=[access.ADMIN])
async def exchange_status(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """The BDL list in use, whether it is overdue, held rates and every licence's standing."""
    admin = await _admin_id(request, db)
    return await fetch_json(db, "SELECT app.admin_register_status(CAST(:admin AS uuid))", {"admin": admin})


@router.post("/exchange/register", dependencies=[access.ADMIN])
async def load_register(
    payload: RegisterLoadIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Load this month's BDL list and diff every changer against it. Missing ones hide at once."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_load_bdl_register(CAST(:admin AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "body": payload.model_dump_json()},
    )


@router.post("/exchange/offices/{office_id}/verify", dependencies=[access.ADMIN])
async def verify_office(
    office_id: UUID,
    payload: OfficeCheckIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.admin_verify_office(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
            {"admin": admin, "id": str(office_id), "body": payload.model_dump_json()},
        )
    )


@router.post("/exchange/rates/{rate_id}", dependencies=[access.ADMIN])
async def decide_rate(
    rate_id: UUID,
    payload: RateDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_decide_rate(CAST(:admin AS uuid), CAST(:id AS uuid), :decision)",
        {"admin": admin, "id": str(rate_id), "decision": payload.decision},
    )


@router.post("/exchange/reports/{case_id}/uphold", dependencies=[access.ADMIN])
async def uphold_report(case_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Two upheld 'rate was different' reports in 30 days pause rate posting for 30 days."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_uphold_exchange_report(CAST(:admin AS uuid), CAST(:id AS uuid))",
        {"admin": admin, "id": str(case_id)},
    )


# ---- V5/V6: restaurants and stays ---------------------------------------------------------


@router.get("/venues", dependencies=[access.ADMIN])
async def list_venues(
    request: Request,
    destination: str | None = None,
    kind: str | None = Query(default=None, pattern="^(restaurant|hotel)$"),
    due: bool = False,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Restaurants and stays with their checks, soonest review first, plus pending claims."""
    admin = await _admin_id(request, db)
    filt = {"destination": destination, "kind": kind, "due": due}
    return await fetch_json(
        db,
        "SELECT app.admin_list_venues(CAST(:admin AS uuid), CAST(:filt AS jsonb))",
        {"admin": admin, "filt": json.dumps({k: v for k, v in filt.items() if v})},
    )


@router.post("/venues", dependencies=[access.ADMIN])
async def add_checked_venue(
    payload: CheckedVenueIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Add a place our team visited. It shows as "Visited by Mshwar" until an owner claims it."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_add_checked_venue(CAST(:admin AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "body": payload.model_dump_json()},
    )


@router.post("/venues/{experience_id}/check", dependencies=[access.ADMIN])
async def check_venue(
    experience_id: UUID,
    payload: VenueCheckIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_check_venue(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(experience_id), "body": payload.model_dump_json()},
    )


@router.post("/venues/claims/{claim_id}", dependencies=[access.ADMIN])
async def decide_claim(
    claim_id: UUID,
    payload: ClaimDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_decide_claim(CAST(:admin AS uuid), CAST(:id AS uuid), :decision, :reason)",
        {"admin": admin, "id": str(claim_id), "decision": payload.decision, "reason": payload.reason},
    )


@router.get("/coverage", dependencies=[access.ADMIN])
async def coverage(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Per destination: checked restaurants and stays against 5 and 3, transport cards, drivers, changers."""
    admin = await _admin_id(request, db)
    return await fetch_json(db, "SELECT app.admin_venue_coverage(CAST(:admin AS uuid))", {"admin": admin})


@router.put("/place-types/listings/{experience_id}", dependencies=[access.ADMIN])
async def set_place_types(
    experience_id: UUID,
    payload: PlaceTypesIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Staff set what kinds of place a listing is; a meal or a night must still be a checked venue."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_set_place_types(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(experience_id), "body": payload.model_dump_json(exclude_none=True)},
    )


@router.get("/place-types/coverage", dependencies=[access.ADMIN])
async def place_type_coverage(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Per destination: how many places the planner may use, by kind, and how many have no kind yet."""
    admin = await _admin_id(request, db)
    return await fetch_json(db, "SELECT app.admin_place_type_coverage(CAST(:admin AS uuid))", {"admin": admin})
