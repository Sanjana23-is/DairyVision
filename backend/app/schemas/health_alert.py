from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HealthAlertCreate(BaseModel):
    cow_id: str
    observation_id: Optional[str] = None
    prediction_id: Optional[str] = None
    weather_log_id: Optional[str] = None
    feature_vector: Optional[dict] = None


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
    owner_id: str
    created_at: datetime
