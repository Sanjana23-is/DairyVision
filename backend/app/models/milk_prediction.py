from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UUID,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .cow import Cow
    from .daily_observation import DailyObservation


class MilkPrediction(Base):
    """Stores AI-generated milk yield predictions for a cow."""

    __tablename__ = "milk_predictions"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique milk prediction identifier.",
    )
    cow_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("cows.id", ondelete="CASCADE"),
        nullable=False,
        doc="Cow for which the prediction was generated.",
    )
    observation_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("daily_observations.id", ondelete="SET NULL"),
        nullable=True,
        doc="Observation that triggered the prediction.",
    )
    predicted_milk_yield: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False, doc="Predicted milk yield.")
    model_version: Mapped[str] = mapped_column(String(100), nullable=False, doc="Version of the model used for prediction.")
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True, doc="Prediction confidence score.")
    prediction_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the prediction was generated.",
    )
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User who owns this prediction.",
    )

    cow: Mapped["Cow"] = relationship(back_populates="milk_predictions", doc="Cow associated with the prediction.")
    observation: Mapped[Optional["DailyObservation"]] = relationship(doc="Observation that led to the prediction.")
    owner: Mapped["User"] = relationship(back_populates="owned_milk_predictions", foreign_keys=[owner_id], doc="User who owns this prediction.")

    __table_args__ = (
        Index("idx_milk_predictions_cow_id", "cow_id"),
        Index("idx_milk_predictions_observation_id", "observation_id"),
        Index("idx_milk_predictions_timestamp", "prediction_timestamp"),
        Index("idx_milk_predictions_owner_id", "owner_id"),
    )
