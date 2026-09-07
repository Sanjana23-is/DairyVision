from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database.base import Base
from ..database.types import GUID

if TYPE_CHECKING:
    from .breed_master import BreedMaster
    from .cow import Cow


class SireMaster(Base):
    """Canonical master table for cattle sires used across genetics analytics."""

    __tablename__ = "sire_master"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique sire identifier.",
    )
    sire_code: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
        doc="Unique canonical sire code e.g. SIRE001.",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Human-friendly name or designation for the sire.",
    )
    breed_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("breed_master.id", ondelete="SET NULL"),
        nullable=True,
        doc="Breed reference for the sire.",
    )
    peak_yield_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True, doc="Peak daily yield in kg.")
    days_to_peak: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="Days to peak yield.")
    lactation_length_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="Standard lactation length in days.")
    total_milk_yield_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True, doc="Total 305-day lactation milk yield in kg.")
    genetic_merit_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=85.0,
        doc="Calculated genetic merit rating (0-100 scale).",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    breed: Mapped[Optional["BreedMaster"]] = relationship(doc="Breed associated with this sire.")
    offspring_cows: Mapped[list["Cow"]] = relationship(back_populates="sire", doc="Offspring cows sired by this bull.")
