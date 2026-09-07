from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UUID,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .cow import Cow
    from .recommendation import Recommendation


class HealthAlert(Base):
    """Stores health risk assessments for cows."""

    __tablename__ = "health_alerts"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique health alert identifier.",
    )
    cow_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("cows.id", ondelete="CASCADE"),
        nullable=False,
        doc="Cow associated with the alert.",
    )
    alert_level: Mapped[str] = mapped_column(String(20), nullable=False, doc="Severity level of the alert.")
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False, doc="Type of alert.")
    prediction_id: Mapped[Optional[str]] = mapped_column(
        GUID(), ForeignKey("milk_predictions.id", ondelete="SET NULL"), nullable=True, doc="Linked prediction id"
    )
    observation_id: Mapped[Optional[str]] = mapped_column(
        GUID(), ForeignKey("daily_observations.id", ondelete="SET NULL"), nullable=True, doc="Linked observation id"
    )
    farm_id: Mapped[Optional[str]] = mapped_column(
        GUID(), ForeignKey("farms.id", ondelete="SET NULL"), nullable=True, doc="Linked farm id"
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Detailed description of the alert.")
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, default=0.0, server_default='0.0', doc="Confidence score for the alert.")
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, doc="Whether the alert has been resolved.")
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User who owns this health alert.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the alert was created.",
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the alert was last updated.",
    )


    cow: Mapped["Cow"] = relationship(back_populates="health_alerts", doc="Cow associated with the alert.")
    owner: Mapped["User"] = relationship(back_populates="owned_health_alerts", foreign_keys=[owner_id], doc="User who owns this health alert.")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="alert", doc="Recommendations linked to this alert.")

    __table_args__ = (
        Index("idx_health_alerts_cow_id", "cow_id"),
        Index("idx_health_alerts_level", "alert_level"),
        Index("idx_health_alerts_resolved", "resolved"),
        Index("idx_health_alerts_owner_id", "owner_id"),
    )
