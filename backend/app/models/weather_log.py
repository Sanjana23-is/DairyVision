from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Numeric,
    String,
    UUID,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .farm import Farm


class WeatherLog(Base):
    """Stores automatic weather observations fetched from Open-Meteo."""

    __tablename__ = "weather_logs"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique weather log identifier.",
    )
    farm_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("farms.id", ondelete="CASCADE"),
        nullable=False,
        doc="Farm associated with the weather record.",
    )
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        doc="User who owns this weather record.",
    )
    temperature: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True, doc="Temperature in Celsius.")
    humidity: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True, doc="Humidity percentage.")
    wind_speed: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True, doc="Wind speed in km/h.")
    rainfall: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True, doc="Rainfall in millimeters.")
    pressure: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True, doc="Atmospheric pressure in hPa.")
    cloud_cover: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True, doc="Cloud cover percentage.")
    thi: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True, doc="Temperature-humidity index.")
    weather_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, doc="Open-Meteo weather code.")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, doc="Timestamp when the weather was recorded.")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the record was stored.",
    )

    farm: Mapped["Farm"] = relationship(back_populates="weather_logs", doc="Farm associated with this weather log.")
    owner: Mapped["User"] = relationship(doc="User who owns this weather log.")
    observations: Mapped[list["DailyObservation"]] = relationship(back_populates="weather_log", doc="Observations attached to this weather snapshot.")

    __table_args__ = (
        Index("idx_weather_logs_farm_id", "farm_id"),
        Index("idx_weather_logs_recorded_at", "recorded_at"),
        Index("idx_weather_logs_owner_id", "owner_id"),
    )
