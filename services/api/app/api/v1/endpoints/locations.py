from __future__ import annotations

"""Home / start-area catalog.

Seam for MSHWAR-207: the map location picker is not built yet. Clients
should read areas from ``GET /api/v1/locations/areas`` and persist
``home_area_id``. A later map picker can keep that field and add
coordinates without changing the profile contract.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_auth_db
from app.schemas.preferences import AreaCatalog, HomeArea

router = APIRouter()


@router.get("/areas", response_model=AreaCatalog)
async def list_areas(
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> AreaCatalog:
    rows = (await db.execute(text("SELECT id, slug, name, country_code FROM app.list_home_areas()"))).all()
    return AreaCatalog(
        source="catalog",
        picker="stub",
        replace_with="map location picker",
        areas=[HomeArea(id=row[0], slug=row[1], name=row[2], country_code=row[3]) for row in rows],
    )
