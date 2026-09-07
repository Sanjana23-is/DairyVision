from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict


class AnomalyRecordResponse(BaseModel):
    id: str
    cow_id: str
    observation_id: Optional[str] = None
    farm_id: str
    owner_id: str
    anomaly_score: float
    severity: str
    anomaly_type: str
    issue_tags: Optional[List[str]] = None
    description: Optional[str] = None
    details: Optional[Any] = None
    detected_at: datetime
    resolved: bool

    model_config = ConfigDict(from_attributes=True)


class AnomalySummaryCounts(BaseModel):
    total_scanned: int
    normal: int
    warning: int
    critical: int
    unresolved_anomalies: int


class TopAnomalousCow(BaseModel):
    cow_id: str
    cow_name: str
    anomaly_score: float
    severity: str
    issue_tags: List[str]
    last_observed_date: Optional[str] = None


class AnomalySummaryResponse(BaseModel):
    summary: AnomalySummaryCounts
    top_anomalous_cows: List[TopAnomalousCow]
    recent_anomalies: List[AnomalyRecordResponse]


class AnomalyUpdate(BaseModel):
    resolved: Optional[bool] = None
