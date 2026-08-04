from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.models import Farm


@dataclass
class WeatherSnapshot:
    temperature: float
    humidity: float
    rainfall: float
    wind_speed: float
    pressure: float
    cloud_cover: float
    weather_code: Optional[str] = None


class WeatherProvider(ABC):
    @abstractmethod
    def fetch_snapshot(self, farm: Farm, recorded_at: datetime) -> WeatherSnapshot:
        raise NotImplementedError


class OpenMeteoWeatherProvider(WeatherProvider):
    API_URL = "https://api.open-meteo.com/v1/forecast"

    def __init__(self, client: Optional[httpx.Client] = None) -> None:
        self.client = client or httpx.Client(timeout=10.0)

    def fetch_snapshot(self, farm: Farm, recorded_at: datetime) -> WeatherSnapshot:
        if farm.latitude is None or farm.longitude is None:
            raise RuntimeError("Farm latitude/longitude are required for weather provider integration")

        timestamp = recorded_at.astimezone(timezone.utc)
        date_str = timestamp.date().isoformat()
        params = {
            "latitude": float(farm.latitude),
            "longitude": float(farm.longitude),
            "hourly": ",".join([
                "temperature_2m",
                "relativehumidity_2m",
                "rain",
                "windspeed_10m",
                "surface_pressure",
                "cloudcover",
            ]),
            "start_date": date_str,
            "end_date": date_str,
            "timezone": "UTC",
        }

        response = self.client.get(self.API_URL, params=params)
        response.raise_for_status()
        payload = response.json()

        hourly = payload.get("hourly", {})
        times = hourly.get("time", [])
        if not times:
            raise RuntimeError("Weather provider did not return hourly data")

        nearest_index = min(
            range(len(times)),
            key=lambda idx: abs(
                (datetime.fromisoformat(times[idx]).replace(tzinfo=timezone.utc) - timestamp).total_seconds()
            ),
        )

        return WeatherSnapshot(
            temperature=float(hourly["temperature_2m"][nearest_index]),
            humidity=float(hourly["relativehumidity_2m"][nearest_index]),
            rainfall=float(hourly["rain"][nearest_index]),
            wind_speed=float(hourly["windspeed_10m"][nearest_index]),
            pressure=float(hourly["surface_pressure"][nearest_index]),
            cloud_cover=float(hourly["cloudcover"][nearest_index]),
            weather_code=None,
        )
