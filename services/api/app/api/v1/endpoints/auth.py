from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.mailer import MailMessage, get_mailer
from app.core.passwords import hash_password, verify_password
from app.core.rate_limit import limiter
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
_INVALID_RESET = "Invalid or expired reset link"
_RATE_LIMITED = "Too many requests"


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
    email_verified: bool = False


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=8, max_length=256, repr=False)


class ResendVerificationRequest(BaseModel):
    email: str | None = Field(default=None, max_length=254)


class ResendVerificationResponse(BaseModel):
    ok: bool = True


_INVALID_VERIFY = "Invalid or expired verification link"


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)


class ForgotPasswordResponse(BaseModel):
    ok: bool = True


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=8, max_length=256, repr=False)
    password: str = Field(min_length=10, max_length=128, repr=False)


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
            "SELECT session_id, user_id, display_name, email, locale, status, expires_at, "
            "email_verified_at FROM app.get_session(:token_hash)"
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
    await _send_verification_email(db, email)
    return UserOut(
        id=user_id,
        email=email,
        display_name=payload.display_name.strip(),
        locale=locale,
        email_verified=False,
    )


@router.post("/signin", response_model=UserOut)
async def signin(
    payload: SignInRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    email = _normalize_email(payload.email)
    result = await db.execute(
        text(
            "SELECT user_id, password_hash, display_name, status, locale, email_verified_at "
            "FROM app.lookup_local_credential(:email)"
        ),
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
        email_verified=bool(row["email_verified_at"]),
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
        email_verified=bool(session.get("email_verified_at")),
    )


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:128]
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


async def _pad_forgot_duration(started: float) -> None:
    minimum = settings.password_reset_min_ms / 1000
    remaining = minimum - (time.monotonic() - started)
    if remaining > 0:
        await asyncio.sleep(remaining)


def _reset_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.password_reset_ttl_seconds)


def _reset_link(token: str) -> str:
    origin = settings.public_web_origin.rstrip("/")
    return f"{origin}/reset-password?token={token}"


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ForgotPasswordResponse:
    started = time.monotonic()
    email = _normalize_email(payload.email)
    ip = _client_ip(request)
    if not limiter.allow(f"forgot:ip:{ip}", settings.forgot_ip_limit, settings.rate_limit_window_seconds):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=_RATE_LIMITED)
    if not limiter.allow(f"forgot:email:{email}", settings.forgot_email_limit, settings.rate_limit_window_seconds):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=_RATE_LIMITED)

    token = new_session_token()
    token_hash = hash_session_token(token)
    result = await db.execute(
        text("SELECT app.issue_password_reset(:email, :token_hash, :expires_at)"),
        {"email": email, "token_hash": token_hash, "expires_at": _reset_expiry()},
    )
    user_id = result.scalar_one_or_none()
    if user_id is not None:
        await get_mailer().send(
            MailMessage(
                to=email,
                subject="Reset your Mshwar password",
                text_body=f"Use this link to choose a new password. It expires in 30 minutes.\n{_reset_link(token)}",
                purpose="password_reset",
                token=token,
            )
        )
    else:
        hash_session_token(new_session_token())
        await get_mailer().send(
            MailMessage(
                to=email,
                subject="Reset your Mshwar password",
                text_body="If an account exists, a reset link was issued.",
                purpose="password_reset_suppressed",
            )
        )
    await _pad_forgot_duration(started)
    return ForgotPasswordResponse()


@router.post("/reset-password", response_model=UserOut)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    ip = _client_ip(request)
    if not limiter.allow(f"reset:ip:{ip}", settings.forgot_ip_limit, settings.rate_limit_window_seconds):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=_RATE_LIMITED)
    password_hash = hash_password(payload.password)
    result = await db.execute(
        text("SELECT app.consume_password_reset(:token_hash, :password_hash)"),
        {"token_hash": hash_session_token(payload.token), "password_hash": password_hash},
    )
    user_id = result.scalar_one_or_none()
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_RESET)
    fetched = (
        await db.execute(
            text(
                """
                SELECT u.id, p.email, u.display_name, u.locale, u.email_verified_at
                FROM app.users u
                JOIN app.user_private p ON p.user_id = u.id
                WHERE u.id = :user_id
                """
            ),
            {"user_id": str(user_id)},
        )
    ).one()
    user = UserOut(
        id=fetched[0],
        email=fetched[1],
        display_name=fetched[2],
        locale=fetched[3],
        email_verified=bool(fetched[4]),
    )
    await _issue_cookie_session(db, response, user.id, request.headers.get("user-agent"))
    return user


def _verify_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.email_verification_ttl_seconds)


def _verify_link(token: str) -> str:
    origin = settings.public_web_origin.rstrip("/")
    return f"{origin}/verify-email?token={token}"


async def _send_verification_email(db: AsyncSession, email: str) -> None:
    token = new_session_token()
    token_hash = hash_session_token(token)
    result = await db.execute(
        text("SELECT app.issue_email_verification(:email, :token_hash, :expires_at)"),
        {"email": email, "token_hash": token_hash, "expires_at": _verify_expiry()},
    )
    if result.scalar_one_or_none() is None:
        hash_session_token(new_session_token())
        await get_mailer().send(
            MailMessage(
                to=email,
                subject="Verify your Mshwar email",
                text_body="If this address needs verification, a link was issued.",
                purpose="email_verification_suppressed",
            )
        )
        return
    await get_mailer().send(
        MailMessage(
            to=email,
            subject="Verify your Mshwar email",
            text_body=f"Use this link to verify your email. It expires in 24 hours.\n{_verify_link(token)}",
            purpose="email_verification",
            token=token,
        )
    )


async def require_verified_user(
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if session is None or session["status"] != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not session.get("email_verified_at"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email before booking",
        )
    return session


@router.post("/verify-email", response_model=UserOut)
async def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> UserOut:
    result = await db.execute(
        text("SELECT app.confirm_email_verification(:token_hash)"),
        {"token_hash": hash_session_token(payload.token)},
    )
    user_id = result.scalar_one_or_none()
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=_INVALID_VERIFY)
    fetched = (
        await db.execute(
            text(
                """
                SELECT u.id, p.email, u.display_name, u.locale, u.email_verified_at
                FROM app.users u
                JOIN app.user_private p ON p.user_id = u.id
                WHERE u.id = :user_id
                """
            ),
            {"user_id": str(user_id)},
        )
    ).one()
    user = UserOut(
        id=fetched[0],
        email=fetched[1],
        display_name=fetched[2],
        locale=fetched[3],
        email_verified=bool(fetched[4]),
    )
    existing = await _load_session(db, request.cookies.get(COOKIE_NAME))
    if existing is None or str(existing["user_id"]) != str(user.id):
        await _issue_cookie_session(db, response, user.id, request.headers.get("user-agent"))
    return user


@router.post("/resend-verification", response_model=ResendVerificationResponse)
async def resend_verification(
    payload: ResendVerificationRequest,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> ResendVerificationResponse:
    ip = _client_ip(request)
    if not limiter.allow(f"verify:ip:{ip}", settings.verify_ip_limit, settings.rate_limit_window_seconds):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=_RATE_LIMITED)
    session = await _load_session(db, request.cookies.get(COOKIE_NAME))
    email = _normalize_email(payload.email) if payload.email else (session["email"] if session else "")
    if not email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email")
    if not limiter.allow(f"verify:email:{email}", settings.verify_email_limit, settings.rate_limit_window_seconds):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=_RATE_LIMITED)
    await _send_verification_email(db, email)
    return ResendVerificationResponse()
