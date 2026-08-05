from __future__ import annotations

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict


class FarmSummary(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HerdSummaryItem(BaseModel):
    status: str
    count: int


class MilkPredictionSummary(BaseModel):
    id: str
    cow_id: str
    predicted_milk_yield: float
    confidence_score: Optional[float] = None
    prediction_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class WeatherSummary(BaseModel):
    id: str
    farm_id: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    wind_speed: Optional[float] = None
    rainfall: Optional[float] = None
    pressure: Optional[float] = None
    cloud_cover: Optional[float] = None
    thi: Optional[float] = None
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HealthAlertSummary(BaseModel):
    id: str
    cow_id: str
    alert_level: str
    alert_type: str
    description: Optional[str] = None
    confidence: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecommendationSummary(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    category: str
    priority: str
    recommendation_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ObservationSummary(BaseModel):
    id: str
    cow_id: str
    cow_name: Optional[str] = None
    observation_date: date
    milk_produced_liters: Optional[float] = None
    feed_quantity_kg: Optional[float] = None
    symptoms: Optional[Any] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardSummaryResponse(BaseModel):
    farm: FarmSummary
    herd_summary: List[HerdSummaryItem]
    active_cow_count: int
    todays_milk_predictions: List[MilkPredictionSummary]
    average_predicted_milk_yield: float
    todays_weather: Optional[WeatherSummary] = None
    active_health_alerts: List[HealthAlertSummary]
    recent_recommendations: List[RecommendationSummary]
    recent_observations: List[ObservationSummary]


class DateTrendItem(BaseModel):
    date: date
    average_predicted_milk_yield: Optional[float] = None
    prediction_count: Optional[int] = None
    total_alerts: Optional[int] = None
    critical_count: Optional[int] = None
    warning_count: Optional[int] = None
    healthy_count: Optional[int] = None
    average_temperature: Optional[float] = None
    average_humidity: Optional[float] = None
    average_thi: Optional[float] = None


class ObservationHistoryResponse(BaseModel):
    observations: List[ObservationSummary]


class TrendsResponse(BaseModel):
    milk_yield_trends: List[DateTrendItem]
    health_alert_trends: List[DateTrendItem]
    weather_trends: List[DateTrendItem]


class ObservationHistoryRequest(BaseModel):
    limit: int = 20
