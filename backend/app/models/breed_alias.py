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
    from .breed_master import BreedMaster


class BreedAlias(Base):
    """Stores multilingual and regional aliases for a canonical breed."""

    __tablename__ = "breed_alias"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique breed alias identifier.",
    )
    breed_id: Mapped[str] = mapped_column(
        GUID(),
        ForeignKey("breed_master.id", ondelete="CASCADE"),
        nullable=False,
        doc="Canonical breed that this alias belongs to.",
    )
    alias_text: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        doc="The alias text for the breed.",
    )
    language_code: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="en",
        doc="Language code for the alias.",
    )
    alias_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="regional",
        doc="Type of alias such as regional, spelling, translation, or local_name.",
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, doc="Whether the alias is primary for that language.")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the alias was created.",
    )

    breed: Mapped["BreedMaster"] = relationship(back_populates="aliases", doc="Canonical breed linked to this alias.")

    __table_args__ = (
        CheckConstraint("alias_text <> ''", name="ck_breed_alias_text_not_empty"),
        CheckConstraint("language_code <> ''", name="ck_breed_alias_language_code_not_empty"),
        CheckConstraint("alias_type IN ('regional', 'spelling', 'translation', 'local_name')", name="ck_breed_alias_type"),
        Index("idx_breed_alias_breed_id", "breed_id"),
        Index("idx_breed_alias_language_code", "language_code"),
        Index("idx_breed_alias_type", "alias_type"),
    )
