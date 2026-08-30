from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Any
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Float, String, Text, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class DigitalTwinState(Base):
    __tablename__ = "digital_twin_states"

    id: str = Column(String, primary_key=True, default=lambda: str(uuid4()))
    cow_id: str = Column(String, ForeignKey("cows.id", ondelete="CASCADE"), nullable=False, index=True)
    farm_id: Optional[str] = Column(String, ForeignKey("farms.id", ondelete="SET NULL"), nullable=True)
    owner_id: str = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    vitality_score: float = Column(Float, nullable=False, default=100.0)
    health_status: str = Column(String, nullable=False, default="Healthy")
    heat_stress_level: str = Column(String, nullable=False, default="Comfort")
    status_summary: Optional[str] = Column(Text, nullable=True)
    state_data: Optional[dict[str, Any]] = Column(JSON, nullable=True)

    created_at: datetime = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    cow = relationship("Cow", backref="digital_twin_states")
    farm = relationship("Farm")
    owner = relationship("User")
