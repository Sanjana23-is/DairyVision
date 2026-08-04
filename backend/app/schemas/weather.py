from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class WeatherCreate(BaseModel):
    farm_id: str
    recorded_at: datetime
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    rainfall: Optional[float] = None
    wind_speed: Optional[float] = None
    pressure: Optional[float] = None
    cloud_cover: Optional[float] = None
    weather_code: Optional[str] = None

    @field_validator("temperature", "humidity", "rainfall", "wind_speed", "pressure", "cloud_cover")
    @classmethod
    def validate_non_negative(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Weather measurements must be non-negative")
        return value


class WeatherResponse(WeatherCreate):
    id: str
    owner_id: str
    thi: Optional[float] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
