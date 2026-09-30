from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api_router import router as api_router
from app.core import access
from app.core.config import settings
from app.core.csrf import CrossSiteRequestGuard
from app.core.db_role import check_database_role
from app.core.errors import install_error_handlers
from app.core.http_hardening import HttpHardening
from app.core.logging import configure_logging
from app.core.observability import init_sentry
from app.core.request_context import RequestContextMiddleware
from app.dependencies import engine

configure_logging(settings.log_level, settings.log_format)
init_sentry()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.is_deployed:
        await check_database_role(engine)
    yield


def api_doc_urls(deployed: bool) -> dict[str, str | None]:
    """The interactive docs list every route and field; they stay off wherever the app is
    deployed (security plan SEC-13). Locally they are at /docs."""
    if deployed:
        return {"docs_url": None, "redoc_url": None, "openapi_url": None}
    return {"docs_url": "/docs", "redoc_url": "/redoc", "openapi_url": "/openapi.json"}


app = FastAPI(
    title=settings.project_name,
    version=settings.version,
    description="Mshwar AI-Powered Lebanon Trip & Experience Platform API",
    lifespan=lifespan,
    **api_doc_urls(settings.is_deployed),  # type: ignore[arg-type]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Retry-After"],
)
# Refuses cookie-carrying writes from other sites (inside the request-id middleware).
app.add_middleware(CrossSiteRequestGuard)
# Security headers on every response and a size cap on every request body (SEC-15, SEC-16).
app.add_middleware(HttpHardening)
# Outermost, so the id exists for CORS rejections and error handlers too.
app.add_middleware(RequestContextMiddleware)
install_error_handlers(app)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health", dependencies=[access.PUBLIC])
async def health_check() -> dict[str, str]:
    """Liveness: the process is up. Readiness (database) is /api/v1/health."""
    return {"status": "healthy", "service": "mshwar-api"}


# Refuse to start if any route lacks an access policy (MSHWAR-108).
access.verify_route_policies(app)
