from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator

COW_STATUS_VALUES = ("active", "dry", "sick", "deceased", "sold")


class BreedResponse(BaseModel):
    id: str
    canonical_name: str
    breed_category: Optional[str] = None
    species: Optional[str] = None
    origin_region: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class CowBase(BaseModel):
    farm_id: str
    tag_id: str
    name: Optional[str] = None
    breed_id: Optional[str] = None
    birth_date: Optional[date] = None
    age_months: Optional[int] = None
    sex: Optional[str] = None
    status: Optional[str] = None
    weight_kg: Optional[float] = None
    lactation_number: Optional[int] = None
    notes: Optional[str] = None


class CowCreate(CowBase):
    status: str

    @field_validator("tag_id")
    @classmethod
    def tag_id_must_not_be_blank(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("tag_id must not be blank")
        return value

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str) -> str:
        if value not in COW_STATUS_VALUES:
            raise ValueError(f"status must be one of {COW_STATUS_VALUES}")
        return value

    @field_validator("age_months")
    @classmethod
    def age_months_must_be_non_negative(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("age_months must not be negative")
        return value


class CowUpdate(BaseModel):
    name: Optional[str] = None
    breed_id: Optional[str] = None
    birth_date: Optional[date] = None
    age_months: Optional[int] = None
    sex: Optional[str] = None
    status: Optional[str] = None
    weight_kg: Optional[float] = None
    lactation_number: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in COW_STATUS_VALUES:
            raise ValueError(f"status must be one of {COW_STATUS_VALUES}")
        return value

    @field_validator("age_months")
    @classmethod
    def age_months_must_be_non_negative(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("age_months must not be negative")
        return value



class CowResponse(CowBase):
    id: str
    created_by: Optional[str] = None
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


VALID_HEALTH_CONDITIONS = {
    "normal",
    "fever",
    "mastitis",
    "lameness",
    "respiratory",
    "digestive",
    "other",
}


class DailyObservationBase(BaseModel):
    cow_id: str
    observation_date: date
    milk_produced_liters: Optional[float] = None
    feed_quantity_kg: Optional[float] = None
    symptoms: Optional[dict[str, Any]] = None
    health_condition: Optional[str] = None
    body_temperature_c: Optional[float] = None
    body_condition_score: Optional[float] = None
    health_notes: Optional[str] = None
    notes: Optional[str] = None

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


class DailyObservationCreate(DailyObservationBase):
    pass


class DailyObservationUpdate(BaseModel):
    milk_produced_liters: Optional[float] = None
    feed_quantity_kg: Optional[float] = None
    symptoms: Optional[dict[str, Any]] = None
    health_condition: Optional[str] = None
    body_temperature_c: Optional[float] = None
    body_condition_score: Optional[float] = None
    health_notes: Optional[str] = None
    notes: Optional[str] = None

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


class DailyObservationResponse(DailyObservationBase):
    id: str
    observed_by: Optional[str] = None
    owner_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



class ActivityLogBase(BaseModel):
    cow_id: Optional[str] = None
    activity_type: str
    description: Optional[str] = None


class ActivityLogCreate(ActivityLogBase):
    pass


class ActivityLogUpdate(BaseModel):
    cow_id: Optional[str] = None
    activity_type: Optional[str] = None
    description: Optional[str] = None


class ActivityLogResponse(ActivityLogBase):
    id: str
    user_id: Optional[str] = None
    owner_id: str
    occurred_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HealthAlertBase(BaseModel):
    cow_id: str
    alert_level: str
    alert_type: str
    description: Optional[str] = None
    confidence: float = 0.0
    resolved: Optional[bool] = False


class HealthAlertCreate(HealthAlertBase):
    pass


class HealthAlertUpdate(BaseModel):
    alert_level: Optional[str] = None
    alert_type: Optional[str] = None
    description: Optional[str] = None
    resolved: Optional[bool] = None


class HealthAlertResponse(HealthAlertBase):
    id: str
    owner_id: str
    created_at: datetime

    # Farmer-facing presentation fields
    risk_display_name: Optional[str] = None
    why_explanation: Optional[str] = None
    evidence: Optional[dict[str, Any]] = None
    cow_name: Optional[str] = None
    observation_date: Optional[str] = None
    recommended_actions: Optional[list[str]] = None

    model_config = ConfigDict(from_attributes=True)



class MilkPredictionBase(BaseModel):
    cow_id: str
    observation_id: Optional[str] = None
    predicted_milk_yield: float
    model_version: str
    confidence_score: Optional[float] = None

    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)


class MilkPredictionCreate(MilkPredictionBase):
    pass


class MilkPredictionUpdate(BaseModel):
    observation_id: Optional[str] = None
    predicted_milk_yield: Optional[float] = None
    model_version: Optional[str] = None
    confidence_score: Optional[float] = None

    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)


class MilkPredictionResponse(MilkPredictionBase):
    id: str
    owner_id: str
    prediction_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class RecommendationBase(BaseModel):
    cow_id: Optional[str] = None
    alert_id: Optional[str] = None
    prediction_id: Optional[str] = None
    observation_id: Optional[str] = None
    anomaly_id: Optional[str] = None
    farm_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    why_reason: Optional[str] = None
    category: str
    priority: str
    recommendation_type: str
    completed: Optional[bool] = False


class RecommendationCreate(RecommendationBase):
    pass


class RecommendationUpdate(BaseModel):
    cow_id: Optional[str] = None
    alert_id: Optional[str] = None
    prediction_id: Optional[str] = None
    observation_id: Optional[str] = None
    anomaly_id: Optional[str] = None
    farm_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    why_reason: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    recommendation_type: Optional[str] = None



class RecommendationResponse(RecommendationBase):
    id: str
    owner_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FarmBase(BaseModel):
    name: str
    description: Optional[str] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = True


class FarmCreate(FarmBase):
    pass


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location_city: Optional[str] = None
    location_country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    is_active: Optional[bool] = None



class FarmResponse(FarmBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserPreferenceBase(BaseModel):
    preferred_language: Optional[str] = None
    preferred_currency: Optional[str] = None
    breed_display_preference: Optional[str] = None
    show_local_names: Optional[bool] = None


class UserPreferenceCreate(UserPreferenceBase):
    pass


class UserPreferenceUpdate(BaseModel):
    preferred_language: Optional[str] = None
    preferred_currency: Optional[str] = None
    breed_display_preference: Optional[str] = None
    show_local_names: Optional[bool] = None


class UserPreferenceResponse(UserPreferenceBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
