from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class PriceRule(Base):
    __tablename__ = "price_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    experience_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.experiences.id"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="LBP")
    price_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    min_group_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_group_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    effective_from: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_until: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    experience = relationship("Experience", backref="price_rules")
