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


        return [float(getattr(fv, feat)) for feat in CF]

    def predict_value(self, feature_vector: FeatureVector) -> float:
        model = self._load_model()
        x = np.array([self._feature_order(feature_vector)])
        pred = model.predict(x)
        return float(pred[0])

    def _compute_confidence_interval(
        self,
        farm_id: str,
        predicted_yield: float,
    ) -> tuple[float, float, float, str]:
        """
        Estimates prediction uncertainty bounds from historical prediction residuals for the farm.
        Returns: (confidence_score, confidence_lower, confidence_upper, confidence_data_status)
        """
        try:
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

        # Derive the feature vector server-side from observation/cow/weather
        feature_vector = FeatureEngineeringService(self.db).build_features_for_observation(
            user_id, observation_id
        )

        predicted = self.predict_value(feature_vector)
        model_version = getattr(self._load_model(), "__version__", os.path.basename(self.model_path))

        conf_score, conf_lower, conf_upper, conf_status = self._compute_confidence_interval(
            farm.id, predicted
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
        return saved
