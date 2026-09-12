from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class Vote(Base):
    __tablename__ = "votes"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("trips.id"), nullable=False)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("group_participants.id"), nullable=False)
    experience_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("experiences.id"), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", backref="votes")
    participant = relationship("GroupParticipant", backref="votes")
    experience = relationship("Experience", backref="votes")
