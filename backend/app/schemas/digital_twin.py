from __future__ import annotations

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict


class VitalSign(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None
    status: str = "normal"  # normal, warning, critical, info
    description: Optional[str] = None


class ProductionMetric(BaseModel):
    current_yield_l: Optional[float] = None
    predicted_yield_l: Optional[float] = None
    efficiency_pct: Optional[float] = None
    trend_7d_l_day: Optional[float] = None
    baseline_status: str = "On Track"


class TopDriver(BaseModel):
    factor: str
    impact: str
    type: str  # positive, negative, neutral
    explanation: str


class CowDigitalTwinResponse(BaseModel):
    cow_id: str
    cow_name: str
    breed: Optional[str] = None
    age_display: Optional[str] = None
    lactation_stage: Optional[str] = None
    weight_kg: Optional[float] = None
    vitality_score: float  # 0.0 to 100.0
    health_status: str  # Healthy, Warning, Critical
    heat_stress_level: str  # Comfort, Mild, Moderate, High
    status_summary: str
    vital_signs: list[VitalSign]
    production: ProductionMetric
    top_drivers: list[TopDriver]
    active_alerts_count: int = 0
    active_anomalies_count: int = 0
    recent_anomalies: list[str] = []
    recommended_actions: list[str] = []
    last_updated: datetime

    model_config = ConfigDict(from_attributes=True)


class HerdVitalitySummary(BaseModel):
    total_cows: int
    average_vitality_score: float
    total_daily_yield_l: float
    total_predicted_yield_l: float
    health_distribution: dict[str, int]
    heat_stress_distribution: dict[str, int]
    attention_cow_count: int


class HerdDigitalTwinResponse(BaseModel):
    herd_summary: HerdVitalitySummary
    cow_states: list[CowDigitalTwinResponse]

    model_config = ConfigDict(from_attributes=True)
