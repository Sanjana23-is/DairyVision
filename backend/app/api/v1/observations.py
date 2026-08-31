from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.exceptions import ObservationForbidden, ObservationValidationError
from app.schemas.observation import (
    BulkObservationRequest,
    BulkObservationResponse,
    ObservationCreate,
    ObservationResponse,
    ObservationUpdate,
)
from app.services.observation_service import ObservationService

router = APIRouter(prefix="/observations", tags=["observations"])


def get_observation_service(db: Session = Depends(get_db)) -> ObservationService:
    return ObservationService(db)


@router.post("", response_model=ObservationResponse, status_code=status.HTTP_201_CREATED)
def create_observation(
    payload: ObservationCreate,
    user_id: str = Depends(get_current_user_id),
    service: ObservationService = Depends(get_observation_service),
) -> ObservationResponse:
    try:
        return service.create_observation(user_id, payload)
    except ObservationValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ObservationForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.post("/bulk", response_model=BulkObservationResponse, status_code=status.HTTP_200_OK)
def create_bulk_observations(
    payload: BulkObservationRequest,
    user_id: str = Depends(get_current_user_id),
    service: ObservationService = Depends(get_observation_service),
    db: Session = Depends(get_db),
) -> BulkObservationResponse:
    farm_id = payload.farm_id
    if not farm_id:
        from app.models import Farm
        farm = db.query(Farm).filter(Farm.created_by == user_id).first()
        if not farm:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No farm found for current user")
        farm_id = farm.id

    return service.create_bulk_observations(user_id, farm_id, payload.items)


@router.get("", response_model=list[ObservationResponse])
def list_observations(
    user_id: str = Depends(get_current_user_id),
    service: ObservationService = Depends(get_observation_service),
) -> list[ObservationResponse]:
    return service.list_observations(user_id)


@router.get("/{observation_id}", response_model=ObservationResponse)
def get_observation(
    observation_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ObservationService = Depends(get_observation_service),
) -> ObservationResponse:
    observation = service.get_observation(user_id, observation_id)
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observation not found")
    return observation


@router.patch("/{observation_id}", response_model=ObservationResponse)
def update_observation(
    observation_id: str,
    payload: ObservationUpdate,
    user_id: str = Depends(get_current_user_id),
    service: ObservationService = Depends(get_observation_service),
) -> ObservationResponse:
    try:
        observation = service.update_observation(user_id, observation_id, payload)
    except ObservationValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except ObservationForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if observation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observation not found")
    return observation


@router.delete("/{observation_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_observation(
    observation_id: str,
    user_id: str = Depends(get_current_user_id),
    service: ObservationService = Depends(get_observation_service),
) -> None:
    deleted = service.delete_observation(user_id, observation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observation not found")
