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
        observation = self.db.get(DailyObservation, observation_id)
        if observation is None:
            raise ValueError("Observation not found")
        if observation.owner_id != user_id:
            raise PermissionError("User does not own this observation")
        return observation

    def _validate_cow_and_farm(self, user_id: str, cow_id: str) -> tuple[ Cow, Farm]:
        cow = self.db.get(Cow, cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        if cow.owner_id != user_id:
            raise PermissionError("User does not own this cow")
        farm = self.db.get(Farm, cow.farm_id)
        if farm is None:
            raise ValueError("Farm not found")
        if getattr(farm, "created_by", None) != user_id and getattr(farm, "owner_id", None) not in (None, user_id):
            raise PermissionError("User does not own this farm")
        return cow, farm

    def _apply_scenario_overrides(self, baseline: FeatureVector, scenario: FeatureVector) -> FeatureVector:
        """Build the scenario feature vector starting from the observation's
        complete baseline, overriding only the fields the caller explicitly
        supplied (non-None), then recomputing every engineered feature from
        the resulting base values using the same formulas already
        implemented in FeatureEngineeringService. This guarantees
        scenario_features contains every field in config.ALL_FEATURES before
        it reaches PredictionService.predict_value(), without using NaN or
        arbitrary defaults to bypass its validation."""
        merged = baseline.model_copy()

        base_fields = ("age", "weight", "health_status", "feed", "temperature", "humidity", "thi")
        for field in base_fields:
            value = getattr(scenario, field, None)
            if value is not None:
                setattr(merged, field, value)

        if merged.feed is not None and merged.weight not in (None, 0):
            merged.feed_weight_ratio = merged.feed / merged.weight
            merged.feed_per_weight = merged.feed_weight_ratio
        if merged.temperature is not None and merged.humidity is not None:
            merged.temp_humidity = merged.temperature * merged.humidity
        if merged.thi is not None:
            merged.thi_squared = merged.thi * merged.thi
            if merged.feed is not None:
                merged.feed_thi_interaction = merged.feed * merged.thi
        if merged.age is not None and merged.weight not in (None, 0):
            merged.age_weight_ratio = merged.age / merged.weight

        merged.observation_id = baseline.observation_id
        return merged

    def run_what_if(self, user_id: str, request: WhatIfRequest) -> WhatIfResponse:
        observation = self._validate_observation(user_id, request.observation_id)
        cow = self.db.get(Cow, observation.cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        self._validate_cow_and_farm(user_id, cow.id)

        current_features = self.feature_service.build_features_for_observation(user_id, request.observation_id)
        # The scenario starts from the complete baseline feature vector,
        # overriding only the fields the caller actually supplied. This is
        # required because PredictionService._feature_order() validates that
        # every config.ALL_FEATURES value is present -- the caller is not
        # required to send a complete feature vector, only the fields they
        # want to hypothesize about.
        scenario_features = self._apply_scenario_overrides(current_features, request.scenario)

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
                weather=self.db.get(WeatherLog, observation.weather_log_id) if observation.weather_log_id else None,
                thi_override=current_features.thi,
            )]
            scenario_recommendations = [RecommendationItem(**rec) for rec in self.recommendation_service.generate_recommendations_for_context(
                user_id=user_id,
                health_alert=scenario_health_alert,
                prediction=None,
                explainability=scenario_explainability,
                observation=observation,
                weather=self.db.get(WeatherLog, observation.weather_log_id) if observation.weather_log_id else None,
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
