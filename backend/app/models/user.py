from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
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
    from .activity_log import ActivityLog
    from .cow import Cow
    from .daily_observation import DailyObservation
    from .farm import Farm
    from .farm_member import FarmMember
    from .health_alert import HealthAlert
    from .milk_prediction import MilkPrediction
    from .recommendation import Recommendation
    from .user_preference import UserPreference


class User(Base):
    """Represents an authenticated user account for the DairyVision platform."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique user identifier.",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        doc="Primary email address for the account.",
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Display name of the user.",
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Optional avatar image URL.")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, doc="Whether the account is active.")
    is_superuser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, doc="Whether the user has elevated platform access.")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the user record was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the user record was last updated.",
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Timestamp of the last successful login.",
    )

    farms_created: Mapped[list["Farm"]] = relationship(
        back_populates="created_by_user",
        foreign_keys="Farm.created_by",
        cascade="all, delete-orphan",
        doc="Farms created by this user.",
    )
    memberships: Mapped[list["FarmMember"]] = relationship(
        back_populates="user",
        foreign_keys="FarmMember.user_id",
        cascade="all, delete-orphan",
        doc="Farm memberships for this user.",
    )
    invited_members: Mapped[list["FarmMember"]] = relationship(
        back_populates="inviter",
        foreign_keys="FarmMember.invited_by",
        doc="Farm memberships invited by this user.",
    )
    preferences: Mapped[Optional["UserPreference"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
        doc="User-level display and localization preferences.",
    )
    observations: Mapped[list["DailyObservation"]] = relationship(
        back_populates="observer",
        foreign_keys="DailyObservation.observed_by",
        doc="Daily observations recorded by this user.",
    )
    owned_cows: Mapped[list["Cow"]] = relationship(
        back_populates="owner",
        foreign_keys="Cow.owner_id",
        doc="Cows owned by this user.",
    )
    owned_observations: Mapped[list["DailyObservation"]] = relationship(
        back_populates="owner",
        foreign_keys="DailyObservation.owner_id",
        doc="Observations owned by this user.",
    )
    owned_health_alerts: Mapped[list["HealthAlert"]] = relationship(
        back_populates="owner",
        foreign_keys="HealthAlert.owner_id",
        doc="Health alerts owned by this user.",
    )
    owned_milk_predictions: Mapped[list["MilkPrediction"]] = relationship(
        back_populates="owner",
        foreign_keys="MilkPrediction.owner_id",
        doc="Milk predictions owned by this user.",
    )
    owned_recommendations: Mapped[list["Recommendation"]] = relationship(
        back_populates="owner",
        foreign_keys="Recommendation.owner_id",
        doc="Recommendations owned by this user.",
    )
    owned_activity_logs: Mapped[list["ActivityLog"]] = relationship(
        back_populates="owner",
        foreign_keys="ActivityLog.owner_id",
        doc="Activity logs owned by this user.",
    )
    activity_logs: Mapped[list["ActivityLog"]] = relationship(
        back_populates="user",
        foreign_keys="ActivityLog.user_id",
        doc="Activity events associated with this user.",
    )

    __table_args__ = (
        CheckConstraint("email <> ''", name="ck_user_email_not_empty"),
        CheckConstraint("full_name <> ''", name="ck_user_full_name_not_empty"),
        Index("idx_users_email", "email"),
        Index("idx_users_created_at", "created_at"),
    )
