from __future__ import annotations

import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SireMaster, BreedMaster
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)

SIRE_DEFINITIONS = [
    {
        "sire_code": "SIRE001",
        "name": "Bullseye Alpha",
        "peak_yield_kg": 35.4,
        "days_to_peak": 45,
        "lactation_length_days": 305,
        "total_milk_yield_kg": 11200.0,
        "genetic_merit_score": 88.5,
    },
    {
        "sire_code": "SIRE002",
        "name": "Valiant Hero",
        "peak_yield_kg": 38.1,
        "days_to_peak": 42,
        "lactation_length_days": 310,
        "total_milk_yield_kg": 11850.0,
        "genetic_merit_score": 93.0,
    },
    {
        "sire_code": "SIRE003",
        "name": "Baron Steady",
        "peak_yield_kg": 33.2,
        "days_to_peak": 48,
        "lactation_length_days": 300,
        "total_milk_yield_kg": 10500.0,
        "genetic_merit_score": 82.0,
    },
    {
        "sire_code": "SIRE004",
        "name": "Titan Royal",
        "peak_yield_kg": 40.5,
        "days_to_peak": 40,
        "lactation_length_days": 320,
        "total_milk_yield_kg": 12500.0,
        "genetic_merit_score": 97.5,
    },
    {
        "sire_code": "SIRE005",
        "name": "Monarch Gold",
        "peak_yield_kg": 36.7,
        "days_to_peak": 44,
        "lactation_length_days": 308,
        "total_milk_yield_kg": 11450.0,
        "genetic_merit_score": 90.0,
    },
    {
        "sire_code": "SIRE006",
        "name": "Thunder Prime",
        "peak_yield_kg": 39.2,
        "days_to_peak": 41,
        "lactation_length_days": 315,
        "total_milk_yield_kg": 12100.0,
        "genetic_merit_score": 95.0,
    },
    {
        "sire_code": "SIRE007",
        "name": "Sterling Crest",
        "peak_yield_kg": 34.8,
        "days_to_peak": 47,
        "lactation_length_days": 302,
        "total_milk_yield_kg": 10820.0,
        "genetic_merit_score": 84.5,
    },
    {
        "sire_code": "SIRE008",
        "name": "Majesty Star",
        "peak_yield_kg": 37.9,
        "days_to_peak": 43,
        "lactation_length_days": 312,
        "total_milk_yield_kg": 11720.0,
        "genetic_merit_score": 92.0,
    },
    {
        "sire_code": "SIRE009",
        "name": "Apex Sovereign",
        "peak_yield_kg": 41.0,
        "days_to_peak": 39,
        "lactation_length_days": 318,
        "total_milk_yield_kg": 12730.0,
        "genetic_merit_score": 99.0,
    },
    {
        "sire_code": "SIRE010",
        "name": "Heritage Duke",
        "peak_yield_kg": 32.7,
        "days_to_peak": 49,
        "lactation_length_days": 298,
        "total_milk_yield_kg": 10280.0,
        "genetic_merit_score": 80.0,
    },
]


def seed_sires(db: Session) -> int:
    """Seed canonical sires into the database if not present."""
    count = 0
    # Try to find a default breed (e.g. Holstein Friesian or Crossbred or Gir)
    default_breed = db.query(BreedMaster).filter(BreedMaster.canonical_name.ilike("%Holstein%")).first()
    if not default_breed:
        default_breed = db.query(BreedMaster).first()

    breed_id = default_breed.id if default_breed else None

    for sire_data in SIRE_DEFINITIONS:
        existing = db.query(SireMaster).filter(SireMaster.sire_code == sire_data["sire_code"]).first()
        if not existing:
            sire = SireMaster(
                sire_code=sire_data["sire_code"],
                name=sire_data["name"],
                breed_id=breed_id,
                peak_yield_kg=sire_data["peak_yield_kg"],
                days_to_peak=sire_data["days_to_peak"],
                lactation_length_days=sire_data["lactation_length_days"],
                total_milk_yield_kg=sire_data["total_milk_yield_kg"],
                genetic_merit_score=sire_data["genetic_merit_score"],
            )
            db.add(sire)
            count += 1

    db.commit()
    logger.info(f"Seeded {count} canonical sires.")
    return count


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_sires(db)
    finally:
        db.close()
