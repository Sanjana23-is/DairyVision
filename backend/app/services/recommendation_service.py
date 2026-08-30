from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import (
    Cow,
    DailyObservation,
    ExplainabilityResult,
    Farm,
    HealthAlert,
    MilkPrediction,
    Recommendation,
    WeatherLog,
)
from app.repositories.recommendation_repository import RecommendationRepository
from app.schemas.recommendation import (
    RecommendationCategory,
    RecommendationPriority,
)


class RecommendationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = RecommendationRepository(db)

    def _get_owned(self, model: Any, record_id: Optional[str], user_id: str):
        if record_id is None:
            return None
        record = self.db.get(model, record_id)
        if record is None:
            raise ValueError(f"{model.__name__} not found")
        owner_id = getattr(record, "owner_id", None)
        if owner_id is not None and owner_id != user_id:
            raise PermissionError("User does not own this record")
        return record

    def _add_recommendation(
        self,
        recommendations: list[dict[str, Any]],
        title: str,
        description: str,
        category: RecommendationCategory,
        priority: RecommendationPriority,
        recommendation_type: str = "generated",
    ) -> None:
        if any(rec["title"] == title for rec in recommendations):
            return
        recommendations.append(
            {
                "title": title,
                "description": description,
                "category": category.value,
                "priority": priority.value,
                "recommendation_type": recommendation_type,
            }
        )

    def _generate_recommendations(
        self,
        user_id: str,
        health_alert: Optional[HealthAlert] = None,
        prediction: Optional[MilkPrediction] = None,
        explainability: Optional[ExplainabilityResult] = None,
        observation: Optional[DailyObservation] = None,
        weather: Optional[WeatherLog] = None,
        thi_override: Optional[float] = None,
    ) -> list[dict[str, Any]]:
        recommendations: list[dict[str, Any]] = []

        alert_level = getattr(health_alert, "alert_level", "Healthy")

        thi = None
        if weather is not None and getattr(weather, "thi", None) is not None:
            thi = float(weather.thi)
        elif thi_override is not None:
            thi = float(thi_override)

        milk_drop = 0.0
        if prediction is not None and observation is not None and getattr(observation, "milk_produced_liters", None) is not None:
            expected = float(prediction.predicted_milk_yield)
            observed = float(observation.milk_produced_liters)
            if expected > 0:
                milk_drop = max(0.0, (expected - observed) / expected)

        abnormal = False
        if observation is not None and getattr(observation, "symptoms", None):
            abnormal = isinstance(observation.symptoms, dict) and len(observation.symptoms) > 0

        if thi is not None:
            if thi >= 80.0:
                self._add_recommendation(
                    recommendations,
                    title="Implement immediate cooling and shade",
                    description=(
                        "THI is very high and heat stress is a likely driver. "
                        "Increase water access, provide shade, and consider fans or misting."
                    ),
                    category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                    priority=RecommendationPriority.HIGH,
                )
            elif thi >= 75.0:
                self._add_recommendation(
                    recommendations,
                    title="Increase water and cooling support",
                    description=(
                        "Moderate heat stress conditions are present. "
                        "Ensure fresh water is available and monitor the herd closely for overheating."
                    ),
                    category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                    priority=RecommendationPriority.MEDIUM,
                )
            elif thi >= 70.0:
                self._add_recommendation(
                    recommendations,
                    title="Monitor heat stress and hydration",
                    description=(
                        "Heat stress risk is elevated. "
                        "Track water consumption and animal comfort more frequently."
                    ),
                    category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                    priority=RecommendationPriority.LOW,
                )

        if milk_drop > 0.25:
            self._add_recommendation(
                recommendations,
                title="Review feeding strategy for milk production",
                description=(
                    "Milk output is dropping significantly compared to prediction. "
                    "Assess ration quality and adjust feeding to support yield recovery."
                ),
                category=RecommendationCategory.FEEDING_STRATEGY,
                priority=RecommendationPriority.HIGH,
            )
        elif milk_drop > 0.12:
            self._add_recommendation(
                recommendations,
                title="Adjust feeding and nutrition",
                description=(
                    "Milk yield is lower than expected. "
                    "Evaluate feed intake and consider a slightly richer diet for the herd."
                ),
                category=RecommendationCategory.FEEDING_STRATEGY,
                priority=RecommendationPriority.MEDIUM,
            )

        if abnormal:
            self._add_recommendation(
                recommendations,
                title="Schedule veterinary attention",
                description=(
                    "Recorded symptoms suggest abnormal health conditions. "
                    "Arrange a veterinary check-up to diagnose and treat the issue promptly."
                ),
                category=RecommendationCategory.VETERINARY_ATTENTION,
                priority=RecommendationPriority.HIGH,
            )

        if explainability is not None:
            top_positive = explainability.top_positive or []
            top_negative = explainability.top_negative or []
            top_features = [item.get("feature") for item in top_positive + top_negative if item.get("feature")]

            if any(feature in ("temperature", "humidity", "thi") for feature in top_features):
                self._add_recommendation(
                    recommendations,
                    title="Prioritize heat stress mitigation",
                    description=(
                        "SHAP explainability highlights environmental drivers. "
                        "Focus on cooling, ventilation, and hydration to reduce stress."
                    ),
                    category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                    priority=RecommendationPriority.MEDIUM,
                )

            if any(feature in ("feed_quantity_kg", "milk_produced_liters", "dry_matter_intake") for feature in top_features):
                self._add_recommendation(
                    recommendations,
                    title="Review nutrition and feed quality",
                    description=(
                        "Feature importance indicates feeding inputs are influencing performance. "
                        "Confirm rations are balanced and feeding frequency is consistent."
                    ),
                    category=RecommendationCategory.FEEDING_STRATEGY,
                    priority=RecommendationPriority.MEDIUM,
                )

        if not recommendations:
            self._add_recommendation(
                recommendations,
                title="Continue monitoring farm conditions",
                description=(
                    "No urgent recommendations were identified. "
                    "Keep observing feed, weather, and milk yield trends for the herd."
                ),
                category=RecommendationCategory.GENERAL_FARM_MANAGEMENT,
                priority=RecommendationPriority.LOW,
            )

        return recommendations

    def generate_recommendations(
        self,
        user_id: str,
        health_alert_id: Optional[str] = None,
        prediction_id: Optional[str] = None,
        explainability_id: Optional[str] = None,
        observation_id: Optional[str] = None,
        weather_log_id: Optional[str] = None,
    ) -> list[Recommendation]:
        health_alert = self._get_owned(HealthAlert, health_alert_id, user_id)
        prediction = self._get_owned(MilkPrediction, prediction_id, user_id)
        observation = self._get_owned(DailyObservation, observation_id, user_id)
        weather = self._get_owned(WeatherLog, weather_log_id, user_id)
        explainability = None

        if explainability_id is not None:
            explainability = self.db.get(ExplainabilityResult, explainability_id)
            if explainability is None:
                raise ValueError("Explainability result not found")
            if explainability.owner_id is not None and explainability.owner_id != user_id:
                raise PermissionError("User does not own this explainability result")

        if health_alert is not None:
            if prediction is None and getattr(health_alert, "prediction_id", None) is not None:
                prediction = self._get_owned(MilkPrediction, health_alert.prediction_id, user_id)
            if observation is None and getattr(health_alert, "observation_id", None) is not None:
                observation = self._get_owned(DailyObservation, health_alert.observation_id, user_id)

        if observation is not None and weather is None and getattr(observation, "weather_log_id", None) is not None:
            weather = self._get_owned(WeatherLog, observation.weather_log_id, user_id)

        if prediction is not None and observation is None and getattr(prediction, "observation_id", None) is not None:
            observation = self._get_owned(DailyObservation, prediction.observation_id, user_id)

        if observation is None and explainability is not None and getattr(explainability, "observation_id", None) is not None:
            observation = self._get_owned(DailyObservation, explainability.observation_id, user_id)

        if health_alert is None and prediction is None and observation is None and weather is None and explainability is None:
            raise ValueError("At least one context ID must be provided")

        results = self._generate_recommendations(
            user_id=user_id,
            health_alert=health_alert,
            prediction=prediction,
            explainability=explainability,
            observation=observation,
            weather=weather,
        )

        recommendation_objects: list[Recommendation] = []
        for item in results:
            recommendation = Recommendation(
                cow_id=(
                    getattr(health_alert, "cow_id", None)
                    or getattr(observation, "cow_id", None)
                    or getattr(prediction, "cow_id", None)
                ),
                alert_id=getattr(health_alert, "id", None),
                prediction_id=getattr(prediction, "id", None),
                observation_id=getattr(observation, "id", None),
                farm_id=(
                    getattr(health_alert, "farm_id", None)
                    or getattr(observation, "farm_id", None)
                    or getattr(weather, "farm_id", None)
                ),
                title=item["title"],
                description=item.get("description"),
                category=item["category"],
                priority=item["priority"],
                recommendation_type=item.get("recommendation_type", "generated"),
                owner_id=user_id,
            )
            recommendation_objects.append(self.repo.save(recommendation))

        return recommendation_objects

    def generate_recommendations_for_context(
        self,
        user_id: str,
        health_alert: Optional[HealthAlert] = None,
        prediction: Optional[MilkPrediction] = None,
        explainability: Optional[ExplainabilityResult] = None,
        observation: Optional[DailyObservation] = None,
        weather: Optional[WeatherLog] = None,
        thi_override: Optional[float] = None,
    ) -> list[dict[str, Any]]:
        return self._generate_recommendations(
            user_id=user_id,
            health_alert=health_alert,
            prediction=prediction,
            explainability=explainability,
            observation=observation,
            weather=weather,
            thi_override=thi_override,
        )
