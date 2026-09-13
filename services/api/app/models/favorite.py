from __future__ import annotations

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class Favorite(Base):
    __tablename__ = "favorites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("app.users.id"), nullable=False)
    business_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("app.businesses.id"), nullable=True)
    experience_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("app.experiences.id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="favorites")
    business = relationship("Business", backref="favorites")
    experience = relationship("Experience", backref="favorites")
