from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.digital_twin import CowDigitalTwinResponse, HerdDigitalTwinResponse
from app.services.digital_twin_service import DigitalTwinService

router = APIRouter()


def get_digital_twin_service(db: Session = Depends(get_db)) -> DigitalTwinService:
    return DigitalTwinService(db)


@router.get("/digital-twin/cow/{cow_id}", response_model=CowDigitalTwinResponse)
def get_cow_digital_twin(
    cow_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DigitalTwinService = Depends(get_digital_twin_service),
) -> CowDigitalTwinResponse:
    try:
        return service.get_cow_digital_twin(user_id=user_id, cow_id=cow_id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.get("/digital-twin/herd", response_model=HerdDigitalTwinResponse)
def get_herd_digital_twin(
    farm_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: DigitalTwinService = Depends(get_digital_twin_service),
) -> HerdDigitalTwinResponse:
    return service.get_herd_digital_twin(user_id=user_id, farm_id=farm_id)


@router.post("/digital-twin/cow/{cow_id}/refresh", response_model=CowDigitalTwinResponse)
def refresh_cow_digital_twin(
    cow_id: str,
    user_id: str = Depends(get_current_user_id),
    service: DigitalTwinService = Depends(get_digital_twin_service),
) -> CowDigitalTwinResponse:
    try:
        return service.refresh_cow_digital_twin_state(user_id=user_id, cow_id=cow_id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

