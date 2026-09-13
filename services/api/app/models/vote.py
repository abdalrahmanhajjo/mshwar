from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class Vote(Base):
    __tablename__ = "votes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.trips.id"), nullable=False)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.group_participants.id"), nullable=False)
    experience_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("app.experiences.id"), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", backref="votes")
    participant = relationship("GroupParticipant", backref="votes")
    experience = relationship("Experience", backref="votes")
