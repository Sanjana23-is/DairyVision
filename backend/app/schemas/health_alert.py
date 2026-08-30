from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.feature import FeatureVector


class HealthAlertCreate(BaseModel):
    cow_id: str
    observation_id: Optional[str] = None
    prediction_id: Optional[str] = None
    weather_log_id: Optional[str] = None
    feature_vector: Optional[FeatureVector] = None


class HealthAlertResponse(BaseModel):
    id: str
    cow_id: str
    observation_id: Optional[str]
    prediction_id: Optional[str]
    farm_id: Optional[str]
    alert_level: str
    alert_type: str
    description: Optional[str]
    confidence: float
    resolved: bool
    owner_id: str
    created_at: datetime

    # Farmer-facing presentation fields
    risk_display_name: Optional[str] = None
    why_explanation: Optional[str] = None
    evidence: Optional[dict[str, Any]] = None
    cow_name: Optional[str] = None
    observation_date: Optional[str] = None
    recommended_actions: Optional[list[str]] = None

    model_config = ConfigDict(from_attributes=True)



class HealthSummaryCounts(BaseModel):
    healthy: int
    warning: int
    critical: int
    needs_attention: int
    no_recent_data: int
    total_cows: int



class RiskBreakdownItem(BaseModel):
    risk_type: str
    count: int


class AttentionCow(BaseModel):
    cow_id: str
    cow_name: str
    alert_level: str
    risk_type: str
    last_observed_date: Optional[str] = None


class HealthSummaryResponse(BaseModel):
    summary: HealthSummaryCounts
    risk_breakdown: list[RiskBreakdownItem]
    attention_cows: list[AttentionCow]

