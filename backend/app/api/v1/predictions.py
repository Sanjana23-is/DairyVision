from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user_id
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
) -> MilkPredictionResponse:
    # payload must include observation linking info via metadata? We expect client to supply observation id in payload metadata
    # For now require observation_id in payload model (users can pass observation id in separate field)
    obs_id = getattr(payload, "observation_id", None)
    if obs_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing observation_id in feature vector payload")
    try:
        saved = service.predict_for_observation(user_id, obs_id, payload)
        return saved
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
