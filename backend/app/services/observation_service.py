from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.exceptions import ObservationForbidden, ObservationNotFound, ObservationValidationError
from app.models import ActivityLog, DailyObservation
from app.repositories.observation_repository import ObservationRepository
from app.schemas.observation import ObservationCreate, ObservationUpdate


class ObservationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = ObservationRepository(db)

    def list_observations(self, user_id: str) -> list[DailyObservation]:
        return self.repository.list_for_user(user_id)

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

        observation = self.repository.create(user_id, observed_by=user_id, **payload_data)
        self._log_activity(user_id, cow_id, "observation.created", f"Created observation {observation.id}")
        return observation

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
