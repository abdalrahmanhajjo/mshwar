from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api_router import router as api_router
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging(settings.log_level, settings.log_format)

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

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness: the process is up. Readiness (database) is /api/v1/health."""
    return {"status": "healthy", "service": "mshwar-api"}
