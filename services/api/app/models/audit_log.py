from __future__ import annotations

import datetime
import uuid
from typing import Any, Optional

from sqlalchemy import DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.dependencies import Base


class AuditLog(Base):
    """Canonical append-only table. Database triggers reject UPDATE/DELETE/TRUNCATE."""

    __tablename__ = "audit_log"
    __table_args__: dict[str, Any] = {"schema": "app", "extend_existing": True}  # noqa: RUF012
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))  # noqa: UP045 — SQLAlchemy resolves this annotation on Python 3.9
    request_id: Mapped[Optional[str]] = mapped_column(Text)  # noqa: UP045 — SQLAlchemy resolves this annotation on Python 3.9
    action: Mapped[str] = mapped_column(Text, nullable=False)
    table_name: Mapped[str] = mapped_column(Text, nullable=False)
    row_key: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    changes: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)  # noqa: UP045 — SQLAlchemy resolves this annotation on Python 3.9
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
