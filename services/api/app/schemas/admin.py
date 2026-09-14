from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class ReasonIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class AdminGrantIn(BaseModel):
    user_id: UUID
    tier: str = Field(default="ops", max_length=16)


class AdminRevokeIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class ModerationIn(BaseModel):
    action: str = Field(min_length=4, max_length=16)
    reason: str = Field(min_length=3, max_length=500)


class BulkModerationIn(BaseModel):
    entity_type: str = Field(min_length=3, max_length=16)
    ids: list[UUID] = Field(min_length=1, max_length=100)
    action: str = Field(min_length=4, max_length=16)
    reason: str = Field(min_length=3, max_length=500)
    confirm: bool = False


class TaxonomyCreateIn(BaseModel):
    kind: str = Field(min_length=3, max_length=32)
    slug: str = Field(min_length=2, max_length=80)
    label: str = Field(min_length=2, max_length=80)
    reason: str = Field(min_length=3, max_length=500)


class TaxonomyRenameIn(BaseModel):
    label: str = Field(min_length=2, max_length=80)
    reason: str = Field(min_length=3, max_length=500)


class TaxonomyMergeIn(BaseModel):
    target_id: UUID
    reason: str = Field(min_length=3, max_length=500)


class ConfigPutIn(BaseModel):
    key: str = Field(min_length=3, max_length=120)
    value: dict[str, Any]
    reason: str = Field(min_length=3, max_length=500)


class FlagPutIn(BaseModel):
    key: str = Field(min_length=2, max_length=80)
    environment: str = Field(default="development", max_length=32)
    cohort: str = Field(default="all", max_length=80)
    enabled: bool = False
    payload: dict[str, Any] = Field(default_factory=dict)
    reason: str = Field(min_length=3, max_length=500)


class SupportCaseCreateIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    booking_id: UUID | None = None
    experience_id: UUID | None = None
    review_id: UUID | None = None
    evidence: list[Any] = Field(default_factory=list)


class SupportAssignIn(BaseModel):
    assignee_id: UUID
    note: str | None = Field(default=None, max_length=500)


class SupportNoteIn(BaseModel):
    note: str = Field(default="", max_length=500)


class SupportResolveIn(BaseModel):
    outcome: str = Field(min_length=3, max_length=2000)
