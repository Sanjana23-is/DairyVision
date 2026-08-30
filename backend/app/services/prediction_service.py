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
            raise PredictionValidationError(
                "Cannot generate a prediction: missing required data for "
                + ", ".join(missing)
                + ". Record a complete observation (including feed and weather-dependent "
                "values) before generating a prediction."
            )

        return [float(getattr(fv, feat)) for feat in CF]

    def predict_value(self, feature_vector: FeatureVector) -> float:
        model = self._load_model()
        x = np.array([self._feature_order(feature_vector)])
        pred = model.predict(x)
        return float(pred[0])

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
        # data rather than trusting client-supplied values (Issue 3).
        feature_vector = FeatureEngineeringService(self.db).build_features_for_observation(
            user_id, observation_id
        )

        predicted = self.predict_value(feature_vector)
        model_version = getattr(self._load_model(), "__version__", os.path.basename(self.model_path))

        mp = MilkPrediction(
            cow_id=cow.id,
            observation_id=obs.id,
            predicted_milk_yield=predicted,
            model_version=str(model_version),
            owner_id=user_id,
            prediction_timestamp=datetime.now(timezone.utc),
        )

        saved = self.repo.save(mp)
        return saved
