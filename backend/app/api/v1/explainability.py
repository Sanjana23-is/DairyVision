from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.exceptions import ExplainabilityNotFound, ExplainabilityValidationError
from app.models import AnomalyRecord, Cow, DailyObservation, MilkPrediction
from app.schemas.explainability import (
    ExplainabilityHistoryResponse,
    ExplainabilityResponse,
    ExplainableItem,
)
from app.schemas.feature import FeatureVector
from app.services.explainability_service import (
    ExplainabilityService,
    format_feature_value,
    format_impact_description,
    get_display_feature_name,
)

router = APIRouter()


class ExplainabilityRequest(BaseModel):
    prediction_id: Optional[str] = None
    anomaly_id: Optional[str] = None
    feature_vector: Optional[FeatureVector] = None


def get_explainability_service(db: Session = Depends(get_db)) -> ExplainabilityService:
    return ExplainabilityService(db)


@router.get("/explainability/history", response_model=ExplainabilityHistoryResponse)
def get_explainability_history(
    farm_id: Optional[str] = Query(None),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> ExplainabilityHistoryResponse:
    # 1. Predictions history
    pred_query = db.query(MilkPrediction).filter(MilkPrediction.owner_id == user_id)
    if farm_id:
        pred_query = pred_query.filter(MilkPrediction.farm_id == farm_id)
    predictions = pred_query.order_by(MilkPrediction.created_at.desc()).limit(20).all()

    # 2. Anomalies history
    anom_query = db.query(AnomalyRecord).filter(AnomalyRecord.owner_id == user_id)
    if farm_id:
        anom_query = anom_query.filter(AnomalyRecord.farm_id == farm_id)
    anomalies = anom_query.order_by(AnomalyRecord.detected_at.desc()).limit(20).all()

    cows = db.query(Cow).filter(Cow.owner_id == user_id).all()
    cow_map = {c.id: c.name or c.tag_id or c.id for c in cows}

    items: list[ExplainableItem] = []

    for p in predictions:
        obs = p.observation_id and db.get(DailyObservation, p.observation_id)
        obs_date_str = obs.observation_date.strftime("%d %b %Y") if obs and obs.observation_date else p.created_at.strftime("%d %b %Y")
        cow_name = cow_map.get(p.cow_id, "Cow")
        yield_val = float(p.predicted_milk_yield)
        items.append(
            ExplainableItem(
                type="prediction",
                id=p.id,
                cow_id=p.cow_id,
                cow_name=cow_name,
                date=obs_date_str,
                label=f"Predicted Yield: {yield_val:.1f} L",
                prediction_id=p.id,
            )
        )

    for a in anomalies:
        obs = a.observation_id and db.get(DailyObservation, a.observation_id)
        obs_date_str = obs.observation_date.strftime("%d %b %Y") if obs and obs.observation_date else a.detected_at.strftime("%d %b %Y")
        cow_name = cow_map.get(a.cow_id, "Cow")
        items.append(
            ExplainableItem(
                type="anomaly",
                id=a.id,
                cow_id=a.cow_id,
                cow_name=cow_name,
                date=obs_date_str,
                label=f"Anomaly: {a.severity} ({int(round(a.anomaly_score * 100))}% Risk)",
                anomaly_id=a.id,
            )
        )

    return ExplainabilityHistoryResponse(items=items)


@router.post("/explainability", response_model=ExplainabilityResponse)
def explain(
    payload: ExplainabilityRequest,
    user_id: str = Depends(get_current_user_id),
    service: ExplainabilityService = Depends(get_explainability_service),
):
    if payload.anomaly_id:
        try:
            return service.explain_anomaly(user_id=user_id, anomaly_id=payload.anomaly_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        except ExplainabilityNotFound as enf:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(enf))

    if payload.prediction_id is None and payload.feature_vector is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing prediction_id, anomaly_id, or feature_vector")

    try:
        res = service.explain(
            user_id,
            prediction_id=payload.prediction_id,
            feature_vector=payload.feature_vector,
        )

        details = res.details or {}
        raw_features = details.get("features", [])

        features = []
        for f in raw_features:
            feat_key = f["feature"]
            display_name = f.get("display_name") or get_display_feature_name(feat_key)
            val = f.get("value")
            val_fmt = f.get("value_formatted") or format_feature_value(feat_key, val)
            sv = f.get("shap_value", 0.0)
            direction = f.get("impact_direction") or ("Positive" if sv > 0.01 else ("Negative" if sv < -0.01 else "Neutral"))
            desc = f.get("impact_description") or format_impact_description(sv)

            features.append(
                {
                    "feature": feat_key,
                    "display_name": display_name,
                    "value": val,
                    "value_formatted": val_fmt,
                    "shap_value": sv,
                    "rank": f.get("rank", 0),
                    "impact_direction": direction,
                    "impact_description": desc,
                }
            )

        top_pos = [f for f in features if f["impact_direction"] == "Positive"][:5]
        top_neg = [f for f in features if f["impact_direction"] == "Negative"][:5]

        return {
            "id": res.id,
            "prediction_id": res.prediction_id,
            "anomaly_id": None,
            "observation_id": res.observation_id,
            "cow_id": res.cow_id,
            "cow_name": details.get("cow_name"),
            "farm_id": res.farm_id,
            "observation_date": details.get("observation_date"),
            "predicted_yield": details.get("predicted_yield"),
            "anomaly_severity": None,
            "computed_at": res.computed_at,
            "model_version": res.model_version,
            "summary_narrative": details.get("summary_narrative"),
            "features": features,
            "top_positive": top_pos,
            "top_negative": top_neg,
        }
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    except ExplainabilityNotFound as enf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(enf))
    except (ExplainabilityValidationError, ValueError) as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(re))
