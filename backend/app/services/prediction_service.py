from __future__ import annotations

from datetime import datetime, timezone
import os
from typing import List

import joblib
import numpy as np

from sqlalchemy.orm import Session

from app.repositories.prediction_repository import PredictionRepository
from app.schemas.feature import FeatureVector
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
                from config import MODEL_PATH as CP_MODEL_PATH
                self.model_path = CP_MODEL_PATH
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model not found at {self.model_path}. Run training first.")
            self._model = joblib.load(self.model_path)
        return self._model

    def _feature_order(self, fv: FeatureVector) -> List[float]:
        # Ensure exact ordering as training: config.ALL_FEATURES + engineered ordering
        ordered = []
        # load canonical feature order from config at runtime
        try:
            from config import ALL_FEATURES as CF
        except Exception:
            CF = []
        for feat in CF:
            val = getattr(fv, feat, None)
            ordered.append(float(val) if val is not None else np.nan)
        return ordered

    def predict_value(self, feature_vector: FeatureVector) -> float:
        model = self._load_model()
        x = np.array([self._feature_order(feature_vector)])
        pred = model.predict(x)
        return float(pred[0])

    def predict_for_observation(self, user_id: str, observation_id: str, feature_vector: FeatureVector) -> MilkPrediction:
        # validate observation and ownership
        obs = self.db.query(DailyObservation).get(observation_id)
        if obs is None:
            raise ValueError("Observation not found")
        if obs.owner_id != user_id:
            raise PermissionError("User does not own this observation")

        cow = self.db.query(Cow).get(obs.cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        if cow.owner_id != user_id:
            raise PermissionError("User does not own this cow")

        farm = self.db.query(Farm).get(cow.farm_id)
        if farm is None:
            raise ValueError("Farm not found")
        # owner check: farm.created_by or owner_id
        if getattr(farm, "created_by", None) != user_id and getattr(farm, "owner_id", None) not in (None, user_id):
            raise PermissionError("User does not own this farm")

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
