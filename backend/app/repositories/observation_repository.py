from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Cow, DailyObservation, Farm
from app.repositories.ownership import create_owned_instance, ensure_record_accessible, scope_query


class ObservationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_user(self, user_id: str) -> list[DailyObservation]:
        query = self.db.query(DailyObservation)
        return scope_query(query, DailyObservation, user_id).all()

    def get_for_user(self, user_id: str, observation_id: str) -> Optional[DailyObservation]:
        observation = self.db.query(DailyObservation).filter(DailyObservation.id == observation_id).first()
        if observation is None:
            return None
        try:
            ensure_record_accessible(observation, user_id)
        except PermissionError:
            return None
        if observation.cow is None or observation.cow.owner_id != user_id:
            return None
        return observation

    def get_cow(self, cow_id: str) -> Optional[Cow]:
        return self.db.query(Cow).filter(Cow.id == cow_id).first()

    def get_farm(self, farm_id: str) -> Optional[Farm]:
        return self.db.query(Farm).filter(Farm.id == farm_id).first()

    def validate_cow_and_farm(self, user_id: str, cow_id: str, farm_id: str) -> Cow:
        cow = self.get_cow(cow_id)
        if cow is None:
            raise ValueError("Cow not found")
        if cow.owner_id != user_id:
            raise PermissionError("Cow does not belong to the authenticated user")
        if cow.farm_id != farm_id:
            raise ValueError("Cow does not belong to the specified farm")

        farm = self.get_farm(farm_id)
        if farm is None:
            raise ValueError("Farm not found")
        if farm.created_by != user_id:
            raise PermissionError("Farm does not belong to the authenticated user")
        return cow

    def create(self, user_id: str, **kwargs: object) -> DailyObservation:
        kwargs.pop("farm_id", None)
        observation = create_owned_instance(DailyObservation, user_id=user_id, **kwargs)
        self.db.add(observation)
        self.db.commit()
        self.db.refresh(observation)
        return observation

    def update(self, user_id: str, observation_id: str, **kwargs: object) -> Optional[DailyObservation]:
        observation = self.get_for_user(user_id, observation_id)
        if observation is None:
            return None
        kwargs.pop("farm_id", None)
        for name, value in kwargs.items():
            if hasattr(observation, name) and name != "farm_id":
                setattr(observation, name, value)
        self.db.commit()
        self.db.refresh(observation)
        return observation

    def delete(self, user_id: str, observation_id: str) -> bool:
        observation = self.get_for_user(user_id, observation_id)
        if observation is None:
            return False
        self.db.delete(observation)
        self.db.commit()
        return True
