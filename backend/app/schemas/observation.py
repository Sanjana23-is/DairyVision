from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator


VALID_HEALTH_CONDITIONS = {
    "normal",
    "fever",
    "mastitis",
    "lameness",
    "respiratory",
    "digestive",
    "other",
}


class ObservationBase(BaseModel):
    farm_id: str
    cow_id: str
    observation_date: Optional[date] = None
    milk_produced_liters: Optional[float] = None
    feed_quantity_kg: Optional[float] = None
    symptoms: Optional[dict[str, Any]] = None
    health_condition: Optional[str] = None
    body_temperature_c: Optional[float] = None
    body_condition_score: Optional[float] = None
    health_notes: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("milk_produced_liters", "feed_quantity_kg")
    @classmethod
    def validate_non_negative(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Value must be non-negative")
        return value

    @field_validator("health_condition")
    @classmethod
    def validate_health_condition(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value.strip().lower() not in VALID_HEALTH_CONDITIONS:
            raise ValueError(f"health_condition must be one of: {', '.join(sorted(VALID_HEALTH_CONDITIONS))}")
        return value.strip().lower() if value is not None else None

    @field_validator("body_temperature_c")
    @classmethod
    def validate_body_temperature(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("body_temperature_c must be a positive number")
        return value

    @field_validator("body_condition_score")
    @classmethod
    def validate_body_condition_score(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not (1.0 <= value <= 5.0):
            raise ValueError("body_condition_score must be between 1.0 and 5.0")
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
    health_condition: Optional[str] = None
    body_temperature_c: Optional[float] = None
    body_condition_score: Optional[float] = None
    health_notes: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("milk_produced_liters", "feed_quantity_kg")
    @classmethod
    def validate_non_negative(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Value must be non-negative")
        return value

    @field_validator("health_condition")
    @classmethod
    def validate_health_condition(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value.strip().lower() not in VALID_HEALTH_CONDITIONS:
            raise ValueError(f"health_condition must be one of: {', '.join(sorted(VALID_HEALTH_CONDITIONS))}")
        return value.strip().lower() if value is not None else None

    @field_validator("body_temperature_c")
    @classmethod
    def validate_body_temperature(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("body_temperature_c must be a positive number")
        return value

    @field_validator("body_condition_score")
    @classmethod
    def validate_body_condition_score(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not (1.0 <= value <= 5.0):
            raise ValueError("body_condition_score must be between 1.0 and 5.0")
        return value


class ObservationResponse(ObservationBase):
    id: str
    observed_by: Optional[str] = None
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BulkObservationItem(BaseModel):
    tag_id: str
    observation_date: Optional[date] = None
    milk_produced_liters: Optional[float] = None
    feed_quantity_kg: Optional[float] = None
    health_condition: Optional[str] = None
    body_temperature_c: Optional[float] = None
    body_condition_score: Optional[float] = None
    notes: Optional[str] = None

    @field_validator("tag_id")
    @classmethod
    def validate_tag_id_not_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("tag_id cannot be blank")
        return value.strip()

    @field_validator("milk_produced_liters", "feed_quantity_kg")
    @classmethod
    def validate_non_negative(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value < 0:
            raise ValueError("Value must be non-negative")
        return value

    @field_validator("health_condition")
    @classmethod
    def validate_health_condition(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value.strip().lower() not in VALID_HEALTH_CONDITIONS:
            raise ValueError(f"health_condition must be one of: {', '.join(sorted(VALID_HEALTH_CONDITIONS))}")
        return value.strip().lower() if value is not None else None

    @field_validator("body_temperature_c")
    @classmethod
    def validate_body_temperature(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("body_temperature_c must be a positive number")
        return value

    @field_validator("body_condition_score")
    @classmethod
    def validate_body_condition_score(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and not (1.0 <= value <= 5.0):
            raise ValueError("body_condition_score must be between 1.0 and 5.0")
        return value


class BulkRowError(BaseModel):
    row: int
    tag_id: Optional[str] = None
    reason: str


class BulkObservationRequest(BaseModel):
    farm_id: Optional[str] = None
    items: list[BulkObservationItem]


class BulkObservationResponse(BaseModel):
    total_rows: int
    imported_count: int
    failed_count: int
    duplicate_count: int
    errors: list[BulkRowError]
