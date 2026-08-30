from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4
import hashlib
import os
from typing import List, Optional

import joblib
import numpy as np

from sqlalchemy.orm import Session

from app.exceptions import ExplainabilityNotFound, ExplainabilityValidationError
from app.repositories.explainability_repository import ExplainabilityRepository
from app.repositories.ownership import ensure_record_accessible
from app.schemas.feature import FeatureVector
from app.models import MilkPrediction, DailyObservation, Cow, Farm
from app.models.explainability_result import ExplainabilityResult
from app.services.feature_engineering_service import FeatureEngineeringService


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
                + ". Record a complete observation (including feed and weather-dependent "
                "values) before generating an explanation."
            )

        return [float(getattr(fv, feat)) for feat in CF]

    def _fingerprint(self, model_version: str, values: List[float]) -> str:
        m = hashlib.sha1()
        m.update(str(model_version).encode('utf-8'))
        arr = ','.join([str(v) for v in values])
        m.update(arr.encode('utf-8'))
        return m.hexdigest()

    def explain(
        self,
        user_id: str,
        prediction_id: Optional[str] = None,
        feature_vector: Optional[FeatureVector] = None,
        persist: bool = True,
    ) -> ExplainabilityResult:
        # Determine context and validate ownership
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

            # Fast path: reuse an already-computed explanation for this
            # prediction if one exists, avoiding redundant SHAP computation.
            cached_by_prediction = self.repo.get_by_prediction_id(prediction_id)
            if cached_by_prediction is not None:
                return cached_by_prediction

            if getattr(prediction, 'observation_id', None) is None:
                raise ExplainabilityValidationError(
                    "Prediction has no linked observation and no feature_vector provided"
                )
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
                # Derive the feature vector server-side from the prediction's
                # linked observation -- the caller is not required to supply
                # a complete feature vector to explain an existing prediction.
                feature_vector = FeatureEngineeringService(self.db).build_features_for_observation(
                    user_id, obs.id
                )

        else:
            if feature_vector is None:
                raise ExplainabilityValidationError("Either prediction_id or feature_vector must be provided")
            obs_id = getattr(feature_vector, 'observation_id', None)
            if obs_id is None:
                raise ExplainabilityValidationError(
                    "feature_vector must include observation_id when no prediction_id provided"
                )
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
        model_version = getattr(model, '__version__', os.path.basename(self.model_path))

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
        from app.core.project_paths import ensure_project_root_on_path
        ensure_project_root_on_path()
        from config import ALL_FEATURES as CF

        features = []
        for i, feat in enumerate(CF):
            # _feature_order already guarantees every field is present, so
            # no defensive None-handling is needed here.
            v = float(getattr(fv, feat))
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
            observation_id=obs.id if obs is not None else None,
            cow_id=getattr(cow, 'id', None),
            farm_id=getattr(farm, 'id', None),
            model_version=str(model_version),
            details={"features": features_sorted},
            top_positive=top_positive,
            top_negative=top_negative,
        )

        if persist:
            saved = self.repo.save(result)
            return saved

        if getattr(result, 'id', None) is None:
            result.id = str(uuid4())
        if getattr(result, 'computed_at', None) is None:
            result.computed_at = datetime.now(timezone.utc)
        return result
