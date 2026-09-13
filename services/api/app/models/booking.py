from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    business_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.businesses.id"))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    price_snapshot: Mapped[str] = mapped_column(Text, nullable=True)
    policy_snapshot: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    business = relationship("Business", backref="bookings")
