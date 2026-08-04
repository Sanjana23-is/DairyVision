from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.exceptions import WeatherForbidden, WeatherNotFound, WeatherValidationError
from app.schemas.weather import WeatherCreate, WeatherResponse
from app.services.weather_service import WeatherService

router = APIRouter(prefix="/weather", tags=["weather"])


def get_weather_service(db: Session = Depends(get_db)) -> WeatherService:
    return WeatherService(db)


@router.post("", response_model=WeatherResponse, status_code=status.HTTP_201_CREATED)
def create_weather_log(
    payload: WeatherCreate,
    user_id: str = Depends(get_current_user_id),
    service: WeatherService = Depends(get_weather_service),
) -> WeatherResponse:
    try:
        return service.create_weather_log(user_id, payload)
    except WeatherValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except WeatherForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.get("", response_model=list[WeatherResponse])
def list_weather_logs(
    user_id: str = Depends(get_current_user_id),
    service: WeatherService = Depends(get_weather_service),
) -> list[WeatherResponse]:
    return service.list_weather(user_id)


@router.get("/{weather_id}", response_model=WeatherResponse)
def get_weather_log(
    weather_id: str,
    user_id: str = Depends(get_current_user_id),
    service: WeatherService = Depends(get_weather_service),
) -> WeatherResponse:
    weather_log = service.get_weather(user_id, weather_id)
    if weather_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Weather log not found")
    return weather_log


@router.get("/farms/{farm_id}/nearest", response_model=WeatherResponse)
def get_nearest_weather_snapshot(
    farm_id: str,
    recorded_at: datetime,
    user_id: str = Depends(get_current_user_id),
    service: WeatherService = Depends(get_weather_service),
) -> WeatherResponse:
    try:
        return service.get_or_create_nearest_snapshot(user_id, farm_id, recorded_at)
    except WeatherNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except WeatherForbidden as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
