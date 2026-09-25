"""The verification queue for drivers and money changers (V1), and later phases.

Reviewers open each document through a short-lived signed link, record the
video call or visit, and decide. Every step lands in app.trust_events.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.partners import present_partner
from app.core import access
from app.core.admin_auth import require_admin
from app.core.http_status import HTTP_422_UNPROCESSABLE
from app.core.sql import fetch_json
from app.core.storage import media_url, sign_object_url
from app.dependencies import get_auth_db
from app.planner.schemas import CandidateReviewIn, IntentPhraseIn, MissDecisionIn, ReleaseIn, SourcedPriceIn
from app.planner.script.learning import CONCEPT_SLUGS, concept_catalogue, refresh_phrases, reset_phrases
from app.planner.script.release import measure
from app.schemas.partners import (
    CheckedVenueIn,
    ClaimDecisionIn,
    LeadDecisionIn,
    LeadPublishIn,
    LeadsImportIn,
    OfficeCheckIn,
    PartnerCheckIn,
    PartnerDecisionIn,
    PartnerDocumentDecisionIn,
    PlaceFactsIn,
    PlaceTypesIn,
    RateDecisionIn,
    RegisterLoadIn,
    TransportDecisionIn,
    TransportRouteIn,
    VenueCheckIn,
)
from app.seed.field_sheet import field_sheet_csv

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


@router.put("/prices/listings/{experience_id}", dependencies=[access.ADMIN])
async def set_sourced_price(
    experience_id: UUID,
    payload: SourcedPriceIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Record a price the place or an authority published, with the link and the day it was checked."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_set_sourced_price(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(experience_id), "body": payload.model_dump_json(exclude_none=True)},
    )


@router.get("/prices/due", dependencies=[access.ADMIN])
async def sourced_prices_due(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Sourced prices to check again: lapsing within ``days``, or lapsed in the last 30."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db, "SELECT app.admin_sourced_prices_due(CAST(:admin AS uuid), :days)", {"admin": admin, "days": days}
    )


# ---- The planner's demand and language (migration 048) ----


def _known_concept(concept: str | None) -> str:
    if concept not in CONCEPT_SLUGS:
        raise HTTPException(status_code=HTTP_422_UNPROCESSABLE, detail="choose one of the planner's concepts")
    return concept


@router.get("/planner/gaps", dependencies=[access.ADMIN])
async def planner_gaps(
    request: Request,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """What travellers asked for most that no trusted place could fill: what to check or recruit next."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db, "SELECT app.admin_step_gaps(CAST(:admin AS uuid), :days)", {"admin": admin, "days": days}
    )


