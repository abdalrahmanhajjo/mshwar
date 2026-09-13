from __future__ import annotations

import datetime
import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    business_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.businesses.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_type: Mapped[str] = mapped_column(String(50), default="fixed")
    price_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_currency: Mapped[str] = mapped_column(String(3), default="LBP")
    suitable_for_groups: Mapped[bool] = mapped_column(Boolean, default=True)
    indoor_outdoor: Mapped[str] = mapped_column(String(20), default="indoor")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    business = relationship("Business", backref="experiences")
    category = relationship("Category", backref="experiences")
