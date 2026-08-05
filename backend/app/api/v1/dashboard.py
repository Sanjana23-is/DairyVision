from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    ObservationHistoryRequest,
    ObservationHistoryResponse,
    TrendsResponse,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def get_dashboard_service(db: Session = Depends(get_db)) -> DashboardService:
    return DashboardService(db)


@router.get("/farms/{farm_id}/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    farm_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DashboardService = Depends(get_dashboard_service),
) -> DashboardSummaryResponse:
    try:
        summary = service.get_dashboard_summary(user_id, farm_id)
        return summary
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/farms/{farm_id}/trends", response_model=TrendsResponse)
def get_dashboard_trends(
    farm_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DashboardService = Depends(get_dashboard_service),
) -> TrendsResponse:
    try:
        return {
            "milk_yield_trends": service.get_milk_yield_trends(user_id, farm_id),
            "health_alert_trends": service.get_health_alert_trends(user_id, farm_id),
            "weather_trends": service.get_weather_trends(user_id, farm_id),
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/farms/{farm_id}/observations", response_model=ObservationHistoryResponse)
def get_observation_history(
    farm_id: str,
    payload: ObservationHistoryRequest,
    user_id: str = Depends(get_current_user_id),
    service: DashboardService = Depends(get_dashboard_service),
) -> ObservationHistoryResponse:
    try:
        return {"observations": service.get_observation_history(user_id, farm_id, payload.limit)}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
