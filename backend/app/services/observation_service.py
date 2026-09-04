from __future__ import annotations

import logging
from datetime import date, datetime, time, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.exceptions import (
    ObservationForbidden,
    ObservationNotFound,
    ObservationValidationError,
    WeatherNotFound,
)
from app.models import ActivityLog, Cow, DailyObservation
from app.repositories.observation_repository import ObservationRepository
from app.schemas.observation import (
    BulkObservationItem,
    BulkObservationResponse,
    BulkRowError,
    ObservationCreate,
    ObservationUpdate,
)
from app.services.weather_service import WeatherService

logger = logging.getLogger(__name__)



class ObservationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ObservationRepository(db)
        self.weather_service = WeatherService(db)

    def list_observations(self, user_id: str, farm_id: Optional[str] = None) -> list[DailyObservation]:
        return self.repository.list_for_user(user_id, farm_id=farm_id)

    def get_observation(self, user_id: str, observation_id: str) -> Optional[DailyObservation]:
        return self.repository.get_for_user(user_id, observation_id)

    def create_observation(self, user_id: str, payload: ObservationCreate) -> DailyObservation:
        payload_data = payload.model_dump(exclude_none=True)
        if payload_data.get("observation_date") is None:
            payload_data["observation_date"] = date.today()

        cow_id = payload_data["cow_id"]
        farm_id = payload_data["farm_id"]
        try:
            self.repository.validate_cow_and_farm(user_id, cow_id, farm_id)
        except ValueError as exc:
            raise ObservationValidationError(str(exc)) from exc
        except PermissionError as exc:
            raise ObservationForbidden(str(exc)) from exc

        weather_time = datetime.combine(payload_data["observation_date"], time(hour=12), tzinfo=timezone.utc)
        try:
            weather_log = self.weather_service.get_or_create_nearest_snapshot(user_id, farm_id, weather_time)
            payload_data["weather_log_id"] = weather_log.id
        except WeatherNotFound as exc:
            logger.warning(
                "Could not fetch weather log for farm %s: %s. Proceeding without weather log.",
                farm_id,
                str(exc),
            )

        observation = self.repository.create(user_id, observed_by=user_id, **payload_data)
        self._log_activity(user_id, cow_id, "observation.created", f"Created observation {observation.id}")
        self._auto_evaluate_health(user_id, observation)
        return observation

    def create_bulk_observations(
        self,
        user_id: str,
        farm_id: str,
        items: list[BulkObservationItem],
    ) -> BulkObservationResponse:
        """Process bulk observation import for a farm with row-by-row transaction safety."""
        # 1. Resolve cows belonging strictly to current farm & owner
        cows = (
            self.db.query(Cow)
            .filter(Cow.owner_id == user_id, Cow.farm_id == farm_id)
            .all()
        )
        cow_by_tag: dict[str, Cow] = {c.tag_id.strip().lower(): c for c in cows if c.tag_id}

        errors: list[BulkRowError] = []
        imported_count = 0
        failed_count = 0
        duplicate_count = 0

        for index, item in enumerate(items, start=1):
            tag_key = item.tag_id.strip().lower() if item.tag_id else ""
            if not tag_key or tag_key not in cow_by_tag:
                failed_count += 1
                errors.append(
                    BulkRowError(
                        row=index,
                        tag_id=item.tag_id,
                        reason=f"Tag ID '{item.tag_id}' not found in farm",
                    )
                )
                continue

            cow = cow_by_tag[tag_key]
            obs_date = item.observation_date or date.today()

            # Check duplicate observation for cow + date
            existing_obs = (
                self.db.query(DailyObservation)
                .filter(
                    DailyObservation.cow_id == cow.id,
                    DailyObservation.observation_date == obs_date,
                )
                .first()
            )
            if existing_obs:
                failed_count += 1
                duplicate_count += 1
                errors.append(
                    BulkRowError(
                        row=index,
                        tag_id=item.tag_id,
                        reason=f"Observation already exists for cow '{item.tag_id}' on date {obs_date}",
                    )
                )
                continue

            payload = ObservationCreate(
                farm_id=farm_id,
                cow_id=cow.id,
                observation_date=obs_date,
                milk_produced_liters=item.milk_produced_liters,
                feed_quantity_kg=item.feed_quantity_kg,
                health_condition=item.health_condition,
                body_temperature_c=item.body_temperature_c,
                body_condition_score=item.body_condition_score,
                notes=item.notes,
            )

            try:
                self.create_observation(user_id, payload)
                imported_count += 1
            except Exception as exc:
                self.db.rollback()
                failed_count += 1
                errors.append(
                    BulkRowError(
                        row=index,
                        tag_id=item.tag_id,
                        reason=str(exc),
                    )
                )

        return BulkObservationResponse(
            total_rows=len(items),
            imported_count=imported_count,
            failed_count=failed_count,
            duplicate_count=duplicate_count,
            errors=errors,
        )

    def _auto_evaluate_health(self, user_id: str, observation: DailyObservation) -> None:
        prediction_id = None
        try:
            from app.services.prediction_service import PredictionService
            pred_svc = PredictionService(self.db)
            pred = pred_svc.predict_for_observation(user_id, observation.id)
            if pred:
                prediction_id = pred.id
        except Exception as exc:
            logger.debug(
                "Prediction generation skipped/failed for observation %s: %s",
                observation.id,
                str(exc),
            )

        try:
            from app.services.health_alert_service import HealthAlertService
            health_svc = HealthAlertService(self.db)
            health_svc.evaluate_and_create(
                user_id=user_id,
                cow_id=observation.cow_id,
                observation_id=observation.id,
                prediction_id=prediction_id,
                weather_log_id=observation.weather_log_id,
                persist=True,
            )
        except Exception as exc:
            logger.warning(
                "Health evaluation failed for observation %s: %s",
                observation.id,
                str(exc),
            )

        try:
            from app.services.anomaly_detection_service import AnomalyDetectionService
            anom_svc = AnomalyDetectionService(self.db)
            anom_svc.detect_for_observation(
                user_id=user_id,
                observation_id=observation.id,
                persist=True,
            )
        except Exception as exc:
            logger.warning(
                "Anomaly detection failed for observation %s: %s",
                observation.id,
                str(exc),
            )

        try:
            from app.services.recommendation_service import RecommendationService
            rec_svc = RecommendationService(self.db)
            rec_svc.auto_generate_for_observation(
                user_id=user_id,
                observation_id=observation.id,
            )
        except Exception as exc:
            logger.warning(
                "Recommendation auto-generation failed for observation %s: %s",
                observation.id,
                str(exc),
            )

        try:
            from app.services.digital_twin_service import DigitalTwinService
            dt_svc = DigitalTwinService(self.db)
            dt_svc.refresh_cow_digital_twin_state(user_id=user_id, cow_id=observation.cow_id)
        except Exception as exc:
            logger.warning(
                "Digital Twin state refresh failed for observation %s: %s",
                observation.id,
                str(exc),
            )





    def update_observation(self, user_id: str, observation_id: str, payload: ObservationUpdate) -> Optional[DailyObservation]:
        update_data = payload.model_dump(exclude_unset=True)
        if "cow_id" in update_data or "farm_id" in update_data:
            observation = self.repository.get_for_user(user_id, observation_id)
            if observation is None:
                return None
            cow_id = update_data.get("cow_id", observation.cow_id)
            farm_id = update_data.get("farm_id", observation.farm_id)
            try:
                self.repository.validate_cow_and_farm(user_id, cow_id, farm_id)
            except ValueError as exc:
                raise ObservationValidationError(str(exc)) from exc
            except PermissionError as exc:
                raise ObservationForbidden(str(exc)) from exc

        observation = self.repository.update(user_id, observation_id, **update_data)
        if observation is None:
            return None

        if "observation_date" in update_data or observation.weather_log_id is None:
            weather_time = datetime.combine(observation.observation_date, time(hour=12), tzinfo=timezone.utc)
            try:
                weather_log = self.weather_service.get_or_create_nearest_snapshot(user_id, observation.farm_id, weather_time)
                observation.weather_log_id = weather_log.id
                self.db.commit()
                self.db.refresh(observation)
            except WeatherNotFound as exc:
                logger.warning(
                    "Could not fetch weather log for farm %s: %s. Proceeding without updating weather log.",
                    observation.farm_id,
                    str(exc),
                )

        self._log_activity(user_id, observation.cow_id, "observation.updated", f"Updated observation {observation.id}")
        return observation

    def delete_observation(self, user_id: str, observation_id: str) -> bool:
        observation = self.repository.get_for_user(user_id, observation_id)
        if observation is None:
            return False
        deleted = self.repository.delete(user_id, observation_id)
        if deleted:
            self._log_activity(user_id, observation.cow_id, "observation.deleted", f"Deleted observation {observation.id}")
        return deleted

    def _log_activity(self, user_id: str, cow_id: str, activity_type: str, description: str) -> None:
        log = ActivityLog(
            cow_id=cow_id,
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            owner_id=user_id,
        )
        self.db.add(log)
        self.db.commit()
