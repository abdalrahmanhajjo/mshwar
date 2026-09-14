from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.portal_auth import fetch_json
from app.dependencies import get_auth_db

router = APIRouter()

_INTERNAL_KEYS = frozenset({"internal_contact", "fulfilment_instructions"})


def public_organization_view(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    """Strip internal fulfilment fields from any public organisation payload."""
    if payload is None:
        return None
    cleaned = {key: value for key, value in payload.items() if key not in _INTERNAL_KEYS}
    organization = cleaned.get("organization")
    if isinstance(organization, dict):
        cleaned["organization"] = {key: value for key, value in organization.items() if key not in _INTERNAL_KEYS}
    return cleaned


@router.get("")
async def list_businesses(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> list[dict[str, Any]]:
    rows = await fetch_json(db, "SELECT app.list_public_organizations()", {})
    items = [public_organization_view(row) or {} for row in (rows or [])]
    if q:
        needle = q.lower()
        items = [item for item in items if needle in str(item.get("name", "")).lower()]
    if category:
        items = [
            item
            for item in items
            if any(
                str(exp.get("title", "")).lower().find(category.lower()) >= 0 for exp in item.get("experiences") or []
            )
        ]
    return items


@router.get("/experiences/{slug}")
async def get_public_experience(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    row = await fetch_json(db, "SELECT app.public_experience(:slug)", {"slug": slug})
    public = public_organization_view(row)
    if public is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experience not found")
    return public


@router.get("/{slug}")
async def get_business(
    slug: str,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> dict[str, Any]:
    row = await fetch_json(db, "SELECT app.public_organization(:slug)", {"slug": slug})
    public = public_organization_view(row)
    if public is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return public
