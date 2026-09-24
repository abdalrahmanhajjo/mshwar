"""Licensed money changers (V4).

Only exchange institutions on Banque du Liban's list show here, with their
registration number and category, and only while every check holds. Rates are
the changer's own, labelled with when they were posted; Mshwar never exchanges
money and never ranks changers by rate.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.partners import present_partner
from app.core import access
from app.core.auth_session import require_session
from app.core.rate_limit import limit
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.partners import ExchangeReportIn, LicenceIn, OfficeIn, RatesIn

router = APIRouter()


@router.get("/destinations/{slug}", dependencies=[access.PUBLIC, limit("search")])
async def destination_changers(slug: str, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Live branches in a destination, with fresh rates (under 12 hours old) where posted."""
    return present_partner(await fetch_json(db, "SELECT app.public_destination_changers(:slug)", {"slug": slug}))


@router.post("/reports", dependencies=[access.SESSION, limit("community-write")])
async def report(payload: ExchangeReportIn, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """A different rate at the counter, a counterfeit note (escalated at once), a refused receipt."""
    session = await require_session(request, db)
    return await fetch_json(
        db,
        "SELECT app.report_exchange(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": str(session["user_id"]), "body": payload.model_dump_json()},
    )


@router.get("/me", dependencies=[access.SESSION])
async def my_exchange(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await require_session(request, db)
    return present_partner(
        await fetch_json(db, "SELECT app.changer_portal(CAST(:uid AS uuid))", {"uid": str(session["user_id"])})
    )


@router.put("/me/licence", dependencies=[access.SESSION, limit("partner-write")])
async def set_licence(payload: LicenceIn, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await require_session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.changer_set_licence(CAST(:uid AS uuid), CAST(:sid AS uuid), CAST(:body AS jsonb))",
            {"uid": str(session["user_id"]), "sid": str(session["session_id"]), "body": payload.model_dump_json()},
        )
    )


@router.put("/me/offices", dependencies=[access.SESSION, limit("partner-write")])
async def upsert_office(payload: OfficeIn, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Add or edit a branch. Moving it on a live account needs a fresh code and a new visit."""
    session = await require_session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.changer_upsert_office(CAST(:uid AS uuid), CAST(:sid AS uuid), CAST(:body AS jsonb))",
            {"uid": str(session["user_id"]), "sid": str(session["session_id"]), "body": payload.model_dump_json()},
        )
    )


@router.post("/me/rates", dependencies=[access.SESSION, limit("partner-write")])
async def post_rates(payload: RatesIn, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Post today's buy and sell rates. Always needs a fresh authenticator code."""
    session = await require_session(request, db)
    return present_partner(
        await fetch_json(
            db,
            "SELECT app.changer_post_rates(CAST(:uid AS uuid), CAST(:sid AS uuid), CAST(:body AS jsonb))",
            {"uid": str(session["user_id"]), "sid": str(session["session_id"]), "body": payload.model_dump_json()},
        )
    )
