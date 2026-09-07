from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

import joblib
import numpy as np
from sqlalchemy.orm import Session

from app.exceptions import ExplainabilityNotFound, ExplainabilityValidationError
from app.models import AnomalyRecord, Cow, DailyObservation, Farm, MilkPrediction
from app.models.explainability_result import ExplainabilityResult
from app.repositories.explainability_repository import ExplainabilityRepository
from app.repositories.ownership import ensure_record_accessible
from app.schemas.feature import FeatureVector
from app.services.feature_engineering_service import FeatureEngineeringService

logger = logging.getLogger(__name__)

FEATURE_NAME_MAP = {
    "milk_output": "Current Day Milk Yield",
    "milk_lag_1d": "Previous Day Milk Yield",
    "feed": "Daily Feed Intake (kg)",
    "thi": "Heat Stress Index (THI)",
    "weight": "Cow Weight (kg)",
    "age": "Cow Age (Years)",
    "rolling_avg_7d": "7-Day Production Baseline",
    "temp_humidity_interaction": "Heat & Humidity Combo",
    "body_temperature_c": "Body Temperature (°C)",
    "body_condition_score": "Body Condition Score",
    "health_condition": "Health Condition Status",
}


def get_display_feature_name(feat_key: str) -> str:
    return FEATURE_NAME_MAP.get(feat_key, feat_key.replace("_", " ").title())


def format_feature_value(feat_key: str, value: Optional[float]) -> str:
    if value is None:
        return "—"
    if feat_key == "thi":
        return f"{value:.1f} THI"
    if feat_key in ("feed", "weight"):
        return f"{value:.1f} kg"
    if feat_key in ("milk_output", "milk_lag_1d", "rolling_avg_7d"):
        return f"{value:.1f} L"
    if feat_key == "age":
        return f"{value:.1f} yrs"
    if feat_key == "body_temperature_c":
        return f"{value:.1f} °C"
    return f"{value:.2f}"


def format_impact_description(shap_val: float) -> str:
    abs_val = abs(shap_val)
    if shap_val > 0.05:
        return f"+{abs_val:.2f} L/day model-estimated contribution"
    elif shap_val < -0.05:
        return f"-{abs_val:.2f} L/day model-estimated contribution"
    return "Neutral model contribution"


