from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.guests import actor_ids
from app.core.sql import fetch_json
from app.dependencies import get_auth_db
from app.schemas.groups import ReviewReportIn, ReviewSubmitIn

router = APIRouter()


@router.get("/eligibility")
async def review_eligibility(
    request: Request,
    experience_id: UUID | None = None,
    listing_slug: str | None = Query(default=None, max_length=120),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, _guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.review_eligibility(:user_id, :experience_id, :slug)",
        {
            "user_id": user_id,
            "experience_id": str(experience_id) if experience_id else None,
            "slug": listing_slug,
        },
    )


@router.post("")
async def submit_review(
    payload: ReviewSubmitIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, _guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.submit_review(:user_id, :booking_id, :rating, :body, CAST(:dimensions AS jsonb))",
        {
            "user_id": user_id,
            "booking_id": str(payload.booking_id),
            "rating": payload.rating,
            "body": payload.body,
            "dimensions": json.dumps(payload.dimensions),
        },
    )


@router.get("")
async def list_public_reviews(
    experience_id: UUID | None = None,
    listing_slug: str | None = Query(default=None, max_length=120),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await fetch_json(
        db,
        "SELECT app.list_public_reviews(:experience_id, :slug)",
        {"experience_id": str(experience_id) if experience_id else None, "slug": listing_slug},
    )


@router.get("/aggregates")
async def review_aggregates(
    experience_id: UUID | None = None,
    listing_slug: str | None = Query(default=None, max_length=120),
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    return await fetch_json(
        db,
        "SELECT app.get_review_aggregates(:experience_id, :slug)",
        {"experience_id": str(experience_id) if experience_id else None, "slug": listing_slug},
    )


@router.post("/{review_id}/report")
async def report_review(
    review_id: UUID,
    payload: ReviewReportIn,
    request: Request,
    db: AsyncSession = Depends(get_auth_db),  # noqa: B008
) -> Any:
    user_id, _guest_id = await actor_ids(request, db, require_any=True)
    return await fetch_json(
        db,
        "SELECT app.report_review(:user_id, :review_id, :reason)",
        {"user_id": user_id, "review_id": str(review_id), "reason": payload.reason},
    )
