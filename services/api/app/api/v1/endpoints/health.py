from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_auth_db

router = APIRouter()


@router.get("")
async def health(
    response: Response,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, str]:
    """Readiness: reports whether the database answers."""
    try:
        await db.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "database": "unavailable"}
    return {"status": "ok", "database": "ok"}
