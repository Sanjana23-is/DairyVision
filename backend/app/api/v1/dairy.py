from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import (
    ActivityLog,
    Cow,
    DailyObservation,
    Farm,
    HealthAlert,
    MilkPrediction,
    Recommendation,
    UserPreference,
)
from app.schemas.crud import (
    ActivityLogCreate,
    ActivityLogResponse,
    ActivityLogUpdate,
    CowCreate,
    CowResponse,
    CowUpdate,
    DailyObservationCreate,
    DailyObservationResponse,
    DailyObservationUpdate,
    FarmCreate,
    FarmResponse,
    FarmUpdate,
    HealthAlertCreate,
    HealthAlertResponse,
    HealthAlertUpdate,
    MilkPredictionCreate,
    MilkPredictionResponse,
    MilkPredictionUpdate,
    RecommendationCreate,
    RecommendationResponse,
    RecommendationUpdate,
    UserPreferenceCreate,
    UserPreferenceResponse,
    UserPreferenceUpdate,
)
from app.services.crud_service import CRUDService

router = APIRouter()


def get_crud_service(db: Session = Depends(get_db)) -> CRUDService:
    return CRUDService(db)


@router.post("/farms", response_model=FarmResponse, status_code=status.HTTP_201_CREATED)
def create_farm(
    payload: FarmCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> FarmResponse:
    return service.create_owned(Farm, user_id, **payload.model_dump(exclude_none=True))


@router.get("/farms", response_model=list[FarmResponse])
def list_farms(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[FarmResponse]:
    return service.list_owned(Farm, user_id)


@router.get("/farms/{farm_id}", response_model=FarmResponse)
def get_farm(
    farm_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> FarmResponse:
    farm = service.get_owned(Farm, user_id, farm_id)
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    return farm


@router.patch("/farms/{farm_id}", response_model=FarmResponse)
def update_farm(
    farm_id: str,
    payload: FarmUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> FarmResponse:
    farm = service.update_owned(Farm, user_id, farm_id, **payload.model_dump(exclude_unset=True))
    if farm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")
    return farm


@router.delete("/farms/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(
    farm_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(Farm, user_id, farm_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Farm not found")


@router.post("/cows", response_model=CowResponse, status_code=status.HTTP_201_CREATED)
def create_cow(
    payload: CowCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> CowResponse:
    return service.create_owned(Cow, user_id, **payload.model_dump(exclude_none=True))


@router.get("/cows", response_model=list[CowResponse])
def list_cows(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[CowResponse]:
    return service.list_owned(Cow, user_id)


@router.get("/cows/{cow_id}", response_model=CowResponse)
def get_cow(
    cow_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> CowResponse:
    cow = service.get_owned(Cow, user_id, cow_id)
    if cow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cow not found")
    return cow


@router.patch("/cows/{cow_id}", response_model=CowResponse)
def update_cow(
    cow_id: str,
    payload: CowUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> CowResponse:
    cow = service.update_owned(Cow, user_id, cow_id, **payload.model_dump(exclude_unset=True))
    if cow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cow not found")
    return cow


@router.delete("/cows/{cow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cow(
    cow_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(Cow, user_id, cow_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cow not found")


@router.post("/daily-observations", response_model=DailyObservationResponse, status_code=status.HTTP_201_CREATED)
def create_daily_observation(
    payload: DailyObservationCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> DailyObservationResponse:
    return service.create_owned(DailyObservation, user_id, **payload.model_dump(exclude_none=True))


@router.get("/daily-observations", response_model=list[DailyObservationResponse])
def list_daily_observations(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[DailyObservationResponse]:
    return service.list_owned(DailyObservation, user_id)


@router.get("/daily-observations/{observation_id}", response_model=DailyObservationResponse)
def get_daily_observation(
    observation_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> DailyObservationResponse:
    observation = service.get_owned(DailyObservation, user_id, observation_id)
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily observation not found")
    return observation


@router.patch("/daily-observations/{observation_id}", response_model=DailyObservationResponse)
def update_daily_observation(
    observation_id: str,
    payload: DailyObservationUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> DailyObservationResponse:
    observation = service.update_owned(DailyObservation, user_id, observation_id, **payload.model_dump(exclude_unset=True))
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily observation not found")
    return observation


@router.delete("/daily-observations/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_daily_observation(
    observation_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(DailyObservation, user_id, observation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily observation not found")


@router.post("/activity-logs", response_model=ActivityLogResponse, status_code=status.HTTP_201_CREATED)
def create_activity_log(
    payload: ActivityLogCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> ActivityLogResponse:
    return service.create_owned(ActivityLog, user_id, **payload.model_dump(exclude_none=True))


@router.get("/activity-logs", response_model=list[ActivityLogResponse])
def list_activity_logs(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[ActivityLogResponse]:
    return service.list_owned(ActivityLog, user_id)


@router.get("/activity-logs/{activity_log_id}", response_model=ActivityLogResponse)
def get_activity_log(
    activity_log_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> ActivityLogResponse:
    activity_log = service.get_owned(ActivityLog, user_id, activity_log_id)
    if activity_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found")
    return activity_log


@router.patch("/activity-logs/{activity_log_id}", response_model=ActivityLogResponse)
def update_activity_log(
    activity_log_id: str,
    payload: ActivityLogUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> ActivityLogResponse:
    activity_log = service.update_owned(ActivityLog, user_id, activity_log_id, **payload.model_dump(exclude_unset=True))
    if activity_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found")
    return activity_log


@router.delete("/activity-logs/{activity_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity_log(
    activity_log_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(ActivityLog, user_id, activity_log_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found")


@router.post("/health-alerts", response_model=HealthAlertResponse, status_code=status.HTTP_201_CREATED)
def create_health_alert(
    payload: HealthAlertCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> HealthAlertResponse:
    return service.create_owned(HealthAlert, user_id, **payload.model_dump(exclude_none=True))


@router.get("/health-alerts", response_model=list[HealthAlertResponse])
def list_health_alerts(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[HealthAlertResponse]:
    return service.list_owned(HealthAlert, user_id)


@router.get("/health-alerts/{alert_id}", response_model=HealthAlertResponse)
def get_health_alert(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> HealthAlertResponse:
    alert = service.get_owned(HealthAlert, user_id, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health alert not found")
    return alert


@router.patch("/health-alerts/{alert_id}", response_model=HealthAlertResponse)
def update_health_alert(
    alert_id: str,
    payload: HealthAlertUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> HealthAlertResponse:
    alert = service.update_owned(HealthAlert, user_id, alert_id, **payload.model_dump(exclude_unset=True))
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health alert not found")
    return alert


@router.delete("/health-alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_health_alert(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(HealthAlert, user_id, alert_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health alert not found")


@router.post("/milk-predictions", response_model=MilkPredictionResponse, status_code=status.HTTP_201_CREATED)
def create_milk_prediction(
    payload: MilkPredictionCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> MilkPredictionResponse:
    return service.create_owned(MilkPrediction, user_id, **payload.model_dump(exclude_none=True))


@router.get("/milk-predictions", response_model=list[MilkPredictionResponse])
def list_milk_predictions(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[MilkPredictionResponse]:
    return service.list_owned(MilkPrediction, user_id)


@router.get("/milk-predictions/{prediction_id}", response_model=MilkPredictionResponse)
def get_milk_prediction(
    prediction_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> MilkPredictionResponse:
    prediction = service.get_owned(MilkPrediction, user_id, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milk prediction not found")
    return prediction


@router.patch("/milk-predictions/{prediction_id}", response_model=MilkPredictionResponse)
def update_milk_prediction(
    prediction_id: str,
    payload: MilkPredictionUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> MilkPredictionResponse:
    prediction = service.update_owned(MilkPrediction, user_id, prediction_id, **payload.model_dump(exclude_unset=True))
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milk prediction not found")
    return prediction


@router.delete("/milk-predictions/{prediction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milk_prediction(
    prediction_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(MilkPrediction, user_id, prediction_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milk prediction not found")


@router.post("/recommendations", response_model=RecommendationResponse, status_code=status.HTTP_201_CREATED)
def create_recommendation(
    payload: RecommendationCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> RecommendationResponse:
    return service.create_owned(Recommendation, user_id, **payload.model_dump(exclude_none=True))


@router.get("/recommendations", response_model=list[RecommendationResponse])
def list_recommendations(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[RecommendationResponse]:
    return service.list_owned(Recommendation, user_id)


@router.get("/recommendations/{recommendation_id}", response_model=RecommendationResponse)
def get_recommendation(
    recommendation_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> RecommendationResponse:
    recommendation = service.get_owned(Recommendation, user_id, recommendation_id)
    if recommendation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")
    return recommendation


@router.patch("/recommendations/{recommendation_id}", response_model=RecommendationResponse)
def update_recommendation(
    recommendation_id: str,
    payload: RecommendationUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> RecommendationResponse:
    recommendation = service.update_owned(Recommendation, user_id, recommendation_id, **payload.model_dump(exclude_unset=True))
    if recommendation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")
    return recommendation


@router.delete("/recommendations/{recommendation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recommendation(
    recommendation_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(Recommendation, user_id, recommendation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recommendation not found")


@router.get("/preferences", response_model=UserPreferenceResponse)
def get_preference(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> UserPreferenceResponse:
    preference = service.list_owned(UserPreference, user_id)
    if not preference:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preferences not found")
    return preference[0]


@router.post("/preferences", response_model=UserPreferenceResponse, status_code=status.HTTP_201_CREATED)
def create_preference(
    payload: UserPreferenceCreate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> UserPreferenceResponse:
    return service.create_owned(UserPreference, user_id, **payload.model_dump(exclude_none=True))


@router.patch("/preferences", response_model=UserPreferenceResponse)
def update_preference(
    payload: UserPreferenceUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> UserPreferenceResponse:
    existing = service.list_owned(UserPreference, user_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preferences not found")
    preference = service.update_owned(UserPreference, user_id, existing[0].id, **payload.model_dump(exclude_unset=True))
    return preference


@router.delete("/preferences", status_code=status.HTTP_204_NO_CONTENT)
def delete_preference(
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    existing = service.list_owned(UserPreference, user_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preferences not found")
    deleted = service.delete_owned(UserPreference, user_id, existing[0].id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preferences not found")
