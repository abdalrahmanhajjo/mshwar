from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class GroupParticipant(Base):
    __tablename__ = "group_participants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    trip_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.trips.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="member")
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("Trip", backref="participants")
    user = relationship("User", backref="group_participations")
