from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    UUID,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .milk_prediction import MilkPrediction


class ExplainabilityResult(Base):
    __tablename__ = "explainability_results"

    id: Mapped[str] = mapped_column(
        GUID(), primary_key=True, default=lambda: str(uuid4())
    )

    # Link to a persisted prediction when available
    prediction_id: Mapped[Optional[str]] = mapped_column(
        GUID(), ForeignKey("milk_predictions.id", ondelete="CASCADE"), nullable=True
    )

    # Fingerprint for caching by feature vector + model version
    fingerprint: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    owner_id: Mapped[Optional[str]] = mapped_column(GUID(), nullable=True)
    observation_id: Mapped[Optional[str]] = mapped_column(GUID(), nullable=True)
    cow_id: Mapped[Optional[str]] = mapped_column(GUID(), nullable=True)
    farm_id: Mapped[Optional[str]] = mapped_column(GUID(), nullable=True)

    model_version: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    top_positive: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    top_negative: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # relationship intentionally omitted to avoid import cycles; access via prediction_id when needed

    __table_args__ = (
        Index("idx_explainability_prediction_id", "prediction_id"),
        Index("idx_explainability_fingerprint", "fingerprint"),
        Index("idx_explainability_owner_id", "owner_id"),
    )
