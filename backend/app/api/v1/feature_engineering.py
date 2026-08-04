from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.feature import FeatureVector
from app.services.feature_engineering_service import FeatureEngineeringService

router = APIRouter(prefix="/feature-engineering", tags=["feature-engineering"])


def get_feature_service(db: Session = Depends(get_db)) -> FeatureEngineeringService:
    return FeatureEngineeringService(db)


@router.get("/observations/{observation_id}", response_model=FeatureVector)
def build_features_for_observation(
    observation_id: str,
    user_id: str = Depends(get_current_user_id),
    service: FeatureEngineeringService = Depends(get_feature_service),
) -> FeatureVector:
    return service.build_features_for_observation(user_id, observation_id)
