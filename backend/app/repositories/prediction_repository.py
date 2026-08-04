from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import MilkPrediction


class PredictionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save(self, prediction: MilkPrediction) -> MilkPrediction:
        self.db.add(prediction)
        self.db.commit()
        self.db.refresh(prediction)
        return prediction
