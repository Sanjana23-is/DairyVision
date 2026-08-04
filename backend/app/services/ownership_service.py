from __future__ import annotations

from typing import TypeVar

from sqlalchemy.orm import Session

from app.database.base import Base
from app.repositories.ownership import ensure_record_accessible, scope_query

T = TypeVar("T", bound=Base)


class OwnershipService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_owned(self, model: type[T], user_id: str):
        query = self.db.query(model)
        return scope_query(query, model, user_id).all()

    def get_owned(self, model: type[T], user_id: str, record_id: str):
        record = self.db.query(model).filter(model.id == record_id).first()
        if record is None:
            return None
        ensure_record_accessible(record, user_id)
        return record

    def create_owned(self, model: type[T], user_id: str, **kwargs):
        instance = model(**kwargs)
        setattr(instance, "owner_id", user_id)
        return instance
