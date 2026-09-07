from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Any
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Float, String, Text, JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column

from ..database.base import Base
from ..database.types import GUID


class DigitalTwinState(Base):
    __tablename__ = "digital_twin_states"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=lambda: str(uuid4()))
    cow_id: Mapped[str] = mapped_column(GUID(), ForeignKey("cows.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id: Mapped[Optional[str]] = mapped_column(GUID(), ForeignKey("farms.id", ondelete="SET NULL"), nullable=True)
    owner_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    vitality_score: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    health_status: Mapped[str] = mapped_column(String(50), nullable=False, default="Healthy")
    heat_stress_level: Mapped[str] = mapped_column(String(50), nullable=False, default="Comfort")
    status_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    state_data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    cow = relationship("Cow", backref="digital_twin_states")
    farm = relationship("Farm")
    owner = relationship("User")

