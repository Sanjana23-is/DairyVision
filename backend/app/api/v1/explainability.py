from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user_id
from app.schemas.explainability import ExplainabilityResponse
from app.schemas.feature import FeatureVector
from app.services.explainability_service import ExplainabilityService

router = APIRouter()


def get_explainability_service(db: Session = Depends(get_db)) -> ExplainabilityService:
    return ExplainabilityService(db)


@router.post("/explainability", response_model=ExplainabilityResponse)
def explain(
    payload: dict,
    user_id: str = Depends(get_current_user_id),
    service: ExplainabilityService = Depends(get_explainability_service),
):
    # payload must contain either prediction_id or feature_vector
    pred_id = payload.get("prediction_id")
    fv_payload = payload.get("feature_vector")
    try:
        if pred_id:
            res = service.explain(user_id, prediction_id=pred_id)
        else:
            if fv_payload is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing input")
            fv = FeatureVector(**fv_payload)
            res = service.explain(user_id, feature_vector=fv)

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
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
