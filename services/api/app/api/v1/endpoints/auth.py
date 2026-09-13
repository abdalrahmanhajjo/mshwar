from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.passwords import hash_password, verify_password
from app.core.sessions import (
    COOKIE_NAME,
    clear_session_cookie,
    hash_session_token,
    new_session_token,
    session_expiry,
    set_session_cookie,
    should_refresh,
)
from app.dependencies import get_auth_db

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_LOCALES = frozenset({"ar", "en", "fr"})
LOCAL_ISSUER = "mshwar.local"


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128, repr=False)
    display_name: str = Field(min_length=1, max_length=80)
    locale: str = "en"


class SignInRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128, repr=False)


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    locale: str


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _validate_email(email: str) -> str:
    normalized = _normalize_email(email)
    if not _EMAIL_RE.match(normalized):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email")
    return normalized


def _validate_locale(locale: str) -> str:
    if locale not in _LOCALES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid locale")
    return locale


async def _issue_cookie_session(
    db: AsyncSession,
    response: Response,
    user_id: UUID,
    user_agent: str | None,
) -> None:
    token = new_session_token()
    token_hash = hash_session_token(token)
    await db.execute(
        text("SELECT app.issue_session(:user_id, :token_hash, :expires_at, :user_agent)"),
        {
            "user_id": str(user_id),
            "token_hash": token_hash,
            "expires_at": session_expiry(),
            "user_agent": (user_agent or "")[:300] or None,
        },
    )
    set_session_cookie(response, token)


async def _load_session(db: AsyncSession, token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    result = await db.execute(
        text(
            "SELECT session_id, user_id, display_name, email, locale, status, expires_at "
            "FROM app.get_session(:token_hash)"
        ),
        {"token_hash": hash_session_token(token)},
    )
    row = result.mappings().first()
    return dict(row) if row else None


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    email = _validate_email(payload.email)
    locale = _validate_locale(payload.locale)
    password_hash = hash_password(payload.password)
    try:
        result = await db.execute(
            text("SELECT app.register_local_user(:email, :display_name, :locale, :password_hash)"),
            {
                "email": email,
                "display_name": payload.display_name.strip(),
                "locale": locale,
                "password_hash": password_hash,
            },
        )
        user_id = result.scalar_one()
    except (IntegrityError, DBAPIError) as exc:
        detail = str(getattr(exc, "orig", exc))
        if "already registered" in detail or "23505" in detail:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            ) from exc
        raise
    await _issue_cookie_session(db, response, user_id, request.headers.get("user-agent"))
    return UserOut(id=user_id, email=email, display_name=payload.display_name.strip(), locale=locale)


@router.post("/signin", response_model=UserOut)
async def signin(
    payload: SignInRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    email = _normalize_email(payload.email)
    result = await db.execute(
        text("SELECT user_id, password_hash, display_name, status, locale FROM app.lookup_local_credential(:email)"),
        {"email": email},
    )
    row = result.mappings().first()
    if row is None or row["status"] != "active" or not verify_password(row["password_hash"], payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    await _issue_cookie_session(db, response, row["user_id"], request.headers.get("user-agent"))
    return UserOut(
        id=row["user_id"],
        email=email,
        display_name=row["display_name"],
        locale=row["locale"],
    )


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
async def signout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Response:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        await db.execute(
            text("SELECT app.revoke_session(:token_hash)"),
            {"token_hash": hash_session_token(token)},
        )
    clear_session_cookie(response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/refresh", response_model=UserOut)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    return await _me_or_refresh(request, response, db, force_refresh=True)


@router.get("/me", response_model=UserOut)
async def me(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    return await _me_or_refresh(request, response, db, force_refresh=False)


async def _me_or_refresh(
    request: Request,
    response: Response,
    db: AsyncSession,
    force_refresh: bool,
) -> UserOut:
    token = request.cookies.get(COOKIE_NAME)
    session = await _load_session(db, token)
    if session is None or session["status"] != "active":
        clear_session_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if token and (force_refresh or should_refresh(session["expires_at"])):
        await db.execute(
            text("SELECT app.refresh_session(:token_hash, :expires_at)"),
            {"token_hash": hash_session_token(token), "expires_at": session_expiry()},
        )
        set_session_cookie(response, token)
    return UserOut(
        id=session["user_id"],
        email=session["email"],
        display_name=session["display_name"],
        locale=session["locale"],
    )
