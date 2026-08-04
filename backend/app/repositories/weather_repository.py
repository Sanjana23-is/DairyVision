from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Farm, WeatherLog
from app.repositories.ownership import create_owned_instance, ensure_record_accessible, scope_query


class WeatherRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_user(self, user_id: str) -> list[WeatherLog]:
        query = self.db.query(WeatherLog)
        return scope_query(query, WeatherLog, user_id).all()

    def get_for_user(self, user_id: str, weather_id: str) -> Optional[WeatherLog]:
        weather_log = self.db.query(WeatherLog).filter(WeatherLog.id == weather_id).first()
        if weather_log is None:
            return None
        ensure_record_accessible(weather_log, user_id)
        return weather_log

    def get_farm(self, farm_id: str) -> Optional[Farm]:
        return self.db.query(Farm).filter(Farm.id == farm_id).first()

    def validate_farm_owner(self, user_id: str, farm_id: str) -> Farm:
        farm = self.get_farm(farm_id)
        if farm is None:
            raise ValueError("Farm not found")
        if farm.created_by != user_id:
            raise PermissionError("Farm does not belong to the authenticated user")
        return farm

    def create(self, user_id: str, **kwargs: object) -> WeatherLog:
        weather_log = create_owned_instance(WeatherLog, user_id=user_id, **kwargs)
        self.db.add(weather_log)
        self.db.commit()
        self.db.refresh(weather_log)
        return weather_log

    def find_nearest_for_farm(self, farm_id: str, target_time: datetime) -> Optional[WeatherLog]:
        weather_logs = self.db.query(WeatherLog).filter(WeatherLog.farm_id == farm_id).all()
        if not weather_logs:
            return None
        if target_time.tzinfo is None:
            target_time = target_time.replace(tzinfo=timezone.utc)
        closest = min(
            weather_logs,
            key=lambda record: abs((record.recorded_at.astimezone(timezone.utc) - target_time).total_seconds()),
        )
        return closest
