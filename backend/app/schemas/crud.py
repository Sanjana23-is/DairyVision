from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

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
    tag_id: Optional[str] = None
    name: Optional[str] = None
    breed_id: Optional[str] = None
    birth_date: Optional[date] = None
    age_months: Optional[int] = None
    sex: Optional[str] = None
    status: Optional[str] = None
    weight_kg: Optional[float] = None
    lactation_number: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("tag_id")
    @classmethod
    def tag_id_must_not_be_blank(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and not value.strip():
            raise ValueError("tag_id must not be blank")
        return value

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
    created_by: str
    owner_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecommendationBase(BaseModel):
    cow_id: Optional[str] = None
    anomaly_id: Optional[str] = None
    title: str
    why_reason: Optional[str] = None
    recommendation_type: str
    priority: str
    description: Optional[str] = None
    action_item: Optional[str] = None
    is_completed: Optional[bool] = False
    metadata_json: Optional[dict[str, Any]] = None


class RecommendationCreate(RecommendationBase):
    pass


class RecommendationUpdate(BaseModel):
    title: Optional[str] = None
    why_reason: Optional[str] = None
    recommendation_type: Optional[str] = None
    priority: Optional[str] = None
    description: Optional[str] = None
    action_item: Optional[str] = None
    is_completed: Optional[bool] = None
    metadata_json: Optional[dict[str, Any]] = None


class RecommendationResponse(RecommendationBase):
    id: str
    farm_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HealthAlertUpdate(BaseModel):
    resolved: Optional[bool] = None
    alert_level: Optional[str] = None
    alert_type: Optional[str] = None
    description: Optional[str] = None
    confidence: Optional[float] = None


class ActivityLogBase(BaseModel):
    farm_id: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details: Optional[dict[str, Any]] = None


class ActivityLogCreate(ActivityLogBase):
    pass


class ActivityLogUpdate(BaseModel):
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details: Optional[dict[str, Any]] = None


class ActivityLogResponse(ActivityLogBase):
    id: str
    user_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MilkPredictionBase(BaseModel):
    cow_id: str
    observation_id: Optional[str] = None
    predicted_milk_yield: float
    confidence_score: Optional[float] = None
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    confidence_data_status: Optional[str] = "limited_data"
    model_version: Optional[str] = None
    feature_snapshot: Optional[dict[str, Any]] = None

    model_config = ConfigDict(protected_namespaces=())


class MilkPredictionCreate(MilkPredictionBase):
    pass


class MilkPredictionResponse(MilkPredictionBase):
    id: str
    owner_id: Optional[str] = None
    prediction_timestamp: datetime
    created_at: Optional[datetime] = None

    @model_validator(mode="after")
    def set_created_at_fallback(self) -> MilkPredictionResponse:
        if self.created_at is None and self.prediction_timestamp is not None:
            self.created_at = self.prediction_timestamp
        return self

    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)


class FarmBase(BaseModel):
    name: str
    timezone: Optional[str] = "UTC"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = True


class FarmCreate(FarmBase):
    pass


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None


class FarmResponse(FarmBase):
    id: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FarmSettingsBase(BaseModel):
    default_language: Optional[str] = "en"
    default_currency: Optional[str] = "INR"
    milk_price_per_liter: Optional[float] = None
    feed_cost_per_kg: Optional[float] = None
    timezone: Optional[str] = "Asia/Kolkata"
    breed_display_mode: Optional[str] = "canonical"
    use_local_breed_names: Optional[bool] = True


class FarmSettingsUpdate(BaseModel):
    default_language: Optional[str] = None
    default_currency: Optional[str] = None
    milk_price_per_liter: Optional[float] = None
    feed_cost_per_kg: Optional[float] = None
    timezone: Optional[str] = None
    breed_display_mode: Optional[str] = None
    use_local_breed_names: Optional[bool] = None


class FarmSettingsResponse(FarmSettingsBase):
    id: str
    farm_id: str
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
