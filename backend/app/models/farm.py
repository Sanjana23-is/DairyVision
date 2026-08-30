from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
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
    from .farm_member import FarmMember
    from .farm_settings import FarmSettings
    from .user import User
    from .weather_log import WeatherLog


class Farm(Base):
    """Represents a dairy farm or production unit within the platform."""

    __tablename__ = "farms"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique farm identifier.",
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, doc="Display name of the farm.")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Optional farm description.")
    location_city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, doc="Farm city location.")
    location_country: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, doc="Farm country location.")
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True, doc="Latitude for the farm location.")
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6), nullable=True, doc="Longitude for the farm location.")
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="UTC", doc="Farm timezone.")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, doc="Whether the farm is active.")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the farm record was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the farm record was last updated.",
    )
    created_by: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        doc="User who created the farm.",
    )

    created_by_user: Mapped["User"] = relationship(
        back_populates="farms_created",
        foreign_keys=[created_by],
        doc="User who created this farm.",
    )
    memberships: Mapped[list["FarmMember"]] = relationship(
        back_populates="farm",
        cascade="all, delete-orphan",
        doc="Members associated with this farm.",
    )
    settings: Mapped[Optional["FarmSettings"]] = relationship(
        back_populates="farm",
        cascade="all, delete-orphan",
        uselist=False,
        doc="Farm-level settings for localization and display preferences.",
    )
    cows: Mapped[list["Cow"]] = relationship(
        back_populates="farm",
        cascade="all, delete-orphan",
        doc="Cows belonging to this farm.",
    )
    weather_logs: Mapped[list["WeatherLog"]] = relationship(
        back_populates="farm",
        cascade="all, delete-orphan",
        doc="Weather records captured for this farm.",
    )

    __table_args__ = (
        CheckConstraint("name <> ''", name="ck_farm_name_not_empty"),
        Index("idx_farms_created_by", "created_by"),
        Index("idx_farms_is_active", "is_active"),
    )
