from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.crud import RecommendationResponse
from app.schemas.recommendation import RecommendationGenerateRequest
from app.services.recommendation_service import RecommendationService

router = APIRouter()


def get_recommendation_service(db: Session = Depends(get_db)) -> RecommendationService:
    return RecommendationService(db)


@router.post("/recommendations/generate", response_model=list[RecommendationResponse], status_code=status.HTTP_201_CREATED)
def generate_recommendations(
    payload: RecommendationGenerateRequest,
    user_id: str = Depends(get_current_user_id),
    service: RecommendationService = Depends(get_recommendation_service),
):
    try:
        results = service.generate_recommendations(
            user_id=user_id,
            health_alert_id=payload.health_alert_id,
            prediction_id=payload.prediction_id,
            explainability_id=payload.explainability_id,
            observation_id=payload.observation_id,
            weather_log_id=payload.weather_log_id,
        )
        return results
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