class ExplainabilityService:
    def __init__(self, db: Session, model_path: Optional[str] = None) -> None:
        self.db = db
        self.repo = ExplainabilityRepository(db)
        self.model_path = model_path
        self._model = None

    def _load_model(self):
        if self._model is None:
            if self.model_path is None:
                from app.core.project_paths import ensure_project_root_on_path
                ensure_project_root_on_path()
                from config import MODEL_PATH as CP_MODEL_PATH

                self.model_path = CP_MODEL_PATH
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model not found at {self.model_path}. Run training first.")
            self._model = joblib.load(self.model_path)
        return self._model

    def _feature_order(self, fv: FeatureVector) -> List[float]:
        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        from config import ALL_FEATURES as CF

        missing = [feat for feat in CF if getattr(fv, feat, None) is None]
        if missing:
            raise ExplainabilityValidationError(
                "Cannot generate an explanation: missing required data for "
                + ", ".join(missing)
                + ". Record a complete observation before generating an explanation."
            )

        return [float(getattr(fv, feat)) for feat in CF]

    def _fingerprint(self, model_version: str, values: List[float]) -> str:
        m = hashlib.sha1()
        m.update(str(model_version).encode("utf-8"))
        arr = ",".join([str(v) for v in values])
        m.update(arr.encode("utf-8"))
        return m.hexdigest()

    def _generate_narrative(
        self,
        predicted_yield: Optional[float],
        top_positive: List[dict],
        top_negative: List[dict],
        cow_name: Optional[str] = None,
    ) -> str:
        subject = f"For cow '{cow_name}'" if cow_name else "For this cow"
        
        if top_negative and abs(top_negative[0]["shap_value"]) > 0.05:
            top_neg = top_negative[0]
            val_str = f" ({top_neg['value_formatted']})" if top_neg.get("value_formatted") else ""
            return (
                f"{top_neg['display_name']}{val_str} is the strongest factor lowering the model's predicted yield, "
                f"contributing approximately {top_neg['shap_value']:.1f} L/day relative to the model baseline."
            )
        elif top_positive and top_positive[0]["shap_value"] > 0.05:
            top_pos = top_positive[0]
            val_str = f" ({top_pos['value_formatted']})" if top_pos.get("value_formatted") else ""
            return (
                f"{top_pos['display_name']}{val_str} is the strongest factor supporting the model's predicted yield, "
                f"contributing approximately +{top_pos['shap_value']:.1f} L/day relative to the model baseline."
            )

        return (
            f"{subject}, predicted yield matches normal baseline production expectations with no major "
            "model-estimated environmental or feed penalties."
        )

    def _generate_actionable_advice(self, top_negative: List[dict]) -> str:
        if not top_negative or abs(top_negative[0]["shap_value"]) <= 0.05:
            return (
                "Production is currently within the model's expected range. "
                "Continue monitoring feed, health, and environmental conditions."
            )

        top_feat = top_negative[0].get("feature", "").lower()

        if top_feat in ("thi", "temperature", "humidity", "temp_humidity_interaction", "thi_squared", "feed_thi_interaction"):
            return "Review cooling conditions during the hottest part of the day and ensure adequate access to fresh water and shade."
        elif top_feat in ("feed", "feed_quantity_kg"):
            return "Review the current feed intake and ration consistency with the farm's feeding plan."
        elif top_feat in ("body_condition_score", "weight", "age"):
            return "Monitor body condition and review whether the current nutrition plan is appropriate for the lactation stage."
        elif top_feat in ("body_temperature_c", "health_condition", "symptoms"):
            return "Check the cow for signs of discomfort or health stress and consider a closer herd health assessment."

        return "Continue monitoring herd conditions. No specific management action was identified from the available model information."

    def explain(
        self,
        user_id: str,
        prediction_id: Optional[str] = None,
        feature_vector: Optional[FeatureVector] = None,
        persist: bool = True,
    ) -> ExplainabilityResult:
        obs = None
        cow = None
        farm = None
        prediction = None

        if prediction_id:
            prediction = self.db.get(MilkPrediction, prediction_id)
            if prediction is None:
                raise ExplainabilityNotFound("Prediction not found")
            if prediction.owner_id != user_id:
                raise PermissionError("User does not own this prediction")

            cached_by_prediction = self.repo.get_by_prediction_id(prediction_id)
            if cached_by_prediction is not None:
                return cached_by_prediction

            if getattr(prediction, "observation_id", None) is None:
                raise ExplainabilityValidationError("Prediction has no linked observation and no feature_vector provided")
            obs = self.db.get(DailyObservation, prediction.observation_id)
            if obs is None:
                raise ExplainabilityNotFound("Observation not found")
            cow = self.db.get(Cow, obs.cow_id)
            if cow is None:
                raise ExplainabilityNotFound("Cow not found")
            if cow.owner_id != user_id:
                raise PermissionError("User does not own this cow")
            farm = self.db.get(Farm, cow.farm_id)
            if farm is None:
                raise ExplainabilityNotFound("Farm not found")
            ensure_record_accessible(farm, user_id)

            if feature_vector is None:
                feature_vector = FeatureEngineeringService(self.db).build_features_for_observation(user_id, obs.id)

        else:
            if feature_vector is None:
                raise ExplainabilityValidationError("Either prediction_id or feature_vector must be provided")
            obs_id = getattr(feature_vector, "observation_id", None)
            if obs_id is None:
                raise ExplainabilityValidationError("feature_vector must include observation_id when no prediction_id provided")
            obs = self.db.get(DailyObservation, obs_id)
            if obs is None:
                raise ExplainabilityNotFound("Observation not found")
            if obs.owner_id != user_id:
                raise PermissionError("User does not own this observation")
            cow = self.db.get(Cow, obs.cow_id)
            if cow is None:
                raise ExplainabilityNotFound("Cow not found")
            if cow.owner_id != user_id:
                raise PermissionError("User does not own this cow")
            farm = self.db.get(Farm, cow.farm_id)
            if farm is None:
                raise ExplainabilityNotFound("Farm not found")
            ensure_record_accessible(farm, user_id)

        model = self._load_model()
        model_version = getattr(model, "__version__", os.path.basename(self.model_path))

        fv = feature_vector
        ordered = self._feature_order(fv)

        fingerprint = self._fingerprint(model_version, ordered)
        cached = self.repo.get_by_fingerprint(fingerprint)
        if cached is not None:
            return cached

        # Compute SHAP values
        vals = None
        try:
            import shap
            try:
                explainer = shap.TreeExplainer(model)
                x = np.array([ordered])
                shap_values = explainer.shap_values(x)
                vals = shap_values[0] if (isinstance(shap_values, np.ndarray) and shap_values.ndim == 2) else (shap_values[0] if isinstance(shap_values, list) else shap_values)
            except Exception:
                # Fallback for LinearRegression / Non-tree models
                if hasattr(model, "coef_") and len(model.coef_) == len(ordered):
                    coefs = np.array(model.coef_, dtype=float)
                    vals = coefs * np.array(ordered, dtype=float)
                else:
                    explainer = shap.Explainer(model, np.zeros((1, len(ordered))))
                    shap_values = explainer(np.array([ordered]))
                    vals = shap_values.values[0]
        except Exception as e:
            logger.warning(f"SHAP explanation fallback used: {e}")
            if hasattr(model, "coef_") and len(model.coef_) == len(ordered):
                vals = np.array(model.coef_, dtype=float) * np.array(ordered, dtype=float)
            else:
                vals = np.zeros(len(ordered))


        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        from config import ALL_FEATURES as CF

        features = []
        for i, feat in enumerate(CF):
            v = float(getattr(fv, feat))
            sv = float(vals[i]) if i < len(vals) else 0.0
            direction = "Positive" if sv > 0.01 else ("Negative" if sv < -0.01 else "Neutral")
            features.append(
                {
                    "feature": feat,
                    "display_name": get_display_feature_name(feat),
                    "value": v,
                    "value_formatted": format_feature_value(feat, v),
                    "shap_value": sv,
                    "impact_direction": direction,
                    "impact_description": format_impact_description(sv),
                }
            )

        features_sorted = sorted(features, key=lambda d: abs(d["shap_value"]), reverse=True)
        for idx, it in enumerate(features_sorted, start=1):
            it["rank"] = idx

        top_positive = [f for f in features_sorted if f["shap_value"] > 0][:5]
        top_negative = [f for f in features_sorted if f["shap_value"] < 0][:5]

        cow_name = cow.name or cow.tag_id if cow else None
        pred_yield = float(prediction.predicted_milk_yield) if prediction else None
        narrative = self._generate_narrative(pred_yield, top_positive, top_negative, cow_name)
        advice = self._generate_actionable_advice(top_negative)

        result = ExplainabilityResult(
            prediction_id=prediction_id,
            fingerprint=fingerprint,
            owner_id=user_id,
            observation_id=obs.id if obs is not None else None,
            cow_id=getattr(cow, "id", None),
            farm_id=getattr(farm, "id", None),
            model_version=str(model_version),
            details={
                "features": features_sorted,
                "summary_narrative": narrative,
                "actionable_advice": advice,
                "cow_name": cow_name,
                "observation_date": obs.observation_date.strftime("%Y-%m-%d") if obs and obs.observation_date else None,
                "predicted_yield": pred_yield,
            },
            top_positive=top_positive,
            top_negative=top_negative,
        )

        if persist:
            saved = self.repo.save(result)
            return saved

        if getattr(result, "id", None) is None:
            result.id = str(uuid4())
        if getattr(result, "computed_at", None) is None:
            result.computed_at = datetime.now(timezone.utc)
        return result

    def explain_anomaly(self, user_id: str, anomaly_id: str) -> dict:
        anomaly = self.db.get(AnomalyRecord, anomaly_id)
        if anomaly is None:
            raise ExplainabilityNotFound("Anomaly record not found")
        if anomaly.owner_id != user_id:
            raise PermissionError("User does not own this anomaly record")

        cow = self.db.get(Cow, anomaly.cow_id)
        cow_name = cow.name or cow.tag_id if cow else "Cow"
        tags = anomaly.issue_tags if isinstance(anomaly.issue_tags, list) else []

        details = anomaly.details or {}
        features = []
        idx = 1
        for k, v in details.items():
            if k in ("anomaly_score",):
                continue
            display = get_display_feature_name(k)
            val_fmt = format_feature_value(k, float(v) if isinstance(v, (int, float)) else None)
            features.append(
                {
                    "feature": k,
                    "display_name": display,
                    "value": float(v) if isinstance(v, (int, float)) else None,
                    "value_formatted": val_fmt,
                    "shap_value": anomaly.anomaly_score if "Drop" in display or "Stress" in display else -0.1,
                    "rank": idx,
                    "impact_direction": "Negative" if anomaly.severity != "Normal" else "Neutral",
                    "impact_description": f"Contributed to {anomaly.severity} anomaly risk",
                }
            )
            idx += 1

        score_pct = int(round(anomaly.anomaly_score * 100)) if anomaly.anomaly_score is not None else 0
        narrative = (
            f"Cow '{cow_name}' was flagged with a {anomaly.severity} anomaly (Risk Score: {score_pct}%). "
            f"Primary factors include: {', '.join(tags)}."
            if tags
            else f"Cow '{cow_name}' shows normal behavior patterns."
        )

        top_neg = [f for f in features if f["impact_direction"] == "Negative"]
        advice = self._generate_actionable_advice(top_neg)

        return {
            "id": anomaly.id,
            "anomaly_id": anomaly.id,
            "cow_id": anomaly.cow_id,
            "cow_name": cow_name,
            "farm_id": anomaly.farm_id,
            "anomaly_severity": anomaly.severity,
            "computed_at": anomaly.detected_at,
            "summary_narrative": narrative,
            "actionable_advice": advice,
            "features": features,
            "top_positive": [f for f in features if f["impact_direction"] == "Positive"],
            "top_negative": top_neg,
        }
