from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class RecommendationEvent(Base):
    __tablename__ = "recommendation_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("trips.id"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    candidate_ids: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation_order: Mapped[str] = mapped_column(Text, nullable=False)
    ranking_scores: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", backref="recommendation_events")
    user = relationship("User", backref="recommendation_events")
