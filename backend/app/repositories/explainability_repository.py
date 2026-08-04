from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.explainability_result import ExplainabilityResult


class ExplainabilityRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_prediction_id(self, prediction_id: str) -> ExplainabilityResult | None:
        return self.db.query(ExplainabilityResult).filter(ExplainabilityResult.prediction_id == prediction_id).one_or_none()

    def get_by_fingerprint(self, fingerprint: str) -> ExplainabilityResult | None:
        return self.db.query(ExplainabilityResult).filter(ExplainabilityResult.fingerprint == fingerprint).one_or_none()

    def save(self, result: ExplainabilityResult) -> ExplainabilityResult:
        self.db.add(result)
        self.db.commit()
        self.db.refresh(result)
        return result
