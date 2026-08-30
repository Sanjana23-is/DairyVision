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
    from .farm import Farm
    from .user import User


class FarmMember(Base):
    """Maps users to farms with role-based access permissions."""

    __tablename__ = "farm_members"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique membership identifier.",
    )
    farm_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("farms.id", ondelete="CASCADE"),
        nullable=False,
        doc="Farm that the user belongs to.",
    )
    user_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        doc="User attached to the farm.",
    )
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="member",
        doc="Access role for the farm membership.",
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, doc="Whether the membership is active.")
    invited_by: Mapped[str | None] = mapped_column(
        GUID(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User who invited the member.",
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the membership was created.",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the membership record was created.",
    )

    farm: Mapped["Farm"] = relationship(back_populates="memberships", doc="Farm related to the membership.")
    user: Mapped["User"] = relationship(
        back_populates="memberships",
        foreign_keys=[user_id],
        doc="User related to the membership.",
    )
    inviter: Mapped["User | None"] = relationship(
        back_populates="invited_members",
        foreign_keys=[invited_by],
        doc="User who invited the member.",
    )

    __table_args__ = (
        CheckConstraint("role IN ('owner', 'manager', 'member', 'viewer')", name="ck_farm_member_role"),
        Index("idx_farm_members_farm_id", "farm_id"),
        Index("idx_farm_members_user_id", "user_id"),
        Index("idx_farm_members_role", "role"),
    )
