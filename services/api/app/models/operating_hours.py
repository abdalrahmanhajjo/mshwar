from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Date, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class OperatingHours(Base):
    __tablename__ = "operating_hours"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(Integer, ForeignKey("businesses.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    open_time: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    close_time: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    exception_date: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    business = relationship("Business", backref="operating_hours")
