from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class Refund(Base):
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(Integer, ForeignKey("bookings.id"), nullable=False)
    payment_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("payments.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="LBP")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    booking = relationship("Booking", backref="refunds")
    payment = relationship("Payment", backref="refunds")
