from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.models import (
    ActivityLog,
    Cow,
    Farm,
    MilkPrediction,
    Recommendation,
    UserPreference,
)
from app.exceptions import ObservationForbidden, ObservationValidationError
from app.repositories.breed_repository import list_active_breeds
from app.repositories.ownership import scope_query
from app.schemas.crud import (
    ActivityLogCreate,
    ActivityLogResponse,
    ActivityLogUpdate,
    BreedResponse,
    CowCreate,
    CowResponse,
    CowUpdate,
    FarmCreate,
    FarmResponse,
    FarmUpdate,
    MilkPredictionResponse,
    RecommendationCreate,
    RecommendationResponse,
    RecommendationUpdate,
    UserPreferenceCreate,
    UserPreferenceResponse,
    UserPreferenceUpdate,
)
from app.schemas.observation import ObservationCreate, ObservationResponse, ObservationUpdate
from app.services.crud_service import CRUDService
from app.services.observation_service import ObservationService

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


@router.delete("/farms/{farm_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
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
    db: Session = Depends(get_db),
) -> CowResponse:
    try:
        return service.create_owned(Cow, user_id, **payload.model_dump(exclude_none=True))
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A cow with tag '{payload.tag_id}' already exists.",
        )


@router.get("/cows", response_model=list[CowResponse])
def list_cows(
    farm_id: Optional[str] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> list[CowResponse]:
    cows = service.list_owned(Cow, user_id)
    if farm_id is not None:
        cows = [cow for cow in cows if cow.farm_id == farm_id]
    return cows


@router.get("/breeds", response_model=list[BreedResponse])
def list_breeds(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> list[BreedResponse]:
    return list_active_breeds(db)


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
    db: Session = Depends(get_db),
) -> CowResponse:
    try:
        cow = service.update_owned(Cow, user_id, cow_id, **payload.model_dump(exclude_unset=True))
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Update violates a data constraint (e.g. invalid weight or lactation number).",
        )
    if cow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cow not found")
    return cow


@router.delete("/cows/{cow_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_cow(
    cow_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(Cow, user_id, cow_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cow not found")


@router.post("/daily-observations", response_model=ObservationResponse, status_code=status.HTTP_201_CREATED)
def create_daily_observation(
    payload: ObservationCreate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> ObservationResponse:
    service = ObservationService(db)
    try:
        return service.create_observation(user_id, payload)
    except ObservationForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ObservationValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/daily-observations", response_model=list[ObservationResponse])
def list_daily_observations(
    farm_id: Optional[str] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> list[ObservationResponse]:
    service = ObservationService(db)
    return service.list_observations(user_id, farm_id=farm_id)


@router.get("/daily-observations/{observation_id}", response_model=ObservationResponse)
def get_daily_observation(
    observation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> ObservationResponse:
    service = ObservationService(db)
    observation = service.get_observation(user_id, observation_id)
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily observation not found")
    return observation


@router.patch("/daily-observations/{observation_id}", response_model=ObservationResponse)
def update_daily_observation(
    observation_id: str,
    payload: ObservationUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> ObservationResponse:
    service = ObservationService(db)
    try:
        observation = service.update_observation(user_id, observation_id, payload)
    except ObservationForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ObservationValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Daily observation not found")
    return observation


@router.delete("/daily-observations/{observation_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_daily_observation(
    observation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> None:
    service = ObservationService(db)
    deleted = service.delete_observation(user_id, observation_id)
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


@router.delete("/activity-logs/{activity_log_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_activity_log(
    activity_log_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(ActivityLog, user_id, activity_log_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity log not found")




@router.get("/milk-predictions", response_model=list[MilkPredictionResponse])
def list_milk_predictions(
    farm_id: Optional[str] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
    db: Session = Depends(get_db),
) -> list[MilkPredictionResponse]:
    predictions = service.list_owned(MilkPrediction, user_id)
    if farm_id is not None:
        cow_ids = {cow.id for cow in db.query(Cow).filter(Cow.farm_id == farm_id).all()}
        predictions = [p for p in predictions if p.cow_id in cow_ids]
    return predictions


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


@router.delete("/milk-predictions/{prediction_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
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
    farm_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    completed: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> list[RecommendationResponse]:
    query = scope_query(db.query(Recommendation), Recommendation, user_id)

    if isinstance(farm_id, str) and farm_id.strip():
        query = query.filter(Recommendation.farm_id == farm_id)
    if isinstance(category, str) and category.strip():
        query = query.filter(Recommendation.category == category)
    if isinstance(priority, str) and priority.strip():
        query = query.filter(Recommendation.priority == priority)
    if isinstance(completed, bool):
        query = query.filter(Recommendation.completed.is_(completed))
    if isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Recommendation.title.ilike(term),
                Recommendation.description.ilike(term),
                Recommendation.category.ilike(term),
                Recommendation.priority.ilike(term),
            )
        )


    all_results = query.order_by(Recommendation.created_at.desc()).all()

    seen_keys = set()
    deduped_results: list[Recommendation] = []
    for rec in all_results:
        key_completed = rec.completed if completed is None else True
        key = (
            rec.farm_id or "",
            rec.cow_id or "",
            rec.recommendation_type or "",
            rec.title or "",
            key_completed,
        )
        if key not in seen_keys:
            seen_keys.add(key)
            deduped_results.append(rec)

    return deduped_results



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


@router.delete("/recommendations/{recommendation_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
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


@router.delete("/preferences", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
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
