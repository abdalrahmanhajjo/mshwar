from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class Trip(BaseModel):
    id: int
    name: str
    status: str = "draft"


class TripCreate(BaseModel):
    name: str


@router.get("", response_model=list[Trip])
async def list_trips() -> list[Trip]:
    return []


@router.post("", response_model=Trip)
async def create_trip(trip: TripCreate) -> Trip:
    return Trip(id=1, name=trip.name, status="confirmed")
