from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class RecommendationEvent(Base):
    __tablename__ = "recommendation_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    trip_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("app.trips.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("app.users.id"), nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    candidate_ids: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation_order: Mapped[str] = mapped_column(Text, nullable=False)
    ranking_scores: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", backref="recommendation_events")
    user = relationship("User", backref="recommendation_events")
