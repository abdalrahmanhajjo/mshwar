"""Getting to and around each destination (V2).

Route cards are public once a reviewer publishes them with a field check, and
hide themselves 90 days later. Signed-in travellers flag cards that are wrong;
approved guides propose new cards and updates.
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
from app.schemas.partners import TransportFlagIn, TransportRouteIn

router = APIRouter()


@router.get("/destinations/{slug}", dependencies=[access.PUBLIC, limit("search")])
async def destination_transport(slug: str, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """From the airport, from Beirut, between nearby places, and around: checked cards only."""
    return await fetch_json(db, "SELECT app.public_destination_transport(:slug)", {"slug": slug})


@router.get("/between", dependencies=[access.PUBLIC, limit("search")])
async def transport_between(
    from_slug: str = Query(alias="from", min_length=2, max_length=80),
    to_slug: str = Query(alias="to", min_length=2, max_length=80),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Checked ways to make one planner leg, from one destination to the next."""
    return await fetch_json(
        db, "SELECT app.public_transport_between(:from_slug, :to_slug)", {"from_slug": from_slug, "to_slug": to_slug}
    )


@router.post("/routes/{route_id}/flags", dependencies=[access.SESSION, limit("community-write")])
async def flag_route(
    route_id: UUID,
    payload: TransportFlagIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """Say a card is wrong. Three flags in 30 days, or one safety flag, send it back to review."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.flag_transport_route(CAST(:uid AS uuid), CAST(:rid AS uuid), CAST(:body AS jsonb))",
        {"uid": str(session["user_id"]), "rid": str(route_id), "body": payload.model_dump_json()},
    )


@router.post("/guide", dependencies=[access.SESSION, limit("guide-contribute")])
async def guide_submit(
    payload: TransportRouteIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    """An approved guide proposes a card, or an update to a published one."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.guide_submit_transport(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": str(session["user_id"]), "body": payload.model_dump_json()},
    )


@router.get("/guide", dependencies=[access.SESSION])
async def guide_cards(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await require_session(request, db)
    return await fetch_json(db, "SELECT app.guide_list_transport(CAST(:uid AS uuid))", {"uid": str(session["user_id"])})
