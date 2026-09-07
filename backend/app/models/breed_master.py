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
    from .breed_alias import BreedAlias
    from .cow import Cow


class BreedMaster(Base):
    """Canonical master table for cattle breeds used across the platform."""

    __tablename__ = "breed_master"

    id: Mapped[str] = mapped_column(
        GUID(),
        primary_key=True,
        default=lambda: str(uuid4()),
        doc="Unique breed identifier.",
    )
    canonical_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        doc="Canonical breed name used across the platform.",
    )
    breed_category: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        doc="Breed category such as indigenous, exotic, crossbreed, or other.",
    )
    species: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="cattle",
        doc="Species associated with the breed.",
    )
    origin_region: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
        doc="Geographic origin region for the breed.",
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, doc="Optional breed description.")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, doc="Whether the breed is active.")
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, doc="Whether the breed is featured.")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        doc="Timestamp when the breed was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        doc="Timestamp when the breed was last updated.",
    )

    aliases: Mapped[list["BreedAlias"]] = relationship(
        back_populates="breed",
        cascade="all, delete-orphan",
        doc="Regional and language aliases for the breed.",
    )
    cows: Mapped[list["Cow"]] = relationship(
        back_populates="breed",
        doc="Cows associated with this breed.",
    )

    __table_args__ = (
        CheckConstraint("canonical_name <> ''", name="ck_breed_master_canonical_name_not_empty"),
        CheckConstraint("breed_category IN ('indigenous', 'exotic', 'crossbreed', 'other')", name="ck_breed_master_category"),
        CheckConstraint("species <> ''", name="ck_breed_master_species_not_empty"),
        Index("idx_breed_master_category", "breed_category"),
        Index("idx_breed_master_is_active", "is_active"),
        Index("idx_breed_master_name", "canonical_name"),
    )
