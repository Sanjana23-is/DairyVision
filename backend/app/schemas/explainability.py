from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class ExplainabilityFeature(BaseModel):
    feature: str
    value: Optional[float]
    shap_value: float
    rank: int


class ExplainabilityResponse(BaseModel):
    id: str
    prediction_id: Optional[str]
    observation_id: Optional[str]
    cow_id: Optional[str]
    farm_id: Optional[str]
    computed_at: datetime
    model_version: Optional[str]
    features: List[ExplainabilityFeature]
    top_positive: List[ExplainabilityFeature]
    top_negative: List[ExplainabilityFeature]

    model_config = ConfigDict(from_attributes=True)
