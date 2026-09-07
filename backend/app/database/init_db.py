import logging
from sqlalchemy import text
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

        with engine.connect() as conn:
            # Check existing columns on 'cows' table
            res = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='cows';"
                )
            ).fetchall()
            cols = [r[0] for r in res]

            # If both columns already exist, no DDL needed!
            if not cols or ("sire_id" in cols and "dam_name" in cols):
                return

            with conn.begin():
                conn.execute(
                    text(
                        """
                    CREATE TABLE IF NOT EXISTS sire_master (
                        id UUID PRIMARY KEY,
                        sire_code VARCHAR(100) NOT NULL UNIQUE,
                        name VARCHAR(255) NOT NULL,
                        breed_id UUID REFERENCES breed_master(id) ON DELETE SET NULL,
                        peak_yield_kg FLOAT,
                        days_to_peak INTEGER,
                        lactation_length_days INTEGER,
                        total_milk_yield_kg FLOAT,
                        genetic_merit_score FLOAT NOT NULL DEFAULT 85.0,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                """
                    )
                )
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_sire_master_sire_code ON sire_master(sire_code);"
                    )
                )

                if "sire_id" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE cows ADD COLUMN sire_id UUID REFERENCES sire_master(id) ON DELETE SET NULL;"
                        )
                    )
                    logger.info("Added missing column 'sire_id' to table 'cows'.")

                if "dam_name" not in cols:
                    conn.execute(
                        text(
                            "ALTER TABLE cows ADD COLUMN dam_name VARCHAR(255);"
                        )
                    )
                    logger.info("Added missing column 'dam_name' to table 'cows'.")

    except Exception as exc:
        logger.warning(f"Schema auto-alignment notice: {exc}")
