from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
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
    from .cow import Cow
    from .user import User


class ActivityLog(Base):
    """Stores user or system activity events related to cows."""

    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique activity log identifier.",
    )
    cow_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("cows.id", ondelete="CASCADE"),
        nullable=True,
        doc="Cow associated with the activity.",
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User who triggered the activity.",
    )
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False, doc="Type of activity event.")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Detailed description of the activity.")
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the activity occurred.",
    )
    owner_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User who owns this activity log.",
    )

    cow: Mapped[Optional["Cow"]] = relationship(doc="Cow associated with the activity.")
    user: Mapped[Optional["User"]] = relationship(foreign_keys=[user_id], doc="User associated with the activity.")
    owner: Mapped["User"] = relationship(back_populates="owned_activity_logs", foreign_keys=[owner_id], doc="User who owns this activity log.")

    __table_args__ = (
        Index("idx_activity_logs_cow_id", "cow_id"),
        Index("idx_activity_logs_user_id", "user_id"),
        Index("idx_activity_logs_type", "activity_type"),
        Index("idx_activity_logs_owner_id", "owner_id"),
    )
