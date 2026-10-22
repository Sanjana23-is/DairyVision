from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import List

import joblib
import numpy as np

from sqlalchemy.orm import Session

from app.exceptions import PredictionNotFound, PredictionValidationError
from app.repositories.ownership import ensure_record_accessible
from app.repositories.prediction_repository import PredictionRepository
from app.schemas.feature import FeatureVector
from app.services.feature_engineering_service import FeatureEngineeringService
from app.models import MilkPrediction, DailyObservation, Cow, Farm
# defer importing config until runtime to avoid import-time package resolution issues


class PredictionService:
    def __init__(self, db: Session, model_path: str | None = None) -> None:
        self.db = db
        self.repo = PredictionRepository(db)
        self.model_path = model_path
        self._model = None

    def _load_model(self):
        if self._model is None:
            # determine model path from config if not provided
            if self.model_path is None:
                from app.core.project_paths import ensure_project_root_on_path
                ensure_project_root_on_path()
                try:
                    from ml_engine.config import MODEL_PATH as CP_MODEL_PATH
                except ImportError:
                    from config import MODEL_PATH as CP_MODEL_PATH
                self.model_path = CP_MODEL_PATH
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model not found at {self.model_path}. Run training first.")
            self._model = joblib.load(self.model_path)
        return self._model

    def _feature_order(self, fv: FeatureVector) -> List[float]:
        # Ensure exact ordering as training: config.ALL_FEATURES + engineered ordering
        # load canonical feature order from config at runtime
        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        try:
            from ml_engine.config import ALL_FEATURES as CF
        except ImportError:
            from config import ALL_FEATURES as CF

        missing = [feat for feat in CF if getattr(fv, feat, None) is None]
        if missing:
            weather_feats = {"temperature", "humidity", "thi", "temp_humidity", "thi_squared", "feed_thi_interaction"}
            missing_weather = any(f in weather_feats for f in missing)
            if missing_weather:
                msg = (
                    "Cannot generate a prediction: missing required weather data. "
                    "Weather data (temperature, humidity, THI) is required for prediction. "
                    "Ensure the farm has valid geographic coordinates (latitude and longitude) set so weather can be retrieved."
                )
                non_weather_missing = [f for f in missing if f not in weather_feats]
                if non_weather_missing:
                    msg += f" Additional missing features: {', '.join(non_weather_missing)}."
            else:
                msg = f"Cannot generate a prediction: missing required data for {', '.join(missing)}."

            raise PredictionValidationError(msg)

        vals: List[float] = []
        # FeatureEngineeringService stores age in years on FeatureVector (fv.age = cow.age_months / 12.0).
        # The ML training pipeline (ml_engine) maps Age_Months directly to 'age' and computes
        # age_weight_ratio = age_months / weight.
        # Explicitly convert age in years to months at the model-inference boundary without heuristics.
        age_years = float(getattr(fv, "age"))
        age_months = age_years * 12.0
        weight = float(getattr(fv, "weight")) if getattr(fv, "weight", None) is not None else 0.0

        for feat in CF:
            if feat == "age":
                val = age_months
            elif feat == "age_weight_ratio":
                val = (age_months / weight) if weight > 0 else 0.0
            else:
                val = float(getattr(fv, feat))

            vals.append(val)

        return vals

    def predict_value(self, feature_vector: FeatureVector) -> float:
        model = self._load_model()
        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        try:
            from ml_engine.config import ALL_FEATURES as CF
        except ImportError:
            from config import ALL_FEATURES as CF
        import pandas as pd

        feature_vals = self._feature_order(feature_vector)
        if hasattr(model, "feature_names_in_"):
            try:
                x = pd.DataFrame([feature_vals], columns=model.feature_names_in_)
                pred = model.predict(x)
                return float(pred[0])
            except Exception:
                pass
        x = np.array([feature_vals])
        pred = model.predict(x)
        return float(pred[0])

    def _compute_confidence_interval(
        self,
        farm_id: str,
        predicted_yield: float,
        baseline_res: Optional[Any] = None,
    ) -> tuple[float, float, float, str]:
        """
        Estimates prediction uncertainty bounds.
        - If primary yield comes from an established historical baseline, uncertainty is computed
          directly from the cow's empirical variability (historical_variability) and marked 'historical'.
        - If primary yield is a provisional baseline, it is marked 'limited_data' as it is uncalibrated.
        - If from ML model (insufficient baseline history), bounds are estimated from farm historical
          prediction residuals (>= 3 residuals -> 'historical', else -> 'limited_data').
        Returns: (confidence_score, confidence_lower, confidence_upper, confidence_data_status)
        """
        from app.services.milk_baseline_service import BaselineStatus

        try:
            if baseline_res is not None and baseline_res.expected_baseline is not None:
                if baseline_res.baseline_status == BaselineStatus.ESTABLISHED_BASELINE:
                    variability = (
                        baseline_res.historical_variability
                        if baseline_res.historical_variability is not None
                        else 0.50
                    )
                    std_err = max(0.20, float(variability))
                    err_margin = 1.96 * std_err
                    conf_lower = round(max(0.0, min(predicted_yield, predicted_yield - err_margin)), 2)
                    conf_upper = round(max(predicted_yield, predicted_yield + err_margin), 2)
                    conf_score = round(max(0.50, min(0.99, 1.0 - (std_err / max(predicted_yield, 1.0)))), 2)
                    return conf_score, conf_lower, conf_upper, "historical"
                elif baseline_res.baseline_status == BaselineStatus.PROVISIONAL_BASELINE:
                    variability = (
                        baseline_res.historical_variability
                        if baseline_res.historical_variability is not None
                        else 1.50
                    )
                    std_err = max(0.50, float(variability))
                    err_margin = 1.96 * std_err
                    conf_lower = round(max(0.0, min(predicted_yield, predicted_yield - err_margin)), 2)
                    conf_upper = round(max(predicted_yield, predicted_yield + err_margin), 2)
                    conf_score = round(max(0.50, min(0.85, 1.0 - (std_err / max(predicted_yield, 1.0)))), 2)
                    return conf_score, conf_lower, conf_upper, "limited_data"

            # Machine Learning inference: estimate bounds from farm historical prediction residuals
            pairs = (
                self.db.query(
                    MilkPrediction.predicted_milk_yield,
                    DailyObservation.milk_produced_liters,
                )
                .join(Cow, Cow.id == MilkPrediction.cow_id)
                .join(DailyObservation, DailyObservation.id == MilkPrediction.observation_id)
                .filter(
                    Cow.farm_id == farm_id,
                    DailyObservation.milk_produced_liters.isnot(None),
                    DailyObservation.milk_produced_liters > 0,
                )
                .limit(100)
                .all()
            )

            residuals = [
                float(obs_milk) - float(pred_milk)
                for pred_milk, obs_milk in pairs
                if pred_milk is not None and obs_milk is not None
            ]

            n = len(residuals)
            if n >= 3:
                mean_r = sum(residuals) / n
                var_r = sum((r - mean_r) ** 2 for r in residuals) / (n - 1)
                std_err = float(np.sqrt(max(0.01, var_r)))
                if std_err < 0.2:
                    std_err = 0.5

                err_margin = 1.96 * std_err
                conf_lower = round(max(0.0, min(predicted_yield, predicted_yield - err_margin)), 2)
                conf_upper = round(max(predicted_yield, predicted_yield + err_margin), 2)
                conf_score = round(max(0.50, min(0.99, 1.0 - (std_err / max(predicted_yield, 1.0)))), 2)
                status = "historical"
            else:
                std_err = 1.50
                err_margin = 1.96 * std_err
                conf_lower = round(max(0.0, min(predicted_yield, predicted_yield - err_margin)), 2)
                conf_upper = round(max(predicted_yield, predicted_yield + err_margin), 2)
                conf_score = round(max(0.50, min(0.85, 1.0 - (std_err / max(predicted_yield, 1.0)))), 2)
                status = "limited_data"

            conf_lower = max(0.0, min(conf_lower, predicted_yield))
            conf_upper = max(predicted_yield, conf_upper)

            return conf_score, conf_lower, conf_upper, status
        except Exception:
            std_err = 1.50
            err_margin = 1.96 * std_err
            conf_lower = round(max(0.0, min(predicted_yield, predicted_yield - err_margin)), 2)
            conf_upper = round(max(predicted_yield, predicted_yield + err_margin), 2)
            conf_score = 0.75
            return conf_score, conf_lower, conf_upper, "limited_data"

    def predict_for_observation(self, user_id: str, observation_id: str) -> MilkPrediction:
        # validate observation and ownership
        obs = self.db.get(DailyObservation, observation_id)
        if obs is None:
            raise PredictionNotFound("Observation not found")
        if obs.owner_id != user_id:
            raise PermissionError("User does not own this observation")

        cow = self.db.get(Cow, obs.cow_id)
        if cow is None:
            raise PredictionNotFound("Cow not found")
        if cow.owner_id != user_id:
            raise PermissionError("User does not own this cow")

        farm = self.db.get(Farm, cow.farm_id)
        if farm is None:
            raise PredictionNotFound("Farm not found")
        ensure_record_accessible(farm, user_id)

        # 1. Compute robust, historical expected baseline (strictly observations < obs.observation_date)
        from app.services.milk_baseline_service import MilkBaselineService, BaselineStatus
        from app.services.milk_anomaly_service import MilkAnomalyService, AnomalyStatus

        baseline_svc = MilkBaselineService(self.db)
        baseline_res = baseline_svc.compute_cow_baseline(cow.id, obs.observation_date)

        # 2. Check for previous observation drop persistence
        prev_obs = (
            self.db.query(DailyObservation)
            .filter(
                DailyObservation.cow_id == cow.id,
                DailyObservation.observation_date < obs.observation_date,
                DailyObservation.milk_produced_liters.isnot(None),
            )
            .order_by(DailyObservation.observation_date.desc())
            .first()
        )
        prev_drop_liters = None
        if prev_obs and prev_obs.milk_produced_liters is not None and baseline_res.expected_baseline is not None:
            prev_drop_liters = baseline_res.expected_baseline - float(prev_obs.milk_produced_liters)

        actual_milk = float(obs.milk_produced_liters) if obs.milk_produced_liters is not None else None
        anomaly_res = MilkAnomalyService.evaluate_observation(
            actual_yield=actual_milk,
            baseline=baseline_res,
            previous_drop_liters=prev_drop_liters,
        )

        # 3. Derive feature vector and attempt model inference
        ml_prediction: Optional[float] = None
        ml_error: Optional[Exception] = None
        try:
            feature_vector = FeatureEngineeringService(self.db).build_features_for_observation(
                user_id, observation_id
            )
            ml_prediction = self.predict_value(feature_vector)
        except Exception as exc:
            ml_error = exc

        # Determine primary predicted yield:
        # If an established or provisional baseline exists, it is the primary expected yield
        if baseline_res.expected_baseline is not None:
            predicted = baseline_res.expected_baseline
        elif ml_prediction is not None:
            predicted = ml_prediction
        else:
            if isinstance(ml_error, (PredictionValidationError, PredictionNotFound)):
                raise ml_error
            raise PredictionValidationError(
                f"Cannot generate milk yield estimation: insufficient historical observations "
                f"for a baseline and machine learning prediction unavailable ({ml_error or 'no prediction produced'})."
            )

        model_version = (
            "baseline_median_v1"
            if baseline_res.baseline_status == BaselineStatus.ESTABLISHED_BASELINE
            else getattr(self._load_model(), "__version__", os.path.basename(self.model_path or "best_milk_model.pkl"))
        )

        conf_score, conf_lower, conf_upper, conf_status = self._compute_confidence_interval(
            farm.id, predicted, baseline_res=baseline_res
        )

        mp = MilkPrediction(
            cow_id=cow.id,
            observation_id=obs.id,
            predicted_milk_yield=predicted,
            confidence_score=conf_score,
            model_version=str(model_version),
            owner_id=user_id,
            prediction_timestamp=datetime.now(timezone.utc),
        )

        saved = self.repo.save(mp)
        setattr(saved, "confidence_lower", conf_lower)
        setattr(saved, "confidence_upper", conf_upper)
        setattr(saved, "confidence_data_status", conf_status)

        # Attach enriched baseline and anomaly detection fields
        setattr(saved, "expected_baseline", baseline_res.expected_baseline)
        setattr(saved, "actual_yield", anomaly_res.actual_yield)
        setattr(saved, "residual_liters", anomaly_res.residual_liters)
        setattr(saved, "drop_liters", anomaly_res.drop_liters)
        setattr(saved, "drop_percentage", anomaly_res.drop_percentage)
        setattr(saved, "baseline_status", baseline_res.baseline_status.value)
        setattr(saved, "baseline_method", baseline_res.method)
        setattr(saved, "observations_used", baseline_res.observations_used)
        setattr(saved, "baseline_window_days", baseline_res.baseline_window_days)
        setattr(saved, "historical_variability", baseline_res.historical_variability)
        setattr(saved, "anomaly_status", anomaly_res.anomaly_status.value)
        setattr(saved, "alert_explanation", anomaly_res.alert_explanation)
        setattr(saved, "recommended_action", anomaly_res.recommended_action)
        setattr(saved, "data_quality_warnings", baseline_res.data_quality_warnings)

        return saved

    def get_cow_baseline_summary(self, cow_id: str, target_date: Optional[date] = None) -> dict[str, Any]:
        """Convenience method to retrieve baseline and anomaly evaluation without requiring pre-saved prediction."""
        from app.services.milk_baseline_service import MilkBaselineService
        from app.services.milk_anomaly_service import MilkAnomalyService
        from datetime import date as dt_date, datetime, timezone
        from app.models.daily_observation import DailyObservation
        from app.models.cow import Cow
        from app.models.farm import Farm

        target: dt_date
        if target_date is None:
            # Determine calendar date in the cow's farm timezone if available
            cow = self.db.query(Cow).filter(Cow.id == cow_id).first()
            farm = None
            if cow and cow.farm_id:
                farm = self.db.query(Farm).filter(Farm.id == cow.farm_id).first()

            tz_str = (farm.timezone or "").strip() if farm else ""
            if tz_str:
                import zoneinfo
                try:
                    target = datetime.now(zoneinfo.ZoneInfo(tz_str)).date()
                except Exception as exc:
                    import logging
                    logging.getLogger(__name__).warning(
                        "Invalid timezone '%s' on farm '%s', falling back to UTC: %s",
                        tz_str,
                        farm.id if farm else "unknown",
                        exc,
                    )
                    target = datetime.now(timezone.utc).date()
            else:
                target = datetime.now(timezone.utc).date()
        else:
            target = target_date

        baseline_svc = MilkBaselineService(self.db)
        baseline_res = baseline_svc.compute_cow_baseline(cow_id, target)

        # Look up observation(s) specifically on target date
        target_obs_records = (
            self.db.query(DailyObservation)
            .filter(
                DailyObservation.cow_id == cow_id,
                DailyObservation.observation_date == target,
            )
            .order_by(DailyObservation.created_at.desc())
            .all()
        )

        target_obs = None
        if target_obs_records:
            # Follow data-integrity rules: do not sum duplicate records or alter data.
            # Prioritize latest created entry that has recorded milk yield, or latest created entry.
            obs_with_milk = [o for o in target_obs_records if o.milk_produced_liters is not None]
            target_obs = obs_with_milk[0] if obs_with_milk else target_obs_records[0]

            if len(target_obs_records) > 1:
                dup_warning = (
                    f"Duplicate observation detected for target date {target.isoformat()}; "
                    "prioritizing latest entry."
                )
                if dup_warning not in baseline_res.data_quality_warnings:
                    baseline_res.data_quality_warnings.append(dup_warning)

        actual_milk = float(target_obs.milk_produced_liters) if target_obs and target_obs.milk_produced_liters is not None else None

        # Check for previous observation drop persistence
        prev_obs = (
            self.db.query(DailyObservation)
            .filter(
                DailyObservation.cow_id == cow_id,
                DailyObservation.observation_date < target,
                DailyObservation.milk_produced_liters.isnot(None),
            )
            .order_by(DailyObservation.observation_date.desc())
            .first()
        )
        prev_drop_liters = None
        if prev_obs and prev_obs.milk_produced_liters is not None and baseline_res.expected_baseline is not None:
            prev_drop_liters = baseline_res.expected_baseline - float(prev_obs.milk_produced_liters)

        anomaly_res = MilkAnomalyService.evaluate_observation(
            actual_yield=actual_milk,
            baseline=baseline_res,
            previous_drop_liters=prev_drop_liters,
        )

        summary = baseline_res.to_dict()
        summary.update(anomaly_res.to_dict())
        summary["observation_id"] = target_obs.id if target_obs else None
        summary["has_today_observation"] = target_obs is not None and actual_milk is not None
        summary["target_date"] = target.isoformat()
        summary["data_quality_warnings"] = baseline_res.data_quality_warnings
        return summary
