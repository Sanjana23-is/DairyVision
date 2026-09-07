from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.models import AnomalyRecord
from app.schemas.anomaly import (
    AnomalyRecordResponse,
    AnomalySummaryResponse,
    AnomalyUpdate,
)
from app.services.crud_service import CRUDService
from app.services.anomaly_detection_service import AnomalyDetectionService

router = APIRouter()


def get_anomaly_service(db: Session = Depends(get_db)) -> AnomalyDetectionService:
    return AnomalyDetectionService(db)


def get_crud_service(db: Session = Depends(get_db)) -> CRUDService:
    return CRUDService(db)


@router.get("/anomalies/summary", response_model=AnomalySummaryResponse)
def get_anomaly_summary(
    farm_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: AnomalyDetectionService = Depends(get_anomaly_service),
) -> AnomalySummaryResponse:
    return service.get_anomaly_summary(user_id=user_id, farm_id=farm_id)


@router.post("/anomalies/scan", status_code=status.HTTP_200_OK)
def trigger_anomaly_scan(
    farm_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: AnomalyDetectionService = Depends(get_anomaly_service),
):
    scanned_count = service.run_herd_anomaly_scan(user_id=user_id, farm_id=farm_id)
    return {"message": "Herd anomaly scan completed", "scanned_observations": scanned_count}


@router.get("/anomalies", response_model=list[AnomalyRecordResponse])
def list_anomalies(
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    cow_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    service: AnomalyDetectionService = Depends(get_anomaly_service),
) -> list[AnomalyRecordResponse]:
    return service.list_anomalies(
        user_id=user_id,
        severity=severity,
        resolved=resolved,
        cow_id=cow_id,
        search=search,
    )


@router.get("/anomalies/{anomaly_id}", response_model=AnomalyRecordResponse)
def get_anomaly(
    anomaly_id: str,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> AnomalyRecordResponse:
    record = service.get_owned(AnomalyRecord, user_id, anomaly_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anomaly record not found")
    return record


@router.patch("/anomalies/{anomaly_id}", response_model=AnomalyRecordResponse)
def update_anomaly(
    anomaly_id: str,
    payload: AnomalyUpdate,
    user_id: str = Depends(get_current_user_id),
    service: CRUDService = Depends(get_crud_service),
) -> AnomalyRecordResponse:
    record = service.update_owned(AnomalyRecord, user_id, anomaly_id, **payload.model_dump(exclude_unset=True))
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anomaly record not found")
    return record
