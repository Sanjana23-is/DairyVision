from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import DailyObservation, Cow, Farm, WeatherLog
from app.services.explainability_service import ExplainabilityService
from app.services.feature_engineering_service import FeatureEngineeringService
from app.services.health_alert_service import HealthAlertService
from app.services.prediction_service import PredictionService
from app.services.recommendation_service import RecommendationService
from app.schemas.feature import FeatureVector
from app.schemas.health_alert import HealthAlertResponse
from app.schemas.explainability import ExplainabilityResponse
from app.schemas.what_if import RecommendationItem, WhatIfPredictionResult, WhatIfRequest, WhatIfResponse

from app.models.health_alert import HealthAlert


class WhatIfService:
    def __init__(self, db: Session, model_path: str | None = None) -> None:
        self.db = db
        self.feature_service = FeatureEngineeringService(db)
        self.prediction_service = PredictionService(db, model_path=model_path)
        self.explainability_service = ExplainabilityService(db, model_path=model_path)
        self.health_alert_service = HealthAlertService(db)
        self.recommendation_service = RecommendationService(db)

    def _validate_observation(self, user_id: str, observation_id: str) -> DailyObservation:
        observation = self.db.query(DailyObservation).get(observation_id)
        if observation is None:
            raise ValueError("Observation not found")
        if observation.owner_id != user_id:
            raise PermissionError("User does not own this observation")
        return observation

    def _validate_cow_and_farm(self, user_id: str, cow_id: str) -> tuple[ Cow, Farm]:
        cow = self.db.query(Cow).get(cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        if cow.owner_id != user_id:
            raise PermissionError("User does not own this cow")
        farm = self.db.query(Farm).get(cow.farm_id)
        if farm is None:
            raise ValueError("Farm not found")
        if getattr(farm, "created_by", None) != user_id and getattr(farm, "owner_id", None) not in (None, user_id):
            raise PermissionError("User does not own this farm")
        return cow, farm

    def run_what_if(self, user_id: str, request: WhatIfRequest) -> WhatIfResponse:
        observation = self._validate_observation(user_id, request.observation_id)
        cow = self.db.query(Cow).get(observation.cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        self._validate_cow_and_farm(user_id, cow.id)

        current_features = self.feature_service.build_features_for_observation(user_id, request.observation_id)
        # scenario feature payload may include modified values and observation_id for metadata
        scenario_features = request.scenario
        if scenario_features.observation_id is None:
            scenario_features.observation_id = observation.id

        current_prediction = self.prediction_service.predict_value(current_features)
        scenario_prediction = self.prediction_service.predict_value(scenario_features)

        current_health_alert = None
        scenario_health_alert = None
        current_explainability = None
        scenario_explainability = None
        current_recommendations = None
        scenario_recommendations = None

        if request.include_health_alert:
            current_health_alert = self.health_alert_service.evaluate_and_create(
                user_id=user_id,
                cow_id=cow.id,
                observation_id=observation.id,
                feature_vector=current_features,
                persist=False,
            )
            scenario_health_alert = self.health_alert_service.evaluate_and_create(
                user_id=user_id,
                cow_id=cow.id,
                observation_id=observation.id,
                feature_vector=scenario_features,
                persist=False,
            )

        if request.include_explainability:
            current_explainability = self.explainability_service.explain(
                user_id=user_id,
                feature_vector=current_features,
                persist=False,
            )
            scenario_explainability = self.explainability_service.explain(
                user_id=user_id,
                feature_vector=scenario_features,
                persist=False,
            )

        if request.include_recommendations:
            current_recommendations = [RecommendationItem(**rec) for rec in self.recommendation_service.generate_recommendations_for_context(
                user_id=user_id,
                health_alert=current_health_alert,
                prediction=None,
                explainability=current_explainability,
                observation=observation,
                weather=self.db.query(WeatherLog).get(observation.weather_log_id) if observation.weather_log_id else None,
                thi_override=current_features.thi,
            )]
            scenario_recommendations = [RecommendationItem(**rec) for rec in self.recommendation_service.generate_recommendations_for_context(
                user_id=user_id,
                health_alert=scenario_health_alert,
                prediction=None,
                explainability=scenario_explainability,
                observation=observation,
                weather=self.db.query(WeatherLog).get(observation.weather_log_id) if observation.weather_log_id else None,
                thi_override=scenario_features.thi,
            )]

        percent_change = 0.0
        if current_prediction != 0.0:
            percent_change = ((scenario_prediction - current_prediction) / abs(current_prediction)) * 100.0

        def _model_version() -> str:
            model = self.prediction_service._load_model()
            return str(getattr(model, '__version__', self.prediction_service.model_path))

        def _to_health_alert_response(alert: Optional[HealthAlert]) -> Optional[HealthAlertResponse]:
            if alert is None:
                return None
            return HealthAlertResponse.model_validate(alert)

        def _to_explainability_response(result: Optional[object]) -> Optional[ExplainabilityResponse]:
            if result is None:
                return None
            return ExplainabilityResponse.model_validate(
                {
                    "id": getattr(result, "id", None),
                    "prediction_id": getattr(result, "prediction_id", None),
                    "observation_id": getattr(result, "observation_id", None),
                    "cow_id": getattr(result, "cow_id", None),
                    "farm_id": getattr(result, "farm_id", None),
                    "computed_at": getattr(result, "computed_at", None),
                    "model_version": getattr(result, "model_version", None),
                    "features": getattr(result, "details", {}).get("features", []),
                    "top_positive": getattr(result, "top_positive", []) or [],
                    "top_negative": getattr(result, "top_negative", []) or [],
                }
            )

        return WhatIfResponse(
            observation_id=observation.id,
            current_features=current_features,
            scenario_features=scenario_features,
            current_prediction=WhatIfPredictionResult(
                predicted_milk_yield=current_prediction,
                model_version=_model_version(),
            ),
            scenario_prediction=WhatIfPredictionResult(
                predicted_milk_yield=scenario_prediction,
                model_version=_model_version(),
            ),
            delta_milk_yield=float(scenario_prediction - current_prediction),
            percent_change=float(percent_change),
            current_health_alert=_to_health_alert_response(current_health_alert),
            scenario_health_alert=_to_health_alert_response(scenario_health_alert),
            current_explainability=_to_explainability_response(current_explainability),
            scenario_explainability=_to_explainability_response(scenario_explainability),
            current_recommendations=current_recommendations,
            scenario_recommendations=scenario_recommendations,
        )
