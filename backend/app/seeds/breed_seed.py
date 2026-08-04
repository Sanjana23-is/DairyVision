from __future__ import annotations

from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.breed_master import BreedMaster
from app.models.breed_alias import BreedAlias
from app.core.database import SessionLocal


BREED_DEFINITIONS = [
    {
        "canonical_name": "Gir",
        "breed_category": "indigenous",
        "species": "cattle",
        "origin_region": "India",
        "description": "Indigenous Indian dairy breed known for heat tolerance and milk yield.",
        "is_active": True,
        "is_featured": True,
        "aliases": ["Gir Cow", "Gir Cattle"],
    },
    {
        "canonical_name": "Sahiwal",
        "breed_category": "indigenous",
        "species": "cattle",
        "origin_region": "Pakistan",
        "description": "Well-known zebu dairy breed with high milk production.",
        "is_active": True,
        "is_featured": True,
        "aliases": ["Sahiwal Cow"],
    },
    {
        "canonical_name": "Hallikar",
        "breed_category": "indigenous",
        "species": "cattle",
        "origin_region": "India",
        "description": "Traditional draft and dual-purpose cattle breed from Karnataka.",
        "is_active": True,
        "is_featured": False,
        "aliases": ["Hallikar Cattle"],
    },
    {
        "canonical_name": "Amrit Mahal",
        "breed_category": "indigenous",
        "species": "cattle",
        "origin_region": "India",
        "description": "Historic cattle breed from Karnataka valued for resilience.",
        "is_active": True,
        "is_featured": False,
        "aliases": ["Amritmahal", "Amrit Mahal Cow"],
    },
    {
        "canonical_name": "Kankrej",
        "breed_category": "indigenous",
        "species": "cattle",
        "origin_region": "India",
        "description": "Dual-purpose Indian breed with strong adaptability.",
        "is_active": True,
        "is_featured": False,
        "aliases": ["Kankrej Cow"],
    },
    {
        "canonical_name": "Red Sindhi",
        "breed_category": "indigenous",
        "species": "cattle",
        "origin_region": "Pakistan",
        "description": "High-yielding tropical dairy breed from the Sindh region.",
        "is_active": True,
        "is_featured": True,
        "aliases": ["Red Sindhi Cow"],
    },
    {
        "canonical_name": "Tharparkar",
        "breed_category": "indigenous",
        "species": "cattle",
        "origin_region": "India",
        "description": "Adaptable Indian dairy breed well-suited to tropical climates.",
        "is_active": True,
        "is_featured": False,
        "aliases": ["Tharparkar Cow"],
    },
    {
        "canonical_name": "Jersey",
        "breed_category": "exotic",
        "species": "cattle",
        "origin_region": "Jersey",
        "description": "Popular dairy breed known for rich milk and compact frame.",
        "is_active": True,
        "is_featured": True,
        "aliases": ["Jersey Cow"],
    },
    {
        "canonical_name": "Holstein Friesian",
        "breed_category": "exotic",
        "species": "cattle",
        "origin_region": "Netherlands",
        "description": "High-production dairy breed widely used worldwide.",
        "is_active": True,
        "is_featured": True,
        "aliases": ["HF", "Holstein", "Holstein Friesian Cow"],
    },
    {
        "canonical_name": "HF Cross",
        "breed_category": "crossbreed",
        "species": "cattle",
        "origin_region": "Mixed",
        "description": "Crossbred dairy cattle commonly used in mixed-production systems.",
        "is_active": True,
        "is_featured": True,
        "aliases": ["HF Crossbred", "HF Cross Cow"],
    },
    {
        "canonical_name": "Jersey Cross",
        "breed_category": "crossbreed",
        "species": "cattle",
        "origin_region": "Mixed",
        "description": "Crossbred cattle combining Jersey genetics with local breeds.",
        "is_active": True,
        "is_featured": False,
        "aliases": ["Jersey Crossbred", "Jersey Cross Cow"],
    },
    {
        "canonical_name": "Brown Swiss",
        "breed_category": "exotic",
        "species": "cattle",
        "origin_region": "Switzerland",
        "description": "Dual-purpose dairy breed recognized for durability and milk quality.",
        "is_active": True,
        "is_featured": False,
        "aliases": ["Brown Swiss Cow"],
    },
]


def _normalize_alias(alias: str) -> str:
    return alias.strip()


def seed_breeds(session: Session | None = None) -> int:
    """Seed the breed master and alias records idempotently."""
    local_session = session or SessionLocal()
    try:
        created_count = 0
        for definition in BREED_DEFINITIONS:
            existing = (
                local_session.execute(
                    select(BreedMaster).where(BreedMaster.canonical_name == definition["canonical_name"])
                )
                .scalars()
                .first()
            )
            if existing is None:
                breed = BreedMaster(
                    canonical_name=definition["canonical_name"],
                    breed_category=definition["breed_category"],
                    species=definition["species"],
                    origin_region=definition["origin_region"],
                    description=definition["description"],
                    is_active=definition["is_active"],
                    is_featured=definition["is_featured"],
                )
                local_session.add(breed)
                local_session.flush()
                created_count += 1
            else:
                breed = existing

            aliases = definition.get("aliases", [])
            for alias_text in aliases:
                normalized = _normalize_alias(alias_text)
                if not normalized:
                    continue
                existing_alias = (
                    local_session.execute(
                        select(BreedAlias).where(
                            BreedAlias.breed_id == breed.id,
                            BreedAlias.alias_text == normalized,
                        )
                    )
                    .scalars()
                    .first()
                )
                if existing_alias is None:
                    local_session.add(
                        BreedAlias(
                            breed_id=breed.id,
                            alias_text=normalized,
                            language_code="en",
                            alias_type="regional" if normalized.lower().endswith("cow") else "local_name",
                            is_primary=False,
                        )
                    )
                    created_count += 1

        local_session.commit()
        return created_count
    except Exception:
        local_session.rollback()
        raise
    finally:
        if session is None:
            local_session.close()


def seed_all() -> int:
    return seed_breeds()
