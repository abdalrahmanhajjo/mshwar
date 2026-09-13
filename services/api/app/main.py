from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api_router import router as api_router
from app.core.config import settings
from app.core.context import clear_session_context, set_session_context

app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="Mshwar AI-Powered Lebanon Trip & Experience Platform API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def session_context_middleware(request: Request, call_next: Any) -> Any:
    """Set session context (current user and organization) on every request and clear on release."""

    x_user_id = request.headers.get("x-user-id")
    x_org_id = request.headers.get("x-organization-id")

    if x_user_id and x_org_id:
        try:
            set_session_context(uuid.UUID(x_user_id), uuid.UUID(x_org_id), request.headers.get("x-request-id"))
        except (ValueError, TypeError):
            pass

    try:
        response = await call_next(request)
        return response
    finally:
        clear_session_context()


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "mshwar-api"}
