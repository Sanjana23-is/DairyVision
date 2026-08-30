from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    JSON,
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
    from .user import User


class DailyObservation(Base):
    """Stores the minimum farmer-entered observation data for a cow."""

    __tablename__ = "daily_observations"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique observation identifier.",
    )
    cow_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("cows.id", ondelete="CASCADE"),
        nullable=False,
        doc="Cow associated with this observation.",
    )
    observation_date: Mapped[date] = mapped_column(Date, nullable=False, doc="Date of the observation.")
    milk_produced_liters: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True, doc="Milk produced in liters.")
    feed_quantity_kg: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True, doc="Feed quantity in kilograms.")
    symptoms: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, doc="Farmer-selected symptom data.")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Optional freeform notes.")
    observed_by: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User who recorded the observation.",
    )
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User who owns this observation.",
    )
    weather_log_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("weather_logs.id", ondelete="SET NULL"),
        nullable=True,
        doc="Nearest weather snapshot attached to this observation.",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the observation was recorded.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the observation was last updated.",
    )

    cow: Mapped["Cow"] = relationship(back_populates="daily_observations", doc="Cow related to the observation.")
    weather_log: Mapped[Optional["WeatherLog"]] = relationship(back_populates="observations", doc="Nearest weather snapshot for this observation.")
    observer: Mapped[Optional["User"]] = relationship(foreign_keys=[observed_by], doc="User who recorded the observation.")
    owner: Mapped["User"] = relationship(back_populates="owned_observations", foreign_keys=[owner_id], doc="User who owns this observation.")

    @property
    def farm_id(self) -> str:
        return self.cow.farm_id

    __table_args__ = (
        Index("idx_daily_observations_cow_id", "cow_id"),
        Index("idx_daily_observations_date", "observation_date"),
        Index("idx_daily_observations_observed_by", "observed_by"),
        Index("idx_daily_observations_owner_id", "owner_id"),
    )
