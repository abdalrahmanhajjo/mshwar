from __future__ import annotations

import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.dependencies import Base


class Favorite(Base):
    __tablename__ = "favorites"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    business_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("businesses.id"), nullable=True)
    experience_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("experiences.id"), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", backref="favorites")
    business = relationship("Business", backref="favorites")
    experience = relationship("Experience", backref="favorites")

    __table_args__ = (
        {"sqlite_autoincrement": True},
    )
