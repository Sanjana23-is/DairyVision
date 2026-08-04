from __future__ import annotations

from typing import Any, TypeVar

from sqlalchemy.orm import Query

from app.database.base import Base

T = TypeVar("T", bound=Base)


def create_owned_instance(model: type[T], user_id: str, **kwargs: Any) -> T:
    kwargs.setdefault("owner_id", user_id)
    if hasattr(model, "created_by"):
        kwargs.setdefault("created_by", user_id)
    if hasattr(model, "observed_by"):
        kwargs.setdefault("observed_by", user_id)
    if hasattr(model, "user_id") and "user_id" not in kwargs:
        kwargs.setdefault("user_id", user_id)
    return model(**kwargs)


def scope_query(query: Query[T], model: type[T], user_id: str) -> Query[T]:
    if hasattr(model, "owner_id"):
        return query.filter(model.owner_id == user_id)
    if hasattr(model, "created_by"):
        return query.filter(model.created_by == user_id)
    if hasattr(model, "user_id"):
        return query.filter(model.user_id == user_id)
    return query


def ensure_record_accessible(record: Base, user_id: str) -> None:
    if hasattr(record, "owner_id"):
        owner_id = getattr(record, "owner_id", None)
        if owner_id is not None and owner_id != user_id:
            raise PermissionError("User does not have access to this record")
        return

    if hasattr(record, "created_by"):
        created_by = getattr(record, "created_by", None)
        if created_by is not None and created_by != user_id:
            raise PermissionError("User does not have access to this record")
        return

    if hasattr(record, "user_id"):
        user_id_field = getattr(record, "user_id", None)
        if user_id_field is not None and user_id_field != user_id:
            raise PermissionError("User does not have access to this record")
        return
