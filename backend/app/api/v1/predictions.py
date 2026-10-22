from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.exceptions import PredictionNotFound, PredictionValidationError
from app.schemas.crud import MilkPredictionCreate, MilkPredictionResponse
from app.services.prediction_service import PredictionService
from app.schemas.feature import FeatureVector

router = APIRouter()


def get_prediction_service(db: Session = Depends(get_db)) -> PredictionService:
    return PredictionService(db)


@router.post("/predictions/milk-yield", response_model=MilkPredictionResponse, status_code=status.HTTP_201_CREATED)
def create_prediction(
    payload: FeatureVector,
    user_id: str = Depends(get_current_user_id),
    service: PredictionService = Depends(get_prediction_service),
) -> Any:
    # payload must include observation linking info via metadata? We expect client to supply observation id in payload metadata
    # For now require observation_id in payload model (users can pass observation id in separate field)
    obs_id = getattr(payload, "observation_id", None)
    if obs_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing observation_id in feature vector payload")
    try:
        saved = service.predict_for_observation(user_id, obs_id)
        return saved
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except PredictionNotFound as pnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(pnf))
    except (PredictionValidationError, ValueError) as ve:
        # Covers both our own explicit feature-completeness check and any
        # ValueError the model/sklearn itself raises (e.g. "Input X contains
        # NaN") -- neither is a "resource not found" condition, so neither
        # should be reported as a 404. Anything genuinely unexpected is not
        # caught here and falls through to FastAPI's default 500 handling.
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))


@router.get("/cows/{cow_id}/baseline")
def get_cow_baseline(
    cow_id: str,
    target_date: str | None = None,
    user_id: str = Depends(get_current_user_id),
    service: PredictionService = Depends(get_prediction_service),
) -> Any:
    from datetime import date as dt_date
    parsed_date = None
    if target_date:
        try:
            parsed_date = dt_date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format, use YYYY-MM-DD")
    try:
        return service.get_cow_baseline_summary(cow_id, parsed_date)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
