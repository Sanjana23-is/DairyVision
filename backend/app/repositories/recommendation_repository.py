from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Recommendation


class RecommendationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save(self, recommendation: Recommendation) -> Recommendation:
        self.db.add(recommendation)
        self.db.commit()
        self.db.refresh(recommendation)
        return recommendation

    def list_for_alert(self, alert_id: str) -> list[Recommendation]:
        return self.db.query(Recommendation).filter(Recommendation.alert_id == alert_id).all()

    def list_for_cow(self, cow_id: str) -> list[Recommendation]:
        return self.db.query(Recommendation).filter(Recommendation.cow_id == cow_id).all()
