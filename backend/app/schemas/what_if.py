from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.explainability import ExplainabilityResponse
from app.schemas.feature import FeatureVector
from app.schemas.health_alert import HealthAlertResponse


class WhatIfPredictionResult(BaseModel):
    predicted_milk_yield: float
    model_version: str

    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)


class RecommendationItem(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    priority: str
    recommendation_type: str


class SimulationInput(BaseModel):
    temperature_c: Optional[float] = Field(None, ge=0.0, le=50.0, description="Ambient temperature in °C")
    humidity_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Relative humidity in %")
    feed_quantity_kg: Optional[float] = Field(None, ge=0.0, le=60.0, description="Daily feed intake in kg")
    cooling_intervention_thi_reduction: Optional[float] = Field(0.0, ge=0.0, le=20.0, description="THI reduction from active cooling fans/sprinklers")
    body_condition_score: Optional[float] = Field(None, ge=1.0, le=5.0, description="Body condition score (1-5)")


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
    extrapolation_warning: bool = False


class HerdWhatIfRequest(BaseModel):
    farm_id: Optional[str] = None
    scenario: SimulationInput


class CowSimulationComparison(BaseModel):
    cow_id: str
    cow_name: str
    tag_id: str
    baseline_yield_l: float
    simulated_yield_l: float
    delta_yield_l: float
    percent_change: float
    baseline_health_status: str
    simulated_health_status: str
    baseline_thi: float
    simulated_thi: float


class HerdWhatIfResponse(BaseModel):
    farm_id: Optional[str] = None
    total_cows_simulated: int
    baseline_total_yield_l: float
    simulated_total_yield_l: float
    total_delta_l: float
    total_percent_change: float
    cow_comparisons: List[CowSimulationComparison]
    herd_recommendations: List[RecommendationItem]
    extrapolation_warning: bool = False


class CowWhatIfRequest(BaseModel):
    scenario: SimulationInput


class CowWhatIfResponse(BaseModel):
    cow_id: str
    cow_name: str
    tag_id: str
    breed_name: Optional[str] = None
    baseline_milk_yield_l: float
    predicted_milk_yield_l: float
    simulated_milk_yield_l: float
    delta_milk_yield_l: float
    percent_change: float
    baseline_thi: float
    simulated_thi: float
    baseline_health_status: str
    simulated_health_status: str
    baseline_vitality_score: float
    simulated_vitality_score: float
    explanation_summary: str
    extrapolation_warning: bool = False
    recommendations: List[RecommendationItem]
