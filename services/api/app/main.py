from __future__ import annotations

import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError
from starlette.exceptions import HTTPException

from app.api.v1.api_router import router as api_router
from app.core.config import settings
from app.core.context import clear_session_context
from app.core.log_scrubbing import install_scrubbing
from app.core.log_scrubbing import request_id as log_request_id
from app.core.security_limits import metrics

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
    expose_headers=["X-Request-ID", "Retry-After", "X-RateLimit-Policy"],
)


@app.middleware("http")
async def session_context_middleware(request: Request, call_next: Any) -> Any:
    clear_session_context()
    try:
        correlation = str(uuid.UUID(request.headers.get("x-request-id", "")))
    except ValueError:
        correlation = str(uuid.uuid4())
    request.state.request_id = correlation
    token = log_request_id.set(correlation)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = correlation
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        if request.cookies or request.method != "GET" or "/files/" in request.url.path:
            response.headers["Cache-Control"] = "no-store"
        return response
    finally:
        log_request_id.reset(token)
        clear_session_context()


@app.exception_handler(HTTPException)
async def safe_http_error(request: Request, exc: HTTPException) -> JSONResponse:
    code = exc.status_code
    detail = exc.detail
    if code in {403, 404} and request.path_params and not request.url.path.startswith("/api/v1/admin/"):
        code, detail = 404, "Resource not found"
    headers = dict(exc.headers or {})
    if code == 429:
        headers.setdefault("Retry-After", "60")
        metrics["rate_limit.responses"] += 1
    return JSONResponse({"detail": detail}, status_code=code, headers=headers)


@app.exception_handler(RequestValidationError)
async def safe_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Pydantic input/ctx may contain the submitted password or upload body.
    return JSONResponse(
        {"detail": [{"loc": e["loc"], "type": e["type"], "msg": "Invalid value"} for e in exc.errors()]},
        status_code=422,
    )


install_scrubbing()


app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy", "service": "mshwar-api"}


@app.exception_handler(DBAPIError)
async def safe_database_error(request: Request, exc: DBAPIError) -> JSONResponse:
    from app.core.portal_auth import raise_from_db

    try:
        raise_from_db(exc)
    except HTTPException as mapped:
        return await safe_http_error(request, mapped)
    return JSONResponse({"detail": "Request failed"}, status_code=500)
