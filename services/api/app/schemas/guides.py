"""Request bodies for the guide portal (G1: identity and verification)."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

TIERS = {"licensed", "host"}
DOCUMENT_KINDS = {"licence", "id", "first_aid", "insurance", "driving"}


class GuideProfileIn(BaseModel):
    """The application form. Everything but tier and name is optional at draft."""

    model_config = ConfigDict(extra="forbid")

    tier: str
    display_name: str = Field(min_length=2, max_length=80)
    headline: str = Field(default="", max_length=140)
    bio: str = Field(default="", max_length=4000)
    languages: list[str] = Field(default_factory=list, max_length=8)
    regions: list[str] = Field(default_factory=list, max_length=12)
    specialities: list[str] = Field(default_factory=list, max_length=12)
    years_guiding: int | None = Field(default=None, ge=0, le=70)
    phone: str = Field(default="", max_length=32)

    @field_validator("tier")
    @classmethod
    def known_tier(cls, value: str) -> str:
        if value not in TIERS:
            raise ValueError("tier must be licensed or host")
        return value


class GuideCredentialIn(BaseModel):
    """One uploaded document. The key points at private storage, never a URL."""

    model_config = ConfigDict(extra="forbid")

    kind: str
    document_key: str = Field(min_length=1, max_length=400)
    reference: str = Field(default="", max_length=120)
    issuer: str = Field(default="", max_length=120)
    issued_on: date | None = None
    expires_on: date | None = None

    @field_validator("kind")
    @classmethod
    def known_kind(cls, value: str) -> str:
        if value not in DOCUMENT_KINDS:
            raise ValueError("unknown document kind")
        return value


class GuideDocumentDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str
    reason: str = Field(default="", max_length=500)

    @field_validator("decision")
    @classmethod
    def known_decision(cls, value: str) -> str:
        if value not in {"verified", "rejected"}:
            raise ValueError("decision must be verified or rejected")
        return value


class GuideDecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    decision: str
    reason: str = Field(default="", max_length=500)

    @field_validator("decision")
    @classmethod
    def known_decision(cls, value: str) -> str:
        if value not in {"approved", "rejected", "suspended"}:
            raise ValueError("unknown decision")
        return value
