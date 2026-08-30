from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


class ObservationBase(BaseModel):
    farm_id: str
    cow_id: str
    observation_date: Optional[date] = None
    milk_produced_liters: Optional[float] = None
    feed_quantity_kg: Optional[float] = None
    symptoms: Optional[dict[str, Any]] = None
    notes: Optional[str] = None

    @field_validator("milk_produced_liters", "feed_quantity_kg")
    @classmethod
    def validate_non_negative(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Value must be non-negative")
        return value


class ObservationCreate(ObservationBase):
    pass


class ObservationUpdate(BaseModel):
    farm_id: Optional[str] = None
    cow_id: Optional[str] = None
    observation_date: Optional[date] = None
    milk_produced_liters: Optional[float] = None
    feed_quantity_kg: Optional[float] = None
    symptoms: Optional[dict[str, Any]] = None
    notes: Optional[str] = None

    @field_validator("milk_produced_liters", "feed_quantity_kg")
    @classmethod
    def validate_non_negative(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Value must be non-negative")
        return value


class ObservationResponse(ObservationBase):
    id: str
    observed_by: Optional[str] = None
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
