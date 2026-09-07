from __future__ import annotations

from datetime import datetime, date, time, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.exceptions import WeatherForbidden, WeatherNotFound, WeatherValidationError
from app.models import WeatherLog
from app.repositories.weather_repository import WeatherRepository
from app.schemas.weather import WeatherCreate
from app.services.weather_provider import OpenMeteoWeatherProvider, WeatherProvider, WeatherSnapshot


import logging

logger = logging.getLogger(__name__)


class WeatherService:
    def __init__(self, db: Session, provider: Optional[WeatherProvider] = None) -> None:
        self.db = db
        self.repository = WeatherRepository(db)
        self.provider = provider or OpenMeteoWeatherProvider()

    def list_weather(self, user_id: str) -> list[WeatherLog]:
        return self.repository.list_for_user(user_id)

    def get_weather(self, user_id: str, weather_id: str) -> Optional[WeatherLog]:
        return self.repository.get_for_user(user_id, weather_id)

    def create_weather_log(self, user_id: str, payload: WeatherCreate) -> WeatherLog:
        farm = self.repository.validate_farm_owner(user_id, payload.farm_id)
        payload_data = payload.model_dump(exclude_none=True)

        if farm.latitude is None or farm.longitude is None:
            if farm.location_city:
                coords = self.provider.geocode_location(farm.location_city, farm.location_country)
                if coords:
                    lat, lon = coords
                    farm.latitude = lat
                    farm.longitude = lon
                    self.db.commit()
                    self.db.refresh(farm)
                    logger.info("Auto-geocoded farm %s (%s, %s) to lat=%f, lon=%f", farm.id, farm.location_city, farm.location_country, lat, lon)

        if any(key not in payload_data for key in ("temperature", "humidity", "rainfall", "wind_speed", "pressure", "cloud_cover")):
            try:
                snapshot = self.provider.fetch_snapshot(farm, payload.recorded_at)
            except RuntimeError as exc:
                raise WeatherValidationError(str(exc)) from exc
            payload_data = self._merge_snapshot(payload_data, snapshot)

        thi = self.calculate_thi(payload_data.get("temperature"), payload_data.get("humidity"))
        payload_data["thi"] = thi
        try:
            return self.repository.create(user_id, **payload_data)
        except TypeError as exc:
            raise WeatherValidationError(str(exc)) from exc

    def get_or_create_nearest_snapshot(self, user_id: str, farm_id: str, target_time: datetime) -> WeatherLog:
        farm = self.repository.validate_farm_owner(user_id, farm_id)
        nearest = self.repository.find_nearest_for_farm(farm_id, target_time)
        if nearest is not None:
            return nearest

        if farm.latitude is None or farm.longitude is None:
            if farm.location_city:
                coords = self.provider.geocode_location(farm.location_city, farm.location_country)
                if coords:
                    lat, lon = coords
                    farm.latitude = lat
                    farm.longitude = lon
                    self.db.commit()
                    self.db.refresh(farm)
                    logger.info("Auto-geocoded farm %s (%s, %s) to lat=%f, lon=%f", farm.id, farm.location_city, farm.location_country, lat, lon)

        if farm.latitude is None or farm.longitude is None:
            raise WeatherNotFound("No weather snapshot available and farm location could not be resolved")

        try:
            snapshot = self.provider.fetch_snapshot(farm, target_time)
        except RuntimeError as exc:
            raise WeatherNotFound(str(exc)) from exc


        weather_data = {
            "farm_id": farm_id,
            "recorded_at": target_time,
            **self._merge_snapshot({}, snapshot),
            "thi": self.calculate_thi(snapshot.temperature, snapshot.humidity),
        }
        return self.repository.create(user_id, **weather_data)

    @staticmethod
    def calculate_thi(temperature: Optional[float], humidity: Optional[float]) -> Optional[float]:
        if temperature is None or humidity is None:
            return None
        # Standard cattle THI formula using temperature (°C) and relative humidity (%).
        return round((1.8 * temperature + 32) - (0.55 - 0.0055 * humidity) * (1.8 * temperature - 26), 2)

    @staticmethod
    def _merge_snapshot(payload_data: dict[str, object], snapshot: WeatherSnapshot) -> dict[str, object]:
        fields = {
            "temperature": snapshot.temperature,
            "humidity": snapshot.humidity,
            "rainfall": snapshot.rainfall,
            "wind_speed": snapshot.wind_speed,
            "pressure": snapshot.pressure,
            "cloud_cover": snapshot.cloud_cover,
        }
        payload_data.setdefault("weather_code", snapshot.weather_code)
        for key, value in fields.items():
            payload_data.setdefault(key, value)
        return payload_data
