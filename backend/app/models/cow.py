from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
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
    from .activity_log import ActivityLog
    from .breed_master import BreedMaster
    from .daily_observation import DailyObservation
    from .farm import Farm
    from .health_alert import HealthAlert
    from .milk_prediction import MilkPrediction
    from .user import User


class Cow(Base):
    """Represents an individual cow within a farm."""

    __tablename__ = "cows"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique cow identifier.",
    )
    farm_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("farms.id", ondelete="CASCADE"),
        nullable=False,
        doc="Farm that owns this cow.",
    )
    tag_id: Mapped[str] = mapped_column(String(100), nullable=False, doc="Unique external tag or identifier for the cow.")
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, doc="Optional human-friendly name for the cow.")
    breed_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("breed_master.id", ondelete="RESTRICT"),
        nullable=True,
        doc="Canonical breed reference for the cow.",
    )
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True, doc="Birth date of the cow.")
    age_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="Age of the cow in months.")
    sex: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, doc="Sex of the cow.")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active", doc="Current cow status.")
    weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True, doc="Current weight in kilograms.")
    lactation_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, doc="Current lactation number if known.")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Optional notes about the cow.")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the cow record was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the cow record was last updated.",
    )
    created_by: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User who created the cow record.",
    )
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User who owns this cow record.",
    )

    breed: Mapped[Optional["BreedMaster"]] = relationship(back_populates="cows", doc="Canonical breed assigned to this cow.")
    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by], doc="User who created this cow record.")
    owner: Mapped["User"] = relationship(back_populates="owned_cows", foreign_keys=[owner_id], doc="User who owns this cow record.")
    farm: Mapped["Farm"] = relationship(back_populates="cows", doc="Farm that owns this cow.")
    daily_observations: Mapped[list["DailyObservation"]] = relationship(
        back_populates="cow",
        cascade="all, delete-orphan",
        doc="Daily observations recorded for this cow.",
    )
    milk_predictions: Mapped[list["MilkPrediction"]] = relationship(
        back_populates="cow",
        cascade="all, delete-orphan",
        doc="Milk yield predictions generated for this cow.",
    )
    health_alerts: Mapped[list["HealthAlert"]] = relationship(
        back_populates="cow",
        cascade="all, delete-orphan",
        doc="Health alerts associated with this cow.",
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(
        back_populates="cow",
        cascade="all, delete-orphan",
        doc="Activity logs linked to this cow.",
    )

    __table_args__ = (
        CheckConstraint("status IN ('active', 'dry', 'sick', 'deceased', 'sold')", name="ck_cow_status"),
        CheckConstraint("lactation_number IS NULL OR lactation_number > 0", name="ck_cow_lactation"),
        CheckConstraint("weight_kg IS NULL OR weight_kg > 0", name="ck_cow_weight"),
        CheckConstraint("age_months IS NULL OR age_months >= 0", name="ck_cow_age_months"),
        Index("idx_cows_farm_id", "farm_id"),
        Index("idx_cows_status", "status"),
        Index("idx_cows_tag_id", "tag_id"),
        Index("idx_cows_breed_id", "breed_id"),
        Index("idx_cows_owner_id", "owner_id"),
    )
