import logging
from sqlalchemy.orm import Session
from app.core.database import engine, SessionLocal
from app.database.base import Base
from app.models import Recommendation

logger = logging.getLogger(__name__)


def deduplicate_database_recommendations(db: Session) -> int:
    """Consolidate existing duplicate uncompleted recommendation records in the database."""
    try:
        recommendations = (
            db.query(Recommendation)
            .filter(Recommendation.completed.is_(False))
            .order_by(Recommendation.created_at.desc())
            .all()
        )

        seen_keys = set()
        to_delete_ids = []

        for rec in recommendations:
            key = (
                rec.owner_id,
                rec.farm_id or "",
                rec.cow_id or "",
                rec.title or "",
            )
            if key in seen_keys:
                to_delete_ids.append(rec.id)
            else:
                seen_keys.add(key)

        if to_delete_ids:
            db.query(Recommendation).filter(Recommendation.id.in_(to_delete_ids)).delete(synchronize_session=False)
            db.commit()
            logger.info("Cleaned up %d duplicate pending recommendations from database", len(to_delete_ids))
            return len(to_delete_ids)
        return 0
    except Exception as exc:
        db.rollback()
        logger.warning("Recommendation database deduplication notice: %s", exc)
        return 0


def ensure_database_schema():
    """Ensure all required DB tables and columns exist on the database engine safely."""
    try:
        Base.metadata.create_all(bind=engine)

        # Run database recommendation deduplication cleanup
        with SessionLocal() as db:
            deduplicate_database_recommendations(db)

    except Exception as exc:
        logger.warning(f"Schema auto-alignment notice: {exc}")
