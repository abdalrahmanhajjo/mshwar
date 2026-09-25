"""Local restaurants and places to stay (V5, V6).

Eat and Stay show only places a person has checked, each with its level
("licence checked, run by the owner" or "visited by Mshwar") and the date.
Owners set their kind, licence and details in the business portal and claim
places our team or a guide added.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import access
from app.core.auth_session import require_session
from app.core.rate_limit import limit
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.partners import ClaimIn, ListingDetailsIn, PlaceTypesIn

router = APIRouter()


@router.get("/destinations/{slug}", dependencies=[access.PUBLIC, limit("search")])
async def eat_and_stay(slug: str, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Checked restaurants and stays in a destination, licensed-and-claimed first."""
    return await fetch_json(db, "SELECT app.public_destination_eat_stay(:slug)", {"slug": slug})


@router.get("/near", dependencies=[access.PUBLIC, limit("search")])
async def near(
    kind: str = Query(pattern="^(restaurant|hotel)$"),
    lat: float = Query(ge=33.0, le=34.8),
    lng: float = Query(ge=35.0, le=36.7),
    radius: int = Query(default=15000, ge=500, le=50000),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """For the planner: where to sleep near the day's last stop, where to eat near a stop."""
    return await fetch_json(
        db,
        "SELECT app.public_venues_near(:kind, :lat, :lng, :radius)",
        {"kind": kind, "lat": lat, "lng": lng, "radius": radius},
    )


@router.get("/place-types", dependencies=[access.PUBLIC, limit("search")])
async def place_types(db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Every kind of place a listing can be and a traveller can ask for, named in en/ar/fr."""
    return await fetch_json(db, "SELECT app.place_types_json()", {})


@router.get("/portal/{org_id}/listings/{experience_id}/place-types", dependencies=[access.SESSION])
async def listing_place_types(
    org_id: UUID,
    experience_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.portal_get_place_types(CAST(:uid AS uuid), CAST(:org AS uuid), CAST(:exp AS uuid))",
        {"uid": str(session["user_id"]), "org": str(org_id), "exp": str(experience_id)},
    )


@router.put(
    "/portal/{org_id}/listings/{experience_id}/place-types",
    dependencies=[access.SESSION, limit("partner-write")],
)
async def set_listing_place_types(
    org_id: UUID,
    experience_id: UUID,
    payload: PlaceTypesIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """What kinds of place this is, so the trip planner can offer it for the right step of a day."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.portal_set_place_types(CAST(:uid AS uuid), CAST(:org AS uuid), CAST(:exp AS uuid), "
        "CAST(:body AS jsonb))",
        {
            "uid": str(session["user_id"]),
            "org": str(org_id),
            "exp": str(experience_id),
            "body": payload.model_dump_json(exclude_none=True),
        },
    )


@router.get("/portal/{org_id}/listings/{experience_id}", dependencies=[access.SESSION])
async def listing_details(
    org_id: UUID,
    experience_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.portal_get_listing_details(CAST(:uid AS uuid), CAST(:org AS uuid), CAST(:exp AS uuid))",
        {"uid": str(session["user_id"]), "org": str(org_id), "exp": str(experience_id)},
    )


@router.put("/portal/{org_id}/listings/{experience_id}", dependencies=[access.SESSION, limit("partner-write")])
async def set_listing_details(
    org_id: UUID,
    experience_id: UUID,
    payload: ListingDetailsIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Kind, licence and details. A new licence number is checked again before it shows."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.portal_set_listing_details(CAST(:uid AS uuid), CAST(:org AS uuid), CAST(:exp AS uuid), "
        "CAST(:body AS jsonb))",
        {
            "uid": str(session["user_id"]),
            "org": str(org_id),
            "exp": str(experience_id),
            "body": payload.model_dump_json(),
        },
    )


@router.get("/portal/{org_id}/claims", dependencies=[access.SESSION])
async def list_claims(org_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.portal_list_claims(CAST(:uid AS uuid), CAST(:org AS uuid))",
        {"uid": str(session["user_id"]), "org": str(org_id)},
    )


@router.post("/portal/{org_id}/claims", dependencies=[access.SESSION, limit("partner-write")])
async def claim(
    org_id: UUID,
    payload: ClaimIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Ask to run a place our team or a guide added. A reviewer checks the link before handing it over."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.portal_claim_listing(CAST(:uid AS uuid), CAST(:org AS uuid), CAST(:body AS jsonb))",
        {"uid": str(session["user_id"]), "org": str(org_id), "body": payload.model_dump_json()},
    )
