from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FeatureVector(BaseModel):
    # Metadata
    observation_id: Optional[str] = None

    # Match the ML training schema exactly (see config.ALL_FEATURES)
    age: Optional[float] = None
    weight: Optional[float] = None
    health_status: Optional[int] = None
    feed: Optional[float] = None

    temperature: Optional[float] = None
    humidity: Optional[float] = None
    thi: Optional[float] = None

    # engineered features
    feed_weight_ratio: Optional[float] = None
    feed_per_weight: Optional[float] = None
    temp_humidity: Optional[float] = None
    thi_squared: Optional[float] = None
    feed_thi_interaction: Optional[float] = None
    age_weight_ratio: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
