from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.hub_query import raise_hub_error
from app.api.v1.session import require_session
from app.core.sessions import clear_session_cookie
from app.dependencies import get_auth_db
from app.schemas.privacy import PrivacyDeleteIn, PrivacyDeleteOut, PrivacyResetOut

router = APIRouter()

_DELETE_CONFIRMATION = "DELETE"


@router.get("/export")
async def export_my_data(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> JSONResponse:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.export_my_data(:user_id)"),
                {"user_id": str(session["user_id"])},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Account not found")
        raise
    if row is None or row[0] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    payload: Any = row[0]
    if isinstance(payload, str):
        payload = json.loads(payload)
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": 'attachment; filename="mshwar-data-export.json"'},
    )


@router.post("/reset-personalisation", response_model=PrivacyResetOut)
async def reset_personalisation(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> PrivacyResetOut:
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.reset_my_personalisation(:user_id)"),
                {"user_id": str(session["user_id"])},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Account not found")
        raise
    if row is None or row[0] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    body = row[0]
    if isinstance(body, str):
        body = json.loads(body)
    return PrivacyResetOut.model_validate(body)


@router.post("/delete-account", response_model=PrivacyDeleteOut)
async def delete_account(
    payload: PrivacyDeleteIn,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> PrivacyDeleteOut:
    if payload.confirmation.strip().upper() != _DELETE_CONFIRMATION:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Confirmation required")
    session = await require_session(request, db)
    try:
        row = (
            await db.execute(
                text("SELECT app.anonymise_my_account(:user_id)"),
                {"user_id": str(session["user_id"])},
            )
        ).first()
    except DBAPIError as exc:
        raise_hub_error(exc, "Account not found")
        raise
    if row is None or row[0] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    clear_session_cookie(response)
    body = row[0]
    if isinstance(body, str):
        body = json.loads(body)
    return PrivacyDeleteOut.model_validate(body)


class ConsentUpdate(BaseModel):
    personalisation: bool | None = None
    marketing: bool | None = None


@router.get("/consents")
async def get_consents(request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await require_session(request, db)
    return await db.scalar(text("SELECT app.security_consents(:actor)"), {"actor": str(session["user_id"])})


@router.put("/consents")
async def update_consents(payload: ConsentUpdate, request: Request, db: AsyncSession = Depends(get_auth_db)) -> Any:  # noqa: B008
    session = await require_session(request, db)
    return await db.scalar(
        text("SELECT app.security_consents(:actor, :personal, :marketing)"),
        {"actor": str(session["user_id"]), "personal": payload.personalisation, "marketing": payload.marketing},
    )
