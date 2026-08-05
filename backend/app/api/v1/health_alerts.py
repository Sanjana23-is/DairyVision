from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.health_alert import HealthAlertCreate, HealthAlertResponse
from app.services.health_alert_service import HealthAlertService

router = APIRouter()


def get_health_alert_service(db: Session = Depends(get_db)) -> HealthAlertService:
    return HealthAlertService(db)


@router.post("/health-alerts", response_model=HealthAlertResponse)
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
            feature_vector=None if payload.feature_vector is None else payload.feature_vector,
        )

        return {
            "id": saved.id,
            "cow_id": saved.cow_id,
            "observation_id": saved.observation_id,
            "prediction_id": saved.prediction_id,
            "farm_id": saved.farm_id,
            "alert_level": saved.alert_level,
            "alert_type": saved.alert_type,
            "description": saved.description,
            "confidence": float(saved.confidence),
            "owner_id": saved.owner_id,
            "created_at": saved.created_at,
        }
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