@router.get("/planner/concepts", dependencies=[access.ADMIN])
async def planner_concepts(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    await _admin_id(request, db)
    return concept_catalogue()


@router.get("/planner/misses", dependencies=[access.ADMIN])
async def planner_misses(
    request: Request,
    status: str = Query(default="open", pattern="^(open|resolved|dismissed)$"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """What the planner could not read (redacted, consented, anonymous), most frequent first."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db, "SELECT app.admin_intent_misses(CAST(:admin AS uuid), :status)", {"admin": admin, "status": status}
    )


@router.post("/planner/misses/{miss_id}", dependencies=[access.ADMIN])
async def review_planner_miss(
    miss_id: UUID,
    payload: MissDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    if payload.decision == "phrase":
        _known_concept(payload.concept)
    result = await fetch_json(
        db,
        "SELECT app.admin_review_intent_miss(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(miss_id), "body": payload.model_dump_json(exclude_none=True)},
    )
    reset_phrases()
    return result


@router.get("/planner/phrases", dependencies=[access.ADMIN])
async def planner_phrases(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    admin = await _admin_id(request, db)
    return await fetch_json(db, "SELECT app.admin_list_intent_phrases(CAST(:admin AS uuid))", {"admin": admin})


@router.post("/planner/phrases", dependencies=[access.ADMIN])
async def add_planner_phrase(
    payload: IntentPhraseIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Teach the planner a phrase for one of its concepts ("7elwe" means sweets)."""
    admin = await _admin_id(request, db)
    _known_concept(payload.concept)
    result = await fetch_json(
        db,
        "SELECT app.admin_add_intent_phrase(CAST(:admin AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "body": payload.model_dump_json()},
    )
    reset_phrases()
    return result


@router.post("/planner/phrases/{phrase_id}/retire", dependencies=[access.ADMIN])
async def retire_planner_phrase(
    phrase_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    result = await fetch_json(
        db,
        "SELECT app.admin_retire_intent_phrase(CAST(:admin AS uuid), CAST(:id AS uuid))",
        {"admin": admin, "id": str(phrase_id)},
    )
    reset_phrases()
    return result


# ---- Candidate phrases and releases (migration 050) ----


@router.get("/planner/candidates/batches", dependencies=[access.ADMIN])
async def phrase_batches(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    admin = await _admin_id(request, db)
    return await fetch_json(db, "SELECT app.admin_phrase_batches(CAST(:admin AS uuid))", {"admin": admin})


@router.get("/planner/candidates", dependencies=[access.ADMIN])
async def phrase_candidates(
    request: Request,
    batch: str = Query(default="", max_length=60),
    concept: str = Query(default="", max_length=60),
    locale: str = Query(default="", pattern="^(|en|ar|ar-LB|arabizi|fr|mixed)$"),
    status: str = Query(default="candidate", pattern="^(candidate|approved|rejected)$"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0, le=100_000),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Phrases waiting for review (never read by the planner), a page at a time."""
    admin = await _admin_id(request, db)
    query = {"batch": batch, "concept": concept, "locale": locale, "status": status, "limit": limit, "offset": offset}
    return await fetch_json(
        db,
        "SELECT app.admin_list_phrase_candidates(CAST(:admin AS uuid), CAST(:filter AS jsonb))",
        {"admin": admin, "filter": json.dumps(query)},
    )


@router.post("/planner/candidates/review", dependencies=[access.ADMIN])
async def review_phrase_candidates(
    payload: CandidateReviewIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Approve (the planner reads them from now on) or reject (never imported again) up to 1,000 phrases."""
    admin = await _admin_id(request, db)
    result = await fetch_json(
        db,
        "SELECT app.admin_review_phrase_candidates(CAST(:admin AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "body": payload.model_dump_json()},
    )
    reset_phrases()
    return result


@router.get("/planner/releases", dependencies=[access.ADMIN])
async def intent_data_releases(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    admin = await _admin_id(request, db)
    return await fetch_json(db, "SELECT app.admin_intent_data_releases(CAST(:admin AS uuid))", {"admin": admin})


@router.post("/planner/releases", dependencies=[access.ADMIN])
async def release_intent_data(
    payload: ReleaseIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Record the approved phrases as intent-data-vN - only if both eval sets still pass with them."""
    admin = await _admin_id(request, db)
    await refresh_phrases(db, force=True)
    passes, metrics = await asyncio.to_thread(measure)  # ~15 s of reading: off the event loop
    if not passes:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE,
            detail={"message": "the eval sets fall below the release gate with these phrases", "metrics": metrics},
        )
    return await fetch_json(
        db,
        "SELECT app.admin_release_intent_data(CAST(:admin AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "body": json.dumps({"note": payload.note, "metrics": metrics}, ensure_ascii=False)},
    )


# ---- Place facts and leads (migration 049) ----


@router.put("/place-facts/listings/{experience_id}", dependencies=[access.ADMIN])
async def set_place_facts(
    experience_id: UUID,
    payload: PlaceFactsIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_set_place_facts(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(experience_id), "body": payload.model_dump_json(exclude_none=True)},
    )


@router.post("/leads/import", dependencies=[access.ADMIN])
async def import_leads(
    payload: LeadsImportIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Leads from open data or an official list: checked by staff, never shown to travellers."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_import_leads(CAST(:admin AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "body": json.dumps(payload.leads, default=str)},
    )


@router.get("/leads", dependencies=[access.ADMIN])
async def list_leads(
    request: Request,
    status: str = Query(default="new", pattern="^(new|checking|published|rejected|duplicate)$"),
    destination: str = Query(default="", max_length=80),
    place_type: str = Query(default="", max_length=40),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """The lead queue, what travellers asked for and could not get first."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_list_leads(CAST(:admin AS uuid), CAST(:filter AS jsonb))",
        {
            "admin": admin,
            "filter": json.dumps({"status": status, "destination": destination, "place_type": place_type}),
        },
    )


@router.post("/leads/{lead_id}/decision", dependencies=[access.ADMIN])
async def decide_lead(
    lead_id: UUID,
    payload: LeadDecisionIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_decide_lead(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(lead_id), "body": payload.model_dump_json()},
    )


@router.post("/leads/{lead_id}/publish", dependencies=[access.ADMIN])
async def publish_lead(
    lead_id: UUID,
    payload: LeadPublishIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """After a visit or a call: the lead becomes a catalogue listing (a restaurant or stay as checked),
    with the facts staff confirmed there. Both are saved together or not at all."""
    admin = await _admin_id(request, db)
    published = await fetch_json(
        db,
        "SELECT app.admin_publish_lead(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"admin": admin, "id": str(lead_id), "body": payload.model_dump_json(exclude_none=True, exclude={"facts"})},
    )
    if payload.facts is not None and isinstance(published, dict):
        published["place_facts"] = await fetch_json(
            db,
            "SELECT app.admin_set_place_facts(CAST(:admin AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
            {
                "admin": admin,
                "id": str(published["experience_id"]),
                "body": payload.facts.model_dump_json(exclude_none=True),
            },
        )
    return published


@router.get("/leads/field-sheet", dependencies=[access.ADMIN])
async def lead_field_sheet(
    request: Request,
    status: str = Query(default="checking", pattern="^(new|checking)$"),
    destination: str = Query(default="", max_length=80),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Response:
    """A CSV to take on visits: one lead per row, most asked-for first, with empty columns to fill in."""
    admin = await _admin_id(request, db)
    leads = await fetch_json(
        db,
        "SELECT app.admin_list_leads(CAST(:admin AS uuid), CAST(:filter AS jsonb))",
        {"admin": admin, "filter": json.dumps({"status": status, "destination": destination, "limit": 200})},
    )
    place = re.sub(r"[^a-z0-9-]", "", destination.lower()) or "all"
    name = f"mshwar-field-sheet-{place}-{status}.csv"
    return Response(
        content=field_sheet_csv(leads if isinstance(leads, list) else []),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@router.get("/prices/worklist", dependencies=[access.ADMIN])
async def price_worklist(
    request: Request,
    destination: str = Query(default="", max_length=80),
    kind: str = Query(default="", pattern="^(|restaurant|hotel|attraction|experience)$"),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Listings the planner offers with no published price today, most planned first."""
    admin = await _admin_id(request, db)
    return await fetch_json(
        db,
        "SELECT app.admin_price_worklist(CAST(:admin AS uuid), CAST(:filter AS jsonb))",
        {"admin": admin, "filter": json.dumps({"destination": destination, "kind": kind})},
    )
