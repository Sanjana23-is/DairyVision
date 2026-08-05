from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.schemas.explainability import ExplainabilityResponse
from app.schemas.feature import FeatureVector
from app.schemas.health_alert import HealthAlertResponse


class WhatIfPredictionResult(BaseModel):
    predicted_milk_yield: float
    model_version: str


class RecommendationItem(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    priority: str
    recommendation_type: str


class WhatIfRequest(BaseModel):
    observation_id: str
    scenario: FeatureVector
    include_explainability: bool = False
    include_health_alert: bool = True
    include_recommendations: bool = True


class WhatIfResponse(BaseModel):
    observation_id: str
    current_features: FeatureVector
    scenario_features: FeatureVector
    current_prediction: WhatIfPredictionResult
    scenario_prediction: WhatIfPredictionResult
    delta_milk_yield: float
    percent_change: float
    current_health_alert: Optional[HealthAlertResponse] = None
    scenario_health_alert: Optional[HealthAlertResponse] = None
    current_explainability: Optional[ExplainabilityResponse] = None
    scenario_explainability: Optional[ExplainabilityResponse] = None
    current_recommendations: Optional[List[RecommendationItem]] = None
    scenario_recommendations: Optional[List[RecommendationItem]] = None
