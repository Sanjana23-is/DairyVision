from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.health_alert import HealthAlert


class HealthAlertRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def save(self, alert: HealthAlert) -> HealthAlert:
        self.db.add(alert)
        self.db.commit()
        self.db.refresh(alert)
        return alert

    def list_for_cow(self, cow_id: str):
        return self.db.query(HealthAlert).filter(HealthAlert.cow_id == cow_id).all()
