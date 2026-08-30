from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.exceptions import ExplainabilityNotFound, ExplainabilityValidationError
from app.schemas.explainability import ExplainabilityResponse
from app.schemas.feature import FeatureVector
from app.services.explainability_service import ExplainabilityService

router = APIRouter()


class ExplainabilityRequest(BaseModel):
    prediction_id: Optional[str] = None
    feature_vector: Optional[FeatureVector] = None


def get_explainability_service(db: Session = Depends(get_db)) -> ExplainabilityService:
    return ExplainabilityService(db)


@router.post("/explainability", response_model=ExplainabilityResponse)
def explain(
    payload: ExplainabilityRequest,
    user_id: str = Depends(get_current_user_id),
    service: ExplainabilityService = Depends(get_explainability_service),
):
    if payload.prediction_id is None and payload.feature_vector is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing input")
    try:
        res = service.explain(
            user_id,
            prediction_id=payload.prediction_id,
            feature_vector=payload.feature_vector,
        )

        # build response
        features = [
            {
                "feature": f["feature"],
                "value": f.get("value"),
                "shap_value": f.get("shap_value"),
                "rank": f.get("rank", 0),
            }
            for f in (res.details or {}).get("features", [])
        ]

        top_pos = res.top_positive or []
        top_neg = res.top_negative or []

        return {
            "id": res.id,
            "prediction_id": res.prediction_id,
            "observation_id": res.observation_id,
            "cow_id": res.cow_id,
            "farm_id": res.farm_id,
            "computed_at": res.computed_at,
            "model_version": res.model_version,
            "features": features,
            "top_positive": top_pos,
            "top_negative": top_neg,
        }
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ExplainabilityNotFound as enf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(enf))
    except (ExplainabilityValidationError, ValueError) as ve:
        # Covers both our own explicit validation (e.g. missing required
        # features) and any ValueError the model/SHAP itself raises --
        # neither is a "resource not found" condition, so neither should be
        # reported as a 404.
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
