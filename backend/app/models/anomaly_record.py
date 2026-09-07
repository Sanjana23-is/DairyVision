from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .cow import Cow
    from .daily_observation import DailyObservation
    from .farm import Farm
    from .user import User


class AnomalyRecord(Base):
    """Stores anomaly detection assessments for cows."""

    __tablename__ = "anomaly_records"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique anomaly record identifier.",
    )
    cow_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("cows.id", ondelete="CASCADE"),
        nullable=False,
        doc="Cow associated with the anomaly.",
    )
    observation_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("daily_observations.id", ondelete="SET NULL"),
        nullable=True,
        doc="Daily observation associated with the anomaly.",
    )
    farm_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("farms.id", ondelete="CASCADE"),
        nullable=False,
        doc="Farm associated with the anomaly.",
    )
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User who owns this anomaly record.",
    )
    anomaly_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        server_default="0.0",
        doc="Normalized anomaly score [0.0 - 1.0].",
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="Normal",
        server_default="Normal",
        doc="Severity level: Normal, Warning, Critical.",
    )
    anomaly_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="composite",
        server_default="composite",
        doc="Type of anomaly detected.",
    )
    issue_tags: Mapped[Optional[Any]] = mapped_column(
        JSON,
        nullable=True,
        doc="List of issue tags associated with the anomaly.",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Human-readable description of the anomaly.",
    )
    details: Mapped[Optional[Any]] = mapped_column(
        JSON,
        nullable=True,
        doc="Parsed feature deviation dictionary.",
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the anomaly was detected.",
    )
    resolved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        doc="Whether the anomaly has been resolved.",
    )

    cow: Mapped["Cow"] = relationship(doc="Cow associated with the anomaly.")
    observation: Mapped[Optional["DailyObservation"]] = relationship(doc="Daily observation associated with the anomaly.")
    farm: Mapped["Farm"] = relationship(doc="Farm associated with the anomaly.")
    owner: Mapped["User"] = relationship(doc="User who owns this anomaly record.")

    __table_args__ = (
        Index("idx_anomaly_records_cow_id", "cow_id"),
        Index("idx_anomaly_records_farm_id", "farm_id"),
        Index("idx_anomaly_records_owner_id", "owner_id"),
        Index("idx_anomaly_records_observation_id", "observation_id"),
    )
