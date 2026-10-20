from __future__ import annotations

import os
from typing import Any
from fastapi import APIRouter
from sqlalchemy import text

from app.database.session import SessionLocal

router = APIRouter(tags=["health"])


@router.get("/health", include_in_schema=True)
def health_check() -> dict[str, str]:
    """Public liveness health check endpoint for monitoring, containers, and uptime pings."""
    return {"status": "ok"}


@router.get("/health/system", include_in_schema=True)
def system_health() -> dict[str, Any]:
    """Comprehensive system readiness and telemetry check for DB, ML engine, and storage."""
    db_status = "unhealthy"
    cow_count = 0
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
            db_status = "healthy"
            cow_count = db.execute(text('SELECT count(*) FROM "cows"')).scalar() or 0
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("System health probe database check failed: %s", exc)
        db_status = "unhealthy"

    # Check ML Model file presence
    from app.core.project_paths import ensure_project_root_on_path
    ensure_project_root_on_path()
    try:
        from ml_engine.config import MODEL_PATH
        model_exists = os.path.exists(MODEL_PATH)
    except Exception:
        model_exists = False

    return {
        "status": "ok" if db_status == "healthy" and model_exists else "degraded",
        "database": db_status,
        "ml_model_loaded": model_exists,
        "active_herd_size": cow_count,
    }
