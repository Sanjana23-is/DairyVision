from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.breed_master import BreedMaster


def list_active_breeds(db: Session) -> list[BreedMaster]:
    """Return all active breeds, sorted by canonical name.

    Breeds are reference data shared across all users (not owner-scoped),
    so this deliberately bypasses the owner-scoping helpers in
    app.repositories.ownership.
    """
    return (
        db.query(BreedMaster)
        .filter(BreedMaster.is_active.is_(True))
        .order_by(BreedMaster.canonical_name)
        .all()
    )
