from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.models import HealthAlert
from app.schemas.crud import HealthAlertUpdate
from app.schemas.health_alert import HealthAlertCreate, HealthAlertResponse
from app.services.crud_service import CRUDService
from app.services.health_alert_service import HealthAlertService

router = APIRouter()


def get_health_alert_service(db: Session = Depends(get_db)) -> HealthAlertService:
    return HealthAlertService(db)


def get_crud_service(db: Session = Depends(get_db)) -> CRUDService:
    return CRUDService(db)


@router.post("/health-alerts", response_model=HealthAlertResponse, status_code=status.HTTP_201_CREATED)
def create_health_alert(
    payload: HealthAlertCreate,
    user_id: str = Depends(get_current_user_id),
    service: HealthAlertService = Depends(get_health_alert_service),
):
    try:
        saved = service.evaluate_and_create(
            user_id=user_id,
            cow_id=payload.cow_id,
            observation_id=payload.observation_id,
            prediction_id=payload.prediction_id,
            weather_log_id=payload.weather_log_id,
            feature_vector=payload.feature_vector,
        )
        return saved
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))


@router.get("/health-alerts", response_model=list[HealthAlertResponse])
def list_health_alerts(
    alert_level: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    cow_id: Optional[str] = Query(None),
    prediction_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: HealthAlertService = Depends(get_health_alert_service),
) -> list[HealthAlertResponse]:
    return service.list_health_alerts(
        user_id=user_id,
        alert_level=alert_level,
        resolved=resolved,
        cow_id=cow_id,
        prediction_id=prediction_id,
        search=search,
    )


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


@router.delete("/health-alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_health_alert(
    alert_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> None:
    deleted = service.delete_owned(HealthAlert, user_id, alert_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health alert not found")
