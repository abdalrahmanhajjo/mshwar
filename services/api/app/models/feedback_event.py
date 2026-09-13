from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class FeedbackEvent(Base):
    __tablename__ = "feedback_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    trip_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("app.trips.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("app.users.id"), nullable=True)
    original_recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_modification: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    outcome: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", backref="feedback_events")
    user = relationship("User", backref="feedback_events")
