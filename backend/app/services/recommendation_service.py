from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session


from app.models import (
    AnomalyRecord,
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

logger = logging.getLogger(__name__)


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
        why_reason: str,
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
                "why_reason": why_reason,
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
        anomaly: Optional[AnomalyRecord] = None,
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
        expected_yield = None
        observed_yield = None
        if prediction is not None and observation is not None and getattr(observation, "milk_produced_liters", None) is not None:
            expected_yield = float(prediction.predicted_milk_yield)
            observed_yield = float(observation.milk_produced_liters)
            if expected_yield > 0:
                milk_drop = max(0.0, (expected_yield - observed_yield) / expected_yield)

        body_temp = getattr(observation, "body_temperature_c", None)
        health_cond = getattr(observation, "health_condition", None)
        symptoms = getattr(observation, "symptoms", None)
        has_symptoms = isinstance(symptoms, dict) and len(symptoms) > 0

        # Anomaly signals
        anomaly_tags = []
        if anomaly is not None and isinstance(anomaly.issue_tags, list):
            anomaly_tags = anomaly.issue_tags

        # 1. Veterinary / Fever / Health condition signals
        is_fever = (body_temp is not None and body_temp > 39.5) or "High Temperature Spike" in anomaly_tags
        is_abnormal_health = (health_cond is not None and health_cond != "normal") or has_symptoms

        if is_fever and milk_drop > 0.15:
            temp_str = f"{body_temp:.1f} °C" if body_temp else "elevated"
            drop_pct = f"{int(milk_drop * 100)}%"
            self._add_recommendation(
                recommendations,
                title="Isolate cow and arrange immediate veterinary check",
                description="Isolate from herd to prevent contagion and contact a veterinarian immediately for diagnosis and treatment.",
                why_reason=(
                    f"The cow has an elevated body temperature ({temp_str}) and its milk production dropped {drop_pct} below its recent baseline. "
                    "Together, these combined signs indicate a health issue that should be investigated promptly."
                ),
                category=RecommendationCategory.VETERINARY_ATTENTION,
                priority=RecommendationPriority.HIGH,
            )
        elif is_fever:
            temp_str = f"{body_temp:.1f} °C" if body_temp else "elevated"
            self._add_recommendation(
                recommendations,
                title="Isolate cow and arrange immediate veterinary check",
                description="Isolate from herd to prevent contagion and contact a veterinarian immediately.",
                why_reason=(
                    f"The cow's recorded body temperature is above the normal range ({temp_str}). "
                    "This can be a sign of fever or acute infection and should be checked promptly by a veterinarian."
                ),
                category=RecommendationCategory.VETERINARY_ATTENTION,
                priority=RecommendationPriority.HIGH,
            )
        elif is_abnormal_health:
            cond_str = f"'{health_cond}'" if health_cond else "abnormal symptoms"
            self._add_recommendation(
                recommendations,
                title="Schedule veterinary attention",
                description="Arrange a veterinary check-up to diagnose and treat the health condition promptly.",
                why_reason=(
                    f"The cow was recorded with an abnormal health condition ({cond_str}) during the latest observation. "
                    "This may indicate an illness that could affect cow health and milk production if left untreated."
                ),
                category=RecommendationCategory.VETERINARY_ATTENTION,
                priority=RecommendationPriority.HIGH,
            )

        # 2. Heat Stress signals
        is_extreme_thi = (thi is not None and thi >= 78.0) or "Extreme Heat Stress" in anomaly_tags
        is_moderate_thi = (thi is not None and 75.0 <= thi < 78.0)
        is_elevated_thi = (thi is not None and 70.0 <= thi < 75.0)

        if is_extreme_thi:
            thi_str = f"THI {thi:.1f}" if thi is not None else "high THI"
            self._add_recommendation(
                recommendations,
                title="Activate emergency heat stress cooling and shade",
                description="Provide continuous shade, active misting/fans, and fresh cool drinking water to lower thermal stress.",
                why_reason=(
                    f"Recent weather conditions indicate high heat stress ({thi_str}). "
                    "Heat stress can reduce feed intake, lower milk production, and significantly impact cow health."
                ),
                category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                priority=RecommendationPriority.HIGH,
            )
        elif is_moderate_thi:
            self._add_recommendation(
                recommendations,
                title="Increase water and cooling support",
                description="Ensure fresh water is available and monitor the herd closely for overheating.",
                why_reason=(
                    f"Weather monitoring indicates moderate heat stress (THI {thi:.1f}). "
                    "Elevated temperatures cause thermal discomfort and can reduce milk yield."
                ),
                category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                priority=RecommendationPriority.MEDIUM,
            )
        elif is_elevated_thi:
            self._add_recommendation(
                recommendations,
                title="Monitor heat stress and hydration",
                description="Track water consumption and animal comfort more frequently.",
                why_reason=(
                    f"Weather monitoring indicates warm conditions approaching heat stress thresholds (THI {thi:.1f}). "
                    "Increased hydration monitoring helps prevent yield loss."
                ),
                category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                priority=RecommendationPriority.LOW,
            )

        # 3. Feeding & Milk Drop signals
        if milk_drop > 0.25 or "Abnormal Milk Drop" in anomaly_tags:
            drop_pct = f"{int(milk_drop * 100)}%" if milk_drop > 0 else "significant"
            self._add_recommendation(
                recommendations,
                title="Adjust high-energy ration for milk recovery",
                description="Inspect TMR quality, increase dietary energy density, and ensure unhindered feed bunk access.",
                why_reason=(
                    f"Milk production has dropped significantly ({drop_pct} lower than expected baseline). "
                    "This change may be associated with nutrition deficiencies, health issues, or environmental stress."
                ),
                category=RecommendationCategory.FEEDING_STRATEGY,
                priority=RecommendationPriority.HIGH,
            )
        elif milk_drop > 0.12:
            drop_pct = f"{int(milk_drop * 100)}%"
            self._add_recommendation(
                recommendations,
                title="Adjust feeding and nutrition",
                description="Evaluate feed intake and consider a slightly richer diet for the herd.",
                why_reason=(
                    f"Milk yield is lower than the cow's recent production baseline ({drop_pct} drop). "
                    "Adjusting feeding and diet composition helps support yield recovery."
                ),
                category=RecommendationCategory.FEEDING_STRATEGY,
                priority=RecommendationPriority.MEDIUM,
            )

        if "Unusual Feed Intake" in anomaly_tags:
            self._add_recommendation(
                recommendations,
                title="Inspect feed bunk palatability and freshness",
                description="Check for feed spoilage, mycotoxins, or bunk competition.",
                why_reason=(
                    "The cow's recent feed intake is unusually different from its normal pattern. "
                    "Changes in feed intake can be an early sign of health or nutrition problems."
                ),
                category=RecommendationCategory.FEEDING_STRATEGY,
                priority=RecommendationPriority.MEDIUM,
            )

        # 4. SHAP Explainability signals
        if explainability is not None:
            top_positive = explainability.top_positive or []
            top_negative = explainability.top_negative or []
            top_features = [item.get("feature") for item in top_positive + top_negative if item.get("feature")]

            if any(feature in ("temperature", "humidity", "thi") for feature in top_features) and not any(r["category"] == RecommendationCategory.HEAT_STRESS_MANAGEMENT.value for r in recommendations):
                self._add_recommendation(
                    recommendations,
                    title="Prioritize heat stress mitigation",
                    description="Focus on cooling, ventilation, and hydration to reduce stress.",
                    why_reason=(
                        "AI explainability analysis identified temperature and humidity as major drivers impacting milk yield. "
                        "Cooling support will mitigate environmental performance drag."
                    ),
                    category=RecommendationCategory.HEAT_STRESS_MANAGEMENT,
                    priority=RecommendationPriority.MEDIUM,
                )

        # Fallback baseline
        if not recommendations:
            self._add_recommendation(
                recommendations,
                title="Continue monitoring farm conditions",
                description="No urgent recommendations identified. Keep observing feed, weather, and milk yield trends.",
                why_reason=(
                    "All recorded health, temperature, weather, and milk yield measurements are within expected normal bounds."
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
        anomaly_id: Optional[str] = None,
    ) -> list[Recommendation]:
        health_alert = self._get_owned(HealthAlert, health_alert_id, user_id)
        prediction = self._get_owned(MilkPrediction, prediction_id, user_id)
        observation = self._get_owned(DailyObservation, observation_id, user_id)
        weather = self._get_owned(WeatherLog, weather_log_id, user_id)
        anomaly = self._get_owned(AnomalyRecord, anomaly_id, user_id)
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

        if observation is not None:
            if weather is None and getattr(observation, "weather_log_id", None) is not None:
                weather = self._get_owned(WeatherLog, observation.weather_log_id, user_id)

        if anomaly is not None and observation is None and getattr(anomaly, "observation_id", None) is not None:
            observation = self._get_owned(DailyObservation, anomaly.observation_id, user_id)

        if health_alert is None and prediction is None and observation is None and weather is None and explainability is None and anomaly is None:
            raise ValueError("At least one context ID must be provided")

        results = self._generate_recommendations(
            user_id=user_id,
            health_alert=health_alert,
            prediction=prediction,
            explainability=explainability,
            observation=observation,
            weather=weather,
            anomaly=anomaly,
        )

        recommendation_objects: list[Recommendation] = []
        for item in results:
            target_cow_id = (
                getattr(health_alert, "cow_id", None)
                or getattr(observation, "cow_id", None)
                or getattr(prediction, "cow_id", None)
                or getattr(anomaly, "cow_id", None)
            )
            target_farm_id = (
                getattr(health_alert, "farm_id", None)
                or getattr(observation, "farm_id", None)
                or getattr(weather, "farm_id", None)
                or getattr(anomaly, "farm_id", None)
            )
            rec_type = item.get("recommendation_type", "generated")
            rec_title = item["title"]

            existing_query = self.db.query(Recommendation).filter(
                Recommendation.owner_id == user_id,
                Recommendation.title == rec_title,
                Recommendation.completed.is_(False),
            )
            if target_farm_id:
                existing_query = existing_query.filter(Recommendation.farm_id == target_farm_id)
            else:
                existing_query = existing_query.filter(Recommendation.farm_id.is_(None))

            if target_cow_id:
                existing_query = existing_query.filter(Recommendation.cow_id == target_cow_id)
            else:
                existing_query = existing_query.filter(Recommendation.cow_id.is_(None))

            existing = existing_query.order_by(Recommendation.created_at.desc()).first()

            if existing:
                existing.description = item.get("description")
                existing.why_reason = item.get("why_reason")
                existing.category = item["category"]
                existing.priority = item["priority"]
                existing.recommendation_type = rec_type
                if health_alert:
                    existing.alert_id = health_alert.id
                if prediction:
                    existing.prediction_id = prediction.id
                if observation:
                    existing.observation_id = observation.id
                if anomaly:
                    existing.anomaly_id = anomaly.id
                existing.created_at = datetime.now(timezone.utc)
                self.db.commit()
                self.db.refresh(existing)
                recommendation_objects.append(existing)
            else:
                recommendation = Recommendation(
                    cow_id=target_cow_id,
                    alert_id=getattr(health_alert, "id", None),
                    prediction_id=getattr(prediction, "id", None),
                    observation_id=getattr(observation, "id", None),
                    anomaly_id=getattr(anomaly, "id", None),
                    farm_id=target_farm_id,
                    title=rec_title,
                    description=item.get("description"),
                    why_reason=item.get("why_reason"),
                    category=item["category"],
                    priority=item["priority"],
                    recommendation_type=rec_type,
                    owner_id=user_id,
                )
                recommendation_objects.append(self.repo.save(recommendation))

        self.deduplicate_recommendations(user_id=user_id)

        return recommendation_objects

    def deduplicate_recommendations(self, user_id: Optional[str] = None) -> int:
        """Consolidate existing duplicate uncompleted recommendation records in the database."""
        try:
            query = self.db.query(Recommendation).filter(Recommendation.completed.is_(False))
            if user_id:
                query = query.filter(Recommendation.owner_id == user_id)

            recommendations = query.order_by(Recommendation.created_at.desc()).all()

            seen_keys = set()
            to_delete_ids = []

            for rec in recommendations:
                key = (
                    rec.owner_id,
                    rec.farm_id or "",
                    rec.cow_id or "",
                    rec.title or "",
                )
                if key in seen_keys:
                    to_delete_ids.append(rec.id)
                else:
                    seen_keys.add(key)

            if to_delete_ids:
                self.db.query(Recommendation).filter(Recommendation.id.in_(to_delete_ids)).delete(synchronize_session=False)
                self.db.commit()
                logger.info("Deduplicated %d uncompleted recommendation records for user %s", len(to_delete_ids), user_id)
                return len(to_delete_ids)
            return 0
        except Exception as exc:
            self.db.rollback()
            logger.warning("Recommendation deduplication encountered notice: %s", str(exc))
            return 0


    def auto_generate_for_observation(self, user_id: str, observation_id: str) -> list[Recommendation]:
        obs = self.db.get(DailyObservation, observation_id)
        if obs is None or obs.owner_id != user_id:
            return []

        alert = (
            self.db.query(HealthAlert)
            .filter(HealthAlert.observation_id == observation_id)
            .first()
        )
        prediction = (
            self.db.query(MilkPrediction)
            .filter(MilkPrediction.observation_id == observation_id)
            .first()
        )
        anomaly = (
            self.db.query(AnomalyRecord)
            .filter(AnomalyRecord.observation_id == observation_id)
            .first()
        )
        weather = obs.weather_log_id and self.db.get(WeatherLog, obs.weather_log_id)

        try:
            return self.generate_recommendations(
                user_id=user_id,
                health_alert_id=alert.id if alert else None,
                prediction_id=prediction.id if prediction else None,
                observation_id=obs.id,
                weather_log_id=weather.id if weather else None,
                anomaly_id=anomaly.id if anomaly else None,
            )
        except Exception as exc:
            logger.warning("Auto recommendation generation failed for observation %s: %s", observation_id, str(exc))
            return []

    def generate_recommendations_for_context(
        self,
        user_id: str,
        health_alert: Optional[HealthAlert] = None,
        prediction: Optional[MilkPrediction] = None,
        explainability: Optional[ExplainabilityResult] = None,
        observation: Optional[DailyObservation] = None,
        weather: Optional[WeatherLog] = None,
        anomaly: Optional[AnomalyRecord] = None,
        thi_override: Optional[float] = None,
    ) -> list[dict[str, Any]]:
        return self._generate_recommendations(
            user_id=user_id,
            health_alert=health_alert,
            prediction=prediction,
            explainability=explainability,
            observation=observation,
            weather=weather,
            anomaly=anomaly,
            thi_override=thi_override,
        )
