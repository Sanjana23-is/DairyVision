from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import os
from typing import List, Optional

import joblib
import numpy as np

from sqlalchemy.orm import Session

from app.repositories.explainability_repository import ExplainabilityRepository
from app.schemas.feature import FeatureVector
from app.models import MilkPrediction, DailyObservation, Cow, Farm
from app.models.explainability_result import ExplainabilityResult


class ExplainabilityService:
    def __init__(self, db: Session, model_path: Optional[str] = None) -> None:
        self.db = db
        self.repo = ExplainabilityRepository(db)
        self.model_path = model_path
        self._model = None

    def _load_model(self):
        if self._model is None:
            if self.model_path is None:
                from config import MODEL_PATH as CP_MODEL_PATH

                self.model_path = CP_MODEL_PATH
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model not found at {self.model_path}. Run training first.")
            self._model = joblib.load(self.model_path)
        return self._model

    def _feature_order(self, fv: FeatureVector) -> List[float]:
        ordered = []
        try:
            from config import ALL_FEATURES as CF
        except Exception:
            CF = []
        for feat in CF:
            val = getattr(fv, feat, None)
            ordered.append(float(val) if val is not None else np.nan)
        return ordered

    def _fingerprint(self, model_version: str, values: List[float]) -> str:
        m = hashlib.sha1()
        m.update(str(model_version).encode('utf-8'))
        arr = ','.join([str(v) for v in values])
        m.update(arr.encode('utf-8'))
        return m.hexdigest()

    def explain(self, user_id: str, prediction_id: Optional[str] = None, feature_vector: Optional[FeatureVector] = None) -> ExplainabilityResult:
        # Determine context and validate ownership
        obs = None
        cow = None
        farm = None
        prediction = None

        if prediction_id:
            prediction = self.db.query(MilkPrediction).get(prediction_id)
            if prediction is None:
                raise ValueError("Prediction not found")
            if prediction.owner_id != user_id:
                raise PermissionError("User does not own this prediction")
            obs = None
            if getattr(prediction, 'observation_id', None):
                obs = self.db.query(DailyObservation).get(prediction.observation_id)
            if obs:
                cow = self.db.query(Cow).get(obs.cow_id)
                farm = self.db.query(Farm).get(cow.farm_id)

        else:
            if feature_vector is None:
                raise ValueError("Either prediction_id or feature_vector must be provided")
            obs_id = getattr(feature_vector, 'observation_id', None)
            if obs_id is None:
                raise ValueError("feature_vector must include observation_id when no prediction_id provided")
            obs = self.db.query(DailyObservation).get(obs_id)
            if obs is None:
                raise ValueError("Observation not found")
            if obs.owner_id != user_id:
                raise PermissionError("User does not own this observation")
            cow = self.db.query(Cow).get(obs.cow_id)
            farm = self.db.query(Farm).get(cow.farm_id)

        model = self._load_model()
        model_version = getattr(model, '__version__', os.path.basename(self.model_path))

        # Build feature vector ordered
        if prediction is not None and feature_vector is None:
            # try to reconstruct feature vector from prediction's observation link
            if getattr(prediction, 'observation_id', None) is None:
                raise ValueError("Prediction has no linked observation and no feature_vector provided")
            obs2 = self.db.query(DailyObservation).get(prediction.observation_id)
            # Best-effort: client should supply feature_vector; for now raise if missing
            raise ValueError("Explain by prediction_id requires a supplied feature_vector in this implementation")

        fv = feature_vector
        ordered = self._feature_order(fv)

        fingerprint = self._fingerprint(model_version, ordered)
        cached = self.repo.get_by_fingerprint(fingerprint)
        if cached is not None:
            return cached

        # compute SHAP values
        try:
            import shap

            Explainer = shap.TreeExplainer
        except Exception as e:
            raise RuntimeError("SHAP is required for explainability. Install shap package.") from e

        x = np.array([ordered])
        explainer = Explainer(model)
        shap_values = explainer.shap_values(x)
        # shap may return a list for multioutput
        if isinstance(shap_values, list):
            shap_values = shap_values[0]

        vals = shap_values[0] if shap_values.ndim == 2 else shap_values

        # map features
        try:
            from config import ALL_FEATURES as CF
        except Exception:
            CF = []

        features = []
        for i, feat in enumerate(CF):
            v = None
            try:
                v = float(getattr(fv, feat, None))
            except Exception:
                v = None
            sv = float(vals[i]) if i < len(vals) else 0.0
            features.append({"feature": feat, "value": v, "shap_value": sv})

        # rank by absolute shap
        features_sorted = sorted(features, key=lambda d: abs(d['shap_value']), reverse=True)
        for idx, it in enumerate(features_sorted, start=1):
            it['rank'] = idx

        top_positive = [f for f in features_sorted if f['shap_value'] > 0][:5]
        top_negative = [f for f in features_sorted if f['shap_value'] < 0][:5]

        result = ExplainabilityResult(
            prediction_id=prediction_id,
            fingerprint=fingerprint,
            owner_id=user_id,
            observation_id=getattr(feature_vector, 'observation_id', None),
            cow_id=getattr(cow, 'id', None),
            farm_id=getattr(farm, 'id', None),
            model_version=str(model_version),
            details={"features": features_sorted},
            top_positive=top_positive,
            top_negative=top_negative,
        )

        saved = self.repo.save(result)
        return saved
