from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db

router = APIRouter()


class Business(BaseModel):
    id: int
    name: str
    category: str
    location: str
    verified: bool = False
    status: str = "active"


class BusinessCreate(BaseModel):
    name: str
    category: str
    location: str


class BusinessUpdate(BaseModel):
    name: Optional[str] = None  # noqa: UP045
    category: Optional[str] = None  # noqa: UP045
    status: Optional[str] = None  # noqa: UP045


@router.get("", response_model=list[Business])
async def list_businesses(
    q: Optional[str] = Query(None),  # noqa: UP045
    category: Optional[str] = Query(None),  # noqa: UP045
    db: AsyncSession = Depends(get_db),  # noqa: B008
) -> list[Business]:
    return []


@router.post("", response_model=Business)
async def create_business(business: BusinessCreate, db: AsyncSession = Depends(get_db)) -> Business:  # noqa: B008
    return Business(id=1, **business.model_dump())


@router.get("/{business_id}", response_model=Business)
async def get_business(business_id: int, db: AsyncSession = Depends(get_db)) -> Business:  # noqa: B008
    return Business(id=business_id, name="Sample", category="Sample", location="Lebanon")
