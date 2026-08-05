from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class RecommendationPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class RecommendationCategory(str, Enum):
    WATER_MANAGEMENT = "Water Management"
    FEEDING_STRATEGY = "Feeding Strategy"
    HEAT_STRESS_MANAGEMENT = "Heat Stress Management"
    OBSERVATION_FREQUENCY = "Observation Frequency"
    VETERINARY_ATTENTION = "Veterinary Attention"
    GENERAL_FARM_MANAGEMENT = "General Farm Management"


class RecommendationGenerateRequest(BaseModel):
    health_alert_id: Optional[str] = None
    prediction_id: Optional[str] = None
    explainability_id: Optional[str] = None
    observation_id: Optional[str] = None
    weather_log_id: Optional[str] = None
