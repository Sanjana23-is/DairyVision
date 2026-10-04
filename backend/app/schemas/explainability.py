from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class ExplainabilityFeature(BaseModel):
    feature: str
    display_name: str
    value: Optional[float] = None
    value_formatted: Optional[str] = None
    shap_value: float
    rank: int
    impact_direction: str
    impact_description: str


class ExplainabilityResponse(BaseModel):
    id: str
    prediction_id: Optional[str] = None
    anomaly_id: Optional[str] = None
    observation_id: Optional[str] = None
    cow_id: Optional[str] = None
    cow_name: Optional[str] = None
    farm_id: Optional[str] = None
    observation_date: Optional[str] = None
    predicted_yield: Optional[float] = None
    anomaly_severity: Optional[str] = None
    computed_at: datetime
    model_version: Optional[str] = None
    summary_narrative: Optional[str] = None
    actionable_advice: Optional[str] = None
    features: List[ExplainabilityFeature]
    top_positive: List[ExplainabilityFeature]
    top_negative: List[ExplainabilityFeature]

    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)


class ExplainableItem(BaseModel):
    type: str  # "prediction" | "anomaly"
    id: str
    cow_id: str
    cow_name: str
    date: str
    label: str  # e.g. "Predicted Yield: 24.5 L" or "Anomaly: Critical"
    prediction_id: Optional[str] = None
    anomaly_id: Optional[str] = None


class ExplainabilityHistoryResponse(BaseModel):
    items: List[ExplainableItem]


class ModelBenchmark(BaseModel):
    model: str
    r2_mean: float
    r2_std: float
    mae_mean: float
    mae_std: float
    rmse_mean: float
    rmse_std: float

    model_config = ConfigDict(protected_namespaces=())


class GlobalFeatureImportance(BaseModel):
    feature: str
    display_name: str
    mean_abs_shap: float
    monotone_constraint: Optional[str] = None
    description: str


class ModelInsightsResponse(BaseModel):
    model_name: str
    version: str
    algorithm: str
    monotone_guaranteed: bool
    violations_count: int
    summary: str
    benchmarks: List[ModelBenchmark]
    features: List[GlobalFeatureImportance]

    model_config = ConfigDict(protected_namespaces=())
