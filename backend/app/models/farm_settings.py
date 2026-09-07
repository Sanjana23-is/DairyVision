from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    UUID,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .farm import Farm


class FarmSettings(Base):
    """Stores farm-level localization, economic settings, and display preferences."""

    __tablename__ = "farm_settings"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique farm settings identifier.",
    )
    farm_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("farms.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        doc="Farm associated with these settings.",
    )
    default_language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="en",
        doc="Default language for the farm experience.",
    )
    default_currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="INR",
        doc="Default currency for the farm.",
    )
    milk_price_per_liter: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Configured farm milk price per liter.",
    )
    feed_cost_per_kg: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
        doc="Configured farm feed cost per kg.",
    )
    timezone: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="Asia/Kolkata",
        doc="Default timezone for the farm.",
    )
    breed_display_mode: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="canonical",
        doc="Preferred way to display breed names.",
    )
    use_local_breed_names: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        doc="Whether local or regional breed names should be preferred.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the farm settings were created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the farm settings were last updated.",
    )

    farm: Mapped["Farm"] = relationship(back_populates="settings", doc="Farm linked to these settings.")

    __table_args__ = (
        CheckConstraint("default_language <> ''", name="ck_farm_settings_default_language_not_empty"),
        CheckConstraint("default_currency <> ''", name="ck_farm_settings_default_currency_not_empty"),
        CheckConstraint("breed_display_mode IN ('canonical', 'alias', 'auto')", name="ck_farm_settings_breed_display_mode"),
        Index("idx_farm_settings_farm_id", "farm_id"),
        Index("idx_farm_settings_language", "default_language"),
    )
