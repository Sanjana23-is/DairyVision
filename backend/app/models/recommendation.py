from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UUID,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .health_alert import HealthAlert
    from .cow import Cow


class Recommendation(Base):
    """Stores advisory recommendations generated for a cow or alert."""

    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique recommendation identifier.",
    )
    cow_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("cows.id", ondelete="CASCADE"),
        nullable=True,
        doc="Cow associated with the recommendation.",
    )
    alert_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("health_alerts.id", ondelete="CASCADE"),
        nullable=True,
        doc="Health alert associated with the recommendation.",
    )
    prediction_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("milk_predictions.id", ondelete="SET NULL"),
        nullable=True,
        doc="Milk prediction associated with the recommendation.",
    )
    observation_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("daily_observations.id", ondelete="SET NULL"),
        nullable=True,
        doc="Observation associated with the recommendation.",
    )
    anomaly_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("anomaly_records.id", ondelete="SET NULL"),
        nullable=True,
        doc="Anomaly record associated with the recommendation.",
    )

    farm_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("farms.id", ondelete="SET NULL"),
        nullable=True,
        doc="Farm associated with the recommendation.",
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False, doc="Title of the recommendation.")
    description: Mapped[Optional[str]] = mapped_column("content", Text, nullable=True, doc="Detailed recommendation text.")
    why_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Farmer-friendly explanation of why recommendation was generated.")
    category: Mapped[str] = mapped_column(String(100), nullable=False, doc="Recommendation category.")

    priority: Mapped[str] = mapped_column(String(20), nullable=False, doc="Recommendation priority.")
    recommendation_type: Mapped[str] = mapped_column(String(50), nullable=False, doc="Type of recommendation.")
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default='false', doc="Whether the recommendation has been completed.")
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User who owns this recommendation.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the recommendation was created.",
    )

    cow: Mapped[Optional["Cow"]] = relationship(doc="Cow associated with the recommendation.")
    alert: Mapped[Optional["HealthAlert"]] = relationship(back_populates="recommendations", doc="Alert associated with the recommendation.")
    anomaly: Mapped[Optional["AnomalyRecord"]] = relationship(doc="Anomaly associated with the recommendation.")
    owner: Mapped["User"] = relationship(back_populates="owned_recommendations", foreign_keys=[owner_id], doc="User who owns this recommendation.")

    __table_args__ = (
        Index("idx_recommendations_cow_id", "cow_id"),
        Index("idx_recommendations_alert_id", "alert_id"),
        Index("idx_recommendations_prediction_id", "prediction_id"),
        Index("idx_recommendations_observation_id", "observation_id"),
        Index("idx_recommendations_anomaly_id", "anomaly_id"),
        Index("idx_recommendations_farm_id", "farm_id"),
        Index("idx_recommendations_category", "category"),
        Index("idx_recommendations_priority", "priority"),
        Index("idx_recommendations_type", "recommendation_type"),
        Index("idx_recommendations_owner_id", "owner_id"),
    )

