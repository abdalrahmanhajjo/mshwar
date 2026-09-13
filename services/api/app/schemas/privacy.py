from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PrivacyResetOut(BaseModel):
    ok: bool
    preferences: dict[str, Any]
    identity_kept: bool
    bookings_kept: bool


class PrivacyDeleteIn(BaseModel):
    confirmation: str = Field(min_length=6, max_length=40)


class PrivacyDeleteOut(BaseModel):
    ok: bool
    status: str
    bookings_kept: int
