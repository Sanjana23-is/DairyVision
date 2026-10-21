from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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

    def geocode_location(self, location_city: Optional[str], location_country: Optional[str] = None) -> Optional[tuple[float, float]]:
        return None


class OpenMeteoWeatherProvider(WeatherProvider):
    FORECAST_API_URL = "https://api.open-meteo.com/v1/forecast"
    ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"
    GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search"

    def __init__(self, client: Optional[httpx.Client] = None) -> None:
        self.client = client or httpx.Client(timeout=10.0)

    def geocode_location(self, location_city: Optional[str], location_country: Optional[str] = None) -> Optional[tuple[float, float]]:
        if not location_city or not location_city.strip():
            return None

        city_clean = location_city.strip()
        country_clean = location_country.strip() if location_country and location_country.strip() else ""
        query = f"{city_clean}, {country_clean}" if country_clean else city_clean

        try:
            response = self.client.get(self.GEOCODING_API_URL, params={"name": query, "count": 5, "format": "json"})
            response.raise_for_status()
            payload = response.json()
            results = payload.get("results", [])

            if not results and country_clean:
                response = self.client.get(self.GEOCODING_API_URL, params={"name": city_clean, "count": 5, "format": "json"})
                response.raise_for_status()
                results = response.json().get("results", [])

            if not results:
                return None

            best_match = results[0]
            if country_clean:
                country_lower = country_clean.lower()
                for r in results:
                    r_country = str(r.get("country", "")).lower()
                    r_code = str(r.get("country_code", "")).lower()
                    if r_country == country_lower or r_code == country_lower:
                        best_match = r
                        break

            return float(best_match["latitude"]), float(best_match["longitude"])
        except Exception:
            return None

    def fetch_snapshot(self, farm: Farm, recorded_at: datetime) -> WeatherSnapshot:
        if farm.latitude is None or farm.longitude is None:
            raise RuntimeError("Farm latitude/longitude are required for weather provider integration")

        timestamp = recorded_at.astimezone(timezone.utc)
        today = datetime.now(timezone.utc).date()
        date_str = timestamp.date().isoformat()

        # Decide whether to use forecast or archive API
        if timestamp.date() < today - timedelta(days=7):
            primary_url = self.ARCHIVE_API_URL
            fallback_url = self.FORECAST_API_URL
        else:
            primary_url = self.FORECAST_API_URL
            fallback_url = self.ARCHIVE_API_URL

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

        try:
            response = self.client.get(primary_url, params=params)
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            try:
                response = self.client.get(fallback_url, params=params)
                response.raise_for_status()
                payload = response.json()
            except Exception:
                raise RuntimeError(f"Weather provider request failed: {exc}") from exc

        hourly = payload.get("hourly", {})
        times = hourly.get("time", [])
        if not times:
            raise RuntimeError("Weather provider did not return hourly data")

        temp_list = hourly.get("temperature_2m", [])
        hum_list = hourly.get("relativehumidity_2m", []) or hourly.get("relative_humidity_2m", [])

        # Find valid indices where temperature and humidity are both present
        valid_indices = [
            i
            for i in range(len(times))
            if i < len(temp_list)
            and temp_list[i] is not None
            and i < len(hum_list)
            and hum_list[i] is not None
        ]

        if not valid_indices:
            raise RuntimeError(
                f"Weather provider response for {date_str} contained no valid temperature and humidity readings"
            )

        nearest_index = min(
            valid_indices,
            key=lambda idx: abs(
                (datetime.fromisoformat(times[idx]).replace(tzinfo=timezone.utc) - timestamp).total_seconds()
            ),
        )

        rain_list = hourly.get("rain", [])
        wind_list = hourly.get("windspeed_10m", []) or hourly.get("wind_speed_10m", [])
        press_list = hourly.get("surface_pressure", [])
        cloud_list = hourly.get("cloudcover", []) or hourly.get("cloud_cover", [])

        rain_val = rain_list[nearest_index] if nearest_index < len(rain_list) and rain_list[nearest_index] is not None else 0.0
        wind_val = wind_list[nearest_index] if nearest_index < len(wind_list) and wind_list[nearest_index] is not None else 0.0
        press_val = press_list[nearest_index] if nearest_index < len(press_list) and press_list[nearest_index] is not None else 1013.25
        cloud_val = cloud_list[nearest_index] if nearest_index < len(cloud_list) and cloud_list[nearest_index] is not None else 0.0

        return WeatherSnapshot(
            temperature=float(temp_list[nearest_index]),
            humidity=float(hum_list[nearest_index]),
            rainfall=float(rain_val),
            wind_speed=float(wind_val),
            pressure=float(press_val),
            cloud_cover=float(cloud_val),
            weather_code=None,
        )
