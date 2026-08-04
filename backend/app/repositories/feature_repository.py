from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from app.models import DailyObservation, Cow, Farm, WeatherLog


class FeatureRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_observation(self, observation_id: str) -> DailyObservation | None:
        return self.db.query(DailyObservation).filter(DailyObservation.id == observation_id).first()

    def get_cow(self, cow_id: str) -> Cow | None:
        return self.db.query(Cow).filter(Cow.id == cow_id).first()

    def get_farm(self, farm_id: str) -> Farm | None:
        return self.db.query(Farm).filter(Farm.id == farm_id).first()

    def get_weather_log(self, weather_id: str) -> WeatherLog | None:
        if weather_id is None:
            return None
        return self.db.query(WeatherLog).filter(WeatherLog.id == weather_id).first()

    def recent_observations(self, cow_id: str, before_date: datetime, days: int = 7) -> List[DailyObservation]:
        start = (before_date - timedelta(days=days)).date()
        return (
            self.db.query(DailyObservation)
            .filter(DailyObservation.cow_id == cow_id)
            .filter(DailyObservation.observation_date >= start)
            .order_by(DailyObservation.observation_date.desc())
            .all()
        )
