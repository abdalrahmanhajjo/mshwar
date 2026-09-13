from __future__ import annotations

import datetime
import uuid

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class OperatingHours(Base):
    __tablename__ = "operating_hours"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    business_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.businesses.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    open_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    close_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    exception_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    business = relationship("Business", backref="operating_hours")
