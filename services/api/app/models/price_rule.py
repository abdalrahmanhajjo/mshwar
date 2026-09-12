from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class PriceRule(Base):
    __tablename__ = "price_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    experience_id: Mapped[int] = mapped_column(Integer, ForeignKey("experiences.id"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="LBP")
    price_type: Mapped[str] = mapped_column(String(50), nullable=False)
    amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_group_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_group_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    effective_from: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    effective_until: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    experience = relationship("Experience", backref="price_rules")
