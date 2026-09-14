"""Bounded quotas with a shared Postgres backend in production and a CI-safe memory stub."""

from __future__ import annotations

import hashlib
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import text

from app.core.config import settings
from app.core.rate_limit import limiter

metrics: Counter[str] = Counter()


def client_ip(request: Request) -> str:
    # Forwarded headers are untrusted. The ingress/ASGI server must resolve trusted proxies.
    return request.client.host if request.client else "unknown"


def policy(key: str, authenticated: bool) -> tuple[int, int]:
    if key.startswith("auth."):
        return (60 if authenticated else 20, 60)
    if key.startswith("planner."):
        return (30 if authenticated else 5, 60)
    if key.startswith(("checkout.", "bookings.")):
        return (60 if authenticated else 20, 60)
    if key.startswith(("catalogue.", "locations.", "businesses.")):
        return (120 if authenticated else 60, 60)
    return (240 if authenticated else 60, 60)


async def reserve(key: str, limit: int, window: int, amount: int = 1, *, durable: bool = False) -> int:
    if settings.security_rate_backend == "postgres" or durable:
        from app.dependencies import async_session

        async with async_session() as db:
            retry = await db.scalar(
                text("SELECT app.security_reserve(:key, :lim, :window, :amount)"),
                {"key": hashlib.sha256(key.encode()).hexdigest(), "lim": limit, "window": window, "amount": amount},
            )
            await db.commit()  # Reservations survive business transaction rollback and worker restarts.
            return int(retry or 0)
    return 0 if limiter.allow(key, limit, window) else limiter.retry_after(key, window)


def reject(retry: int, category: str) -> None:
    metrics[f"{category}.denied"] += 1
    raise HTTPException(
        429,
        "Daily AI budget reached" if category == "ai_budget" else "Too many requests",
        headers={"Retry-After": str(max(1, retry)), "X-RateLimit-Policy": category},
    )


async def enforce_limits(request: Request, key: str, session: dict[str, Any] | None) -> None:
    # Always retain an IP cap; rotating cookies or sending forged forwarded headers cannot bypass it.
    limit, window = policy(key, bool(session))
    retry = await reserve(f"endpoint:{key}:ip:{client_ip(request)}", limit * (3 if session else 1), window)
    if retry:
        reject(retry, key)
    if session:
        retry = await reserve(f"endpoint:{key}:user:{session['user_id']}", limit, window)
        if retry:
            reject(retry, key)
    metrics[f"{key}.allowed"] += 1
    if session and key.startswith("planner.") and request.method == "POST":
        # Conservative maximum per request, including bounded retries, never refunded on failure.
        day = datetime.now(timezone.utc).date().isoformat()
        retry = await reserve(
            f"ai:{session['user_id']}:{day}",
            settings.ai_daily_budget_micros,
            86400,
            settings.ai_request_budget_micros,
            durable=True,
        )
        if retry:
            reject(retry, "ai_budget")
