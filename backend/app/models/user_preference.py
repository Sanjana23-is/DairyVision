from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
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
    from .user import User


class UserPreference(Base):
    """Stores user-level localization and display preferences."""

    __tablename__ = "user_preference"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique user preference identifier.",
    )
    user_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        doc="User associated with these preferences.",
    )
    preferred_language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="en",
        doc="Preferred language for the user experience.",
    )
    preferred_currency: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="INR",
        doc="Preferred currency for the user.",
    )
    breed_display_preference: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="canonical",
        doc="Preferred way to display breed names.",
    )
    show_local_names: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        doc="Whether local names should be displayed.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the preferences were created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the preferences were last updated.",
    )

    user: Mapped["User"] = relationship(back_populates="preferences", doc="User linked to these preferences.")

    __table_args__ = (
        CheckConstraint("preferred_language <> ''", name="ck_user_preference_language_not_empty"),
        CheckConstraint("preferred_currency <> ''", name="ck_user_preference_currency_not_empty"),
        CheckConstraint("breed_display_preference IN ('canonical', 'alias', 'auto')", name="ck_user_preference_breed_display_mode"),
        Index("idx_user_preference_user_id", "user_id"),
        Index("idx_user_preference_language", "preferred_language"),
    )
