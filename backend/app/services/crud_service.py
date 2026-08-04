from __future__ import annotations

from typing import Any, Optional, TypeVar

from sqlalchemy.orm import Session

from app.database.base import Base
from app.models import Cow, DailyObservation, HealthAlert, MilkPrediction, Recommendation
from app.repositories.ownership import create_owned_instance, ensure_record_accessible, scope_query

T = TypeVar("T", bound=Base)


class CRUDService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_owned(self, model: type[T], user_id: str) -> list[T]:
        query = self.db.query(model)
        return scope_query(query, model, user_id).all()

    def get_owned(self, model: type[T], user_id: str, record_id: str) -> Optional[T]:
        record = self.db.query(model).filter(model.id == record_id).first()
        if record is None:
            return None

        try:
            ensure_record_accessible(record, user_id)
        except PermissionError:
            return None

        return record

    def create_owned(self, model: type[T], user_id: str, **kwargs: Any) -> T:
        instance = create_owned_instance(model, user_id=user_id, **kwargs)
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def update_owned(self, model: type[T], user_id: str, record_id: str, **kwargs: Any) -> Optional[T]:
        record = self.get_owned(model, user_id, record_id)
        if record is None:
            return None

        for key, value in kwargs.items():
            if hasattr(record, key):
                setattr(record, key, value)

        self.db.commit()
        self.db.refresh(record)
        return record

    def delete_owned(self, model: type[T], user_id: str, record_id: str) -> bool:
        record = self.get_owned(model, user_id, record_id)
        if record is None:
            return False

        self.db.delete(record)
        self.db.commit()
        return True
