"""Booking a verified driver (V3).

Travellers ask; live drivers in the area send fixed prices; the traveller
accepts one. Payment happens in the car, so nothing here moves money. The
share link for family is a random token: only its hash is stored, and the
link is shown once, when it is made.
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.partners import present_partner
from app.core import access
from app.core.auth_session import require_session
from app.core.rate_limit import limit
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.partners import (
    DriverTermsIn,
    RideCancelIn,
    RideFinishIn,
    RideQuoteIn,
    RideReportIn,
    RideRequestIn,
    RideReviewIn,
)

router = APIRouter()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _uid(request: Request, db: AsyncSession) -> str:
    session = await require_session(request, db)
    return str(session["user_id"])


async def _call(db: AsyncSession, sql: str, params: dict[str, Any]) -> Any:
    return present_partner(await fetch_json(db, sql, params))


# ---- Public ------------------------------------------------------------------------------


@router.get("/drivers", dependencies=[access.PUBLIC, limit("search")])
async def driver_directory(destination: str | None = None, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Live drivers, optionally only those who cover one destination."""
    return await _call(db, "SELECT app.public_driver_directory(:dest)", {"dest": destination})


@router.get("/drivers/{slug}", dependencies=[access.PUBLIC, limit("search")])
async def driver_page(slug: str, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    page = await _call(db, "SELECT app.public_driver_page(:slug)", {"slug": slug})
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return page


@router.get("/shared/{token}", dependencies=[access.TOKEN])
async def shared_ride(token: str, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """What family sees: driver, car and plate, where and when. Nothing to contact anyone with."""
    view = await _call(db, "SELECT app.ride_shared_view(:hash)", {"hash": _hash(token)})
    if not view:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return view


# ---- Travellers ------------------------------------------------------------------------------


@router.post("/requests", dependencies=[access.SESSION, limit("ride-request")])
async def request_ride(payload: RideRequestIn, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.traveller_request_ride(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": payload.model_dump_json()},
    )


@router.get("/mine", dependencies=[access.SESSION])
async def my_rides(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(db, "SELECT app.traveller_list_rides(CAST(:uid AS uuid))", {"uid": uid})


@router.get("/requests/{request_id}", dependencies=[access.SESSION])
async def get_request(request_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.traveller_get_request(CAST(:uid AS uuid), CAST(:id AS uuid))",
        {"uid": uid, "id": str(request_id)},
    )


@router.post("/requests/{request_id}/cancel", dependencies=[access.SESSION, limit("ride-request")])
async def cancel_request(request_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.traveller_cancel_request(CAST(:uid AS uuid), CAST(:id AS uuid))",
        {"uid": uid, "id": str(request_id)},
    )


@router.post("/quotes/{quote_id}/accept", dependencies=[access.SESSION, limit("ride-request")])
async def accept_quote(quote_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Book this driver at this price. The share token is returned once."""
    uid = await _uid(request, db)
    token = secrets.token_urlsafe(24)
    ride = await _call(
        db,
        "SELECT app.traveller_accept_quote(CAST(:uid AS uuid), CAST(:id AS uuid), :hash)",
        {"uid": uid, "id": str(quote_id), "hash": _hash(token)},
    )
    if isinstance(ride, dict):
        ride["share_token"] = token
    return ride


@router.post("/{ride_id}/share", dependencies=[access.SESSION, limit("ride-request")])
async def new_share_link(ride_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """A fresh share link; the old one stops working."""
    uid = await _uid(request, db)
    token = secrets.token_urlsafe(24)
    await fetch_json(
        db,
        "SELECT app.rotate_ride_share(CAST(:uid AS uuid), CAST(:id AS uuid), :hash)",
        {"uid": uid, "id": str(ride_id), "hash": _hash(token)},
    )
    return {"share_token": token}


# ---- Drivers ---------------------------------------------------------------------------------


@router.put("/driver/terms", dependencies=[access.SESSION, limit("partner-write")])
async def set_terms(payload: DriverTermsIn, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.driver_set_terms(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": payload.model_dump_json()},
    )


@router.get("/driver/requests", dependencies=[access.SESSION])
async def open_requests(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Open requests in the driver's areas that one of their verified vehicles can take."""
    uid = await _uid(request, db)
    return await _call(db, "SELECT app.driver_open_requests(CAST(:uid AS uuid))", {"uid": uid})


@router.post("/driver/requests/{request_id}/quote", dependencies=[access.SESSION, limit("partner-write")])
async def quote(
    request_id: UUID,
    payload: RideQuoteIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.driver_quote(CAST(:uid AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "id": str(request_id), "body": payload.model_dump_json()},
    )


@router.post("/driver/requests/{request_id}/withdraw", dependencies=[access.SESSION, limit("partner-write")])
async def withdraw(request_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.driver_withdraw_quote(CAST(:uid AS uuid), CAST(:id AS uuid))",
        {"uid": uid, "id": str(request_id)},
    )


@router.get("/driver/rides", dependencies=[access.SESSION])
async def driver_rides(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(db, "SELECT app.driver_list_rides(CAST(:uid AS uuid))", {"uid": uid})


# ---- Either side ------------------------------------------------------------------------------


@router.post("/reports", dependencies=[access.SESSION, limit("community-write")])
async def report(payload: RideReportIn, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    """Safety, wrong driver, wrong plate and unsafe vehicle reach a person straight away."""
    uid = await _uid(request, db)
    return await fetch_json(
        db,
        "SELECT app.report_ride(CAST(:uid AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "body": payload.model_dump_json()},
    )


@router.get("/{ride_id}", dependencies=[access.SESSION])
async def get_ride(ride_id: UUID, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    uid = await _uid(request, db)
    return await _call(
        db, "SELECT app.get_ride(CAST(:uid AS uuid), CAST(:id AS uuid))", {"uid": uid, "id": str(ride_id)}
    )


@router.post("/{ride_id}/cancel", dependencies=[access.SESSION, limit("ride-request")])
async def cancel(
    ride_id: UUID,
    payload: RideCancelIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.cancel_ride(CAST(:uid AS uuid), CAST(:id AS uuid), :reason)",
        {"uid": uid, "id": str(ride_id), "reason": payload.reason},
    )


@router.post("/{ride_id}/finish", dependencies=[access.SESSION, limit("partner-write")])
async def finish(
    ride_id: UUID,
    payload: RideFinishIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.driver_finish_ride(CAST(:uid AS uuid), CAST(:id AS uuid), :outcome)",
        {"uid": uid, "id": str(ride_id), "outcome": payload.outcome},
    )


@router.post("/{ride_id}/review", dependencies=[access.SESSION, limit("community-write")])
async def review(
    ride_id: UUID,
    payload: RideReviewIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    uid = await _uid(request, db)
    return await _call(
        db,
        "SELECT app.write_ride_review(CAST(:uid AS uuid), CAST(:id AS uuid), CAST(:body AS jsonb))",
        {"uid": uid, "id": str(ride_id), "body": payload.model_dump_json()},
    )
