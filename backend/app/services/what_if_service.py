from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import DailyObservation, Cow, Farm, WeatherLog, HealthAlert
from app.services.explainability_service import ExplainabilityService
from app.services.feature_engineering_service import FeatureEngineeringService
from app.services.health_alert_service import HealthAlertService
from app.services.prediction_service import PredictionService
from app.services.recommendation_service import RecommendationService
from app.services.digital_twin_service import DigitalTwinService
from app.schemas.feature import FeatureVector
from app.schemas.health_alert import HealthAlertResponse
from app.schemas.explainability import ExplainabilityResponse
from app.schemas.what_if import (
    RecommendationItem,
    WhatIfPredictionResult,
    WhatIfRequest,
    WhatIfResponse,
    HerdWhatIfRequest,
    HerdWhatIfResponse,
    CowSimulationComparison,
    SimulationInput,
    CowWhatIfRequest,
    CowWhatIfResponse,
)

logger = logging.getLogger(__name__)


class WhatIfService:
    def __init__(self, db: Session, model_path: str | None = None) -> None:
        self.db = db
        self.feature_service = FeatureEngineeringService(db)
        self.prediction_service = PredictionService(db, model_path=model_path)
        self.explainability_service = ExplainabilityService(db, model_path=model_path)
        self.health_alert_service = HealthAlertService(db)
        self.recommendation_service = RecommendationService(db)
        self.digital_twin_service = DigitalTwinService(db)

    def _validate_observation(self, user_id: str, observation_id: str) -> DailyObservation:
        observation = self.db.get(DailyObservation, observation_id)
        if observation is None:
            raise ValueError("Observation not found")
        if observation.owner_id != user_id:
            raise PermissionError("User does not own this observation")
        return observation

    def _validate_cow_and_farm(self, user_id: str, cow_id: str) -> tuple[Cow, Farm]:
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

    def _check_extrapolation_warning(self, features: FeatureVector) -> bool:
        """Check if inputs push beyond typical historical training bounds."""
        if features.temperature is not None and (features.temperature > 40.0 or features.temperature < 5.0):
            return True
        if features.thi is not None and (features.thi > 85.0 or features.thi < 50.0):
            return True
        if features.feed is not None and (features.feed > 45.0 or features.feed < 5.0):
            return True
        return False

    def _apply_scenario_overrides(self, baseline: FeatureVector, scenario: FeatureVector) -> FeatureVector:
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
            current_recommendations = [
                RecommendationItem(**rec)
                for rec in self.recommendation_service.generate_recommendations_for_context(
                    user_id=user_id,
                    health_alert=current_health_alert,
                    prediction=None,
                    explainability=current_explainability,
                    observation=observation,
                    weather=self.db.get(WeatherLog, observation.weather_log_id) if observation.weather_log_id else None,
                    thi_override=current_features.thi,
                )
            ]
            scenario_recommendations = [
                RecommendationItem(**rec)
                for rec in self.recommendation_service.generate_recommendations_for_context(
                    user_id=user_id,
                    health_alert=scenario_health_alert,
                    prediction=None,
                    explainability=scenario_explainability,
                    observation=observation,
                    weather=self.db.get(WeatherLog, observation.weather_log_id) if observation.weather_log_id else None,
                    thi_override=scenario_features.thi,
                )
            ]

        percent_change = 0.0
        if current_prediction != 0.0:
            percent_change = ((scenario_prediction - current_prediction) / abs(current_prediction)) * 100.0

        def _model_version() -> str:
            model = self.prediction_service._load_model()
            return str(getattr(model, "__version__", self.prediction_service.model_path))

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

        warn = self._check_extrapolation_warning(scenario_features)

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
            extrapolation_warning=warn,
        )

    def run_cow_what_if(self, user_id: str, cow_id: str, request: CowWhatIfRequest) -> CowWhatIfResponse:
        """Run read-only What-If simulation for a specific individual cow by cow_id."""
        cow, farm = self._validate_cow_and_farm(user_id, cow_id)
        cow_name = cow.name or f"Cow {cow.tag_id}"

        breed_str = None
        if cow.breed:
            breed_str = cow.breed.canonical_name if hasattr(cow.breed, "canonical_name") else (cow.breed.name if hasattr(cow.breed, "name") else str(cow.breed))

        # Find latest daily observation for cow
        latest_obs = (
            self.db.query(DailyObservation)
            .filter(DailyObservation.cow_id == cow.id)
            .order_by(DailyObservation.observation_date.desc())
            .first()
        )
        if not latest_obs:
            raise ValueError(f"No daily observations recorded for {cow_name}. Log an observation first to run what-if simulation.")

        # Digital Twin baseline
        digital_twin = self.digital_twin_service.get_cow_digital_twin(user_id, cow.id)
        baseline_vitality = digital_twin.vitality_score

        base_features = self.feature_service.build_features_for_observation(user_id, latest_obs.id)

        # Populate missing animal & weather baseline defaults for simulation read-only sandbox if unentered
        if base_features.age is None:
            base_features.age = 4.0
        if base_features.weight is None:
            base_features.weight = 550.0
        if base_features.feed is None:
            base_features.feed = 24.0

        if base_features.temperature is None:
            base_features.temperature = 25.0
        if base_features.humidity is None:
            base_features.humidity = 60.0
        if base_features.thi is None:
            temp = base_features.temperature
            hum = base_features.humidity
            base_features.thi = (1.8 * temp + 32.0) - ((0.55 - 0.0055 * hum) * (1.8 * temp - 26.0))

        if base_features.temp_humidity is None and base_features.temperature and base_features.humidity:
            base_features.temp_humidity = base_features.temperature * base_features.humidity
        if base_features.thi_squared is None and base_features.thi:
            base_features.thi_squared = base_features.thi * base_features.thi
        if base_features.feed_thi_interaction is None and base_features.feed and base_features.thi:
            base_features.feed_thi_interaction = base_features.feed * base_features.thi

        if base_features.weight and base_features.feed:
            base_features.feed_weight_ratio = base_features.feed / base_features.weight
            base_features.feed_per_weight = base_features.feed_weight_ratio
        if base_features.weight and base_features.age:
            base_features.age_weight_ratio = base_features.age / base_features.weight

        # Prepare scenario feature vector
        scenario_fields = base_features.model_copy()



        if request.scenario.temperature_c is not None:
            scenario_fields.temperature = request.scenario.temperature_c
        if request.scenario.humidity_pct is not None:
            scenario_fields.humidity = request.scenario.humidity_pct
        if request.scenario.feed_quantity_kg is not None:
            scenario_fields.feed = request.scenario.feed_quantity_kg

        # Recalculate THI
        temp = scenario_fields.temperature if scenario_fields.temperature is not None else 25.0
        hum = scenario_fields.humidity if scenario_fields.humidity is not None else 65.0
        calc_thi = (1.8 * temp + 32.0) - ((0.55 - 0.0055 * hum) * (1.8 * temp - 26.0))

        if request.scenario.cooling_intervention_thi_reduction:
            calc_thi = max(40.0, calc_thi - request.scenario.cooling_intervention_thi_reduction)

        scenario_fields.thi = calc_thi
        scenario_features = self._apply_scenario_overrides(base_features, scenario_fields)

        extrap_warn = self._check_extrapolation_warning(scenario_features)

        # Baseline vs Simulated Predictions
        base_pred = self.prediction_service.predict_value(base_features)
        sim_pred = self.prediction_service.predict_value(scenario_features)

        delta_yield = sim_pred - base_pred
        pct_change = (delta_yield / abs(base_pred) * 100.0) if base_pred != 0.0 else 0.0

        # Health Alert Status (Read-Only)
        base_alert = self.health_alert_service.evaluate_and_create(
            user_id=user_id, cow_id=cow.id, observation_id=latest_obs.id, feature_vector=base_features, persist=False
        )
        sim_alert = self.health_alert_service.evaluate_and_create(
            user_id=user_id, cow_id=cow.id, observation_id=latest_obs.id, feature_vector=scenario_features, persist=False
        )

        base_status = base_alert.alert_level if base_alert else "Healthy"
        sim_status = sim_alert.alert_level if sim_alert else "Healthy"

        # Calculate Simulated Digital Twin Vitality Score
        sim_vitality = baseline_vitality
        if sim_status == "Critical":
            sim_vitality = min(sim_vitality, 45.0)
        elif sim_status == "Warning":
            sim_vitality = min(sim_vitality, 70.0)

        if calc_thi >= 80.0:
            sim_vitality = max(10.0, sim_vitality - 15.0)
        elif calc_thi < 72.0 and request.scenario.cooling_intervention_thi_reduction:
            sim_vitality = min(100.0, sim_vitality + 5.0)

        # Farmer-Friendly Natural Language Explanation Synthesis
        explanation_parts = []
        if delta_yield > 0:
            explanation_parts.append(
                f"{cow_name}'s predicted milk production increases by +{delta_yield:.1f} L/day (+{pct_change:.1f}%) under this scenario."
            )
        elif delta_yield < 0:
            explanation_parts.append(
                f"{cow_name}'s predicted milk production decreases by {abs(delta_yield):.1f} L/day ({pct_change:.1f}%) due to environmental heat stress."
            )
        else:
            explanation_parts.append(f"{cow_name}'s predicted milk production remains steady at {sim_pred:.1f} L/day.")

        if calc_thi >= 78.0:
            explanation_parts.append(f"Simulated THI ({calc_thi:.1f}) places {cow_name} in elevated thermal stress.")
            if request.scenario.cooling_intervention_thi_reduction:
                explanation_parts.append("Active cooling reduces heat stress impact and recovers milk yield.")
            else:
                explanation_parts.append("Adding cooling fans or shade is recommended to mitigate yield decline.")

        explanation_summary = " ".join(explanation_parts)

        # Read-Only Scenario Recommendations
        recs_list = [
            RecommendationItem(**rec)
            for rec in self.recommendation_service.generate_recommendations_for_context(
                user_id=user_id,
                health_alert=sim_alert,
                prediction=None,
                explainability=None,
                observation=latest_obs,
                weather=self.db.get(WeatherLog, latest_obs.weather_log_id) if latest_obs.weather_log_id else None,
                thi_override=calc_thi,
            )
        ]

        return CowWhatIfResponse(
            cow_id=cow.id,
            cow_name=cow_name,
            tag_id=cow.tag_id,
            breed_name=breed_str,
            baseline_milk_yield_l=round(latest_obs.milk_produced_liters or base_pred, 1),
            predicted_milk_yield_l=round(base_pred, 1),
            simulated_milk_yield_l=round(sim_pred, 1),
            delta_milk_yield_l=round(delta_yield, 1),
            percent_change=round(pct_change, 1),
            baseline_thi=round(base_features.thi or 70.0, 1),
            simulated_thi=round(calc_thi, 1),
            baseline_health_status=base_status,
            simulated_health_status=sim_status,
            baseline_vitality_score=round(baseline_vitality, 1),
            simulated_vitality_score=round(sim_vitality, 1),
            explanation_summary=explanation_summary,
            extrapolation_warning=extrap_warn,
            recommendations=recs_list,
        )

    def run_herd_what_if(self, user_id: str, request: HerdWhatIfRequest) -> HerdWhatIfResponse:
        """Simulate farm-wide scenario impact across all active cows."""
        query = self.db.query(Cow).filter(Cow.owner_id == user_id, Cow.status == "active")
        if request.farm_id:
            query = query.filter(Cow.farm_id == request.farm_id)

        cows = query.all()
        if not cows:
            return HerdWhatIfResponse(
                farm_id=request.farm_id,
                total_cows_simulated=0,
                baseline_total_yield_l=0.0,
                simulated_total_yield_l=0.0,
                total_delta_l=0.0,
                total_percent_change=0.0,
                cow_comparisons=[],
                herd_recommendations=[],
            )

        cow_comparisons: list[CowSimulationComparison] = []
        baseline_total = 0.0
        simulated_total = 0.0
        extrapolation_warning = False

        for cow in cows:
            obs = (
                self.db.query(DailyObservation)
                .filter(DailyObservation.cow_id == cow.id)
                .order_by(DailyObservation.observation_date.desc())
                .first()
            )
            if not obs:
                continue

            try:
                base_features = self.feature_service.build_features_for_observation(user_id, obs.id)

                if base_features.age is None:
                    base_features.age = 4.0
                if base_features.weight is None:
                    base_features.weight = 550.0
                if base_features.feed is None:
                    base_features.feed = 24.0

                if base_features.temperature is None:
                    base_features.temperature = 25.0
                if base_features.humidity is None:
                    base_features.humidity = 60.0
                if base_features.thi is None:
                    temp = base_features.temperature
                    hum = base_features.humidity
                    base_features.thi = (1.8 * temp + 32.0) - ((0.55 - 0.0055 * hum) * (1.8 * temp - 26.0))

                if base_features.temp_humidity is None and base_features.temperature and base_features.humidity:
                    base_features.temp_humidity = base_features.temperature * base_features.humidity
                if base_features.thi_squared is None and base_features.thi:
                    base_features.thi_squared = base_features.thi * base_features.thi
                if base_features.feed_thi_interaction is None and base_features.feed and base_features.thi:
                    base_features.feed_thi_interaction = base_features.feed * base_features.thi

                if base_features.weight and base_features.feed:
                    base_features.feed_weight_ratio = base_features.feed / base_features.weight
                    base_features.feed_per_weight = base_features.feed_weight_ratio
                if base_features.weight and base_features.age:
                    base_features.age_weight_ratio = base_features.age / base_features.weight

                scenario_fields = base_features.model_copy()



                if request.scenario.temperature_c is not None:
                    scenario_fields.temperature = request.scenario.temperature_c
                if request.scenario.humidity_pct is not None:
                    scenario_fields.humidity = request.scenario.humidity_pct
                if request.scenario.feed_quantity_kg is not None:
                    scenario_fields.feed = request.scenario.feed_quantity_kg

                temp = scenario_fields.temperature if scenario_fields.temperature is not None else 25.0
                hum = scenario_fields.humidity if scenario_fields.humidity is not None else 65.0
                calc_thi = (1.8 * temp + 32.0) - ((0.55 - 0.0055 * hum) * (1.8 * temp - 26.0))

                if request.scenario.cooling_intervention_thi_reduction:
                    calc_thi = max(40.0, calc_thi - request.scenario.cooling_intervention_thi_reduction)

                scenario_fields.thi = calc_thi
                scenario_features = self._apply_scenario_overrides(base_features, scenario_fields)

                if self._check_extrapolation_warning(scenario_features):
                    extrapolation_warning = True

                base_pred = self.prediction_service.predict_value(base_features)
                sim_pred = self.prediction_service.predict_value(scenario_features)

                baseline_total += base_pred
                simulated_total += sim_pred

                delta = sim_pred - base_pred
                pct = (delta / abs(base_pred) * 100.0) if base_pred != 0.0 else 0.0

                base_alert = self.health_alert_service.evaluate_and_create(
                    user_id=user_id, cow_id=cow.id, observation_id=obs.id, feature_vector=base_features, persist=False
                )
                sim_alert = self.health_alert_service.evaluate_and_create(
                    user_id=user_id, cow_id=cow.id, observation_id=obs.id, feature_vector=scenario_features, persist=False
                )

                base_status = base_alert.alert_level if base_alert else "Healthy"
                sim_status = sim_alert.alert_level if sim_alert else "Healthy"

                cow_comparisons.append(
                    CowSimulationComparison(
                        cow_id=cow.id,
                        cow_name=cow.name or f"Cow {cow.tag_id}",
                        tag_id=cow.tag_id,
                        baseline_yield_l=round(base_pred, 1),
                        simulated_yield_l=round(sim_pred, 1),
                        delta_yield_l=round(delta, 1),
                        percent_change=round(pct, 1),
                        baseline_health_status=base_status,
                        simulated_health_status=sim_status,
                        baseline_thi=round(base_features.thi or calc_thi, 1),
                        simulated_thi=round(calc_thi, 1),
                    )
                )
            except Exception as e:
                logger.warning(f"Could not simulate cow {cow.id}: {e}")

        total_delta = simulated_total - baseline_total
        total_pct = (total_delta / abs(baseline_total) * 100.0) if baseline_total != 0.0 else 0.0

        herd_recs: list[RecommendationItem] = []
        if total_delta > 0:
            herd_recs.append(
                RecommendationItem(
                    title="Positive Production Gain Expected",
                    description=f"Simulated scenario boosts herd milk output by +{total_delta:.1f} L/day (+{total_pct:.1f}%).",
                    category="Production Optimization",
                    priority="Medium",
                    recommendation_type="Action",
                )
            )
        elif total_delta < 0:
            herd_recs.append(
                RecommendationItem(
                    title="Heat Stress Production Loss Warning",
                    description=f"Simulated environmental stress reduces herd output by {total_delta:.1f} L/day ({total_pct:.1f}%). Activate shade and cooling fans.",
                    category="Heat Stress Mitigation",
                    priority="High",
                    recommendation_type="Warning",
                )
            )

        return HerdWhatIfResponse(
            farm_id=request.farm_id,
            total_cows_simulated=len(cow_comparisons),
            baseline_total_yield_l=round(baseline_total, 1),
            simulated_total_yield_l=round(simulated_total, 1),
            total_delta_l=round(total_delta, 1),
            total_percent_change=round(total_pct, 1),
            cow_comparisons=cow_comparisons,
            herd_recommendations=herd_recs,
            extrapolation_warning=extrapolation_warning,
        )
