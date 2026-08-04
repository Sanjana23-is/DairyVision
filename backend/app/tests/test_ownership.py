from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.models.cow import Cow
from app.models.farm import Farm
from app.models.user import User
from app.repositories.ownership import create_owned_instance, ensure_record_accessible, scope_query


@pytest.fixture()
def session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_create_owned_instance_sets_owner_id(session: Session) -> None:
    owner = User(id=str(uuid4()), email="owner@example.com", full_name="Owner")
    session.add(owner)
    session.flush()

    farm = Farm(id=str(uuid4()), name="Demo Farm", timezone="UTC", created_by=owner.id)
    session.add(farm)
    session.flush()

    cow = create_owned_instance(
        Cow,
        user_id=owner.id,
        farm_id=farm.id,
        tag_id="tag-1",
        status="active",
    )
    session.add(cow)
    session.flush()

    assert cow.owner_id == owner.id


def test_scope_query_filters_records_by_owner(session: Session) -> None:
    owner_a = User(id=str(uuid4()), email="a@example.com", full_name="User A")
    owner_b = User(id=str(uuid4()), email="b@example.com", full_name="User B")
    session.add_all([owner_a, owner_b])
    session.flush()

    farm_a = Farm(id=str(uuid4()), name="Farm A", timezone="UTC", created_by=owner_a.id)
    farm_b = Farm(id=str(uuid4()), name="Farm B", timezone="UTC", created_by=owner_b.id)
    session.add_all([farm_a, farm_b])
    session.flush()

    cow_a = create_owned_instance(Cow, user_id=owner_a.id, farm_id=farm_a.id, tag_id="tag-a", status="active")
    cow_b = create_owned_instance(Cow, user_id=owner_b.id, farm_id=farm_b.id, tag_id="tag-b", status="active")
    session.add_all([cow_a, cow_b])
    session.commit()

    scoped_records = scope_query(session.query(Cow), Cow, owner_a.id).all()

    assert [record.id for record in scoped_records] == [cow_a.id]


def test_ensure_record_accessible_rejects_other_users_data(session: Session) -> None:
    owner_a = User(id=str(uuid4()), email="a2@example.com", full_name="User A")
    owner_b = User(id=str(uuid4()), email="b2@example.com", full_name="User B")
    session.add_all([owner_a, owner_b])
    session.flush()

    farm_a = Farm(id=str(uuid4()), name="Farm A", timezone="UTC", created_by=owner_a.id)
    farm_b = Farm(id=str(uuid4()), name="Farm B", timezone="UTC", created_by=owner_b.id)
    session.add_all([farm_a, farm_b])
    session.flush()

    cow_b = create_owned_instance(Cow, user_id=owner_b.id, farm_id=farm_b.id, tag_id="tag-b2", status="active")
    session.add(cow_b)
    session.commit()

    with pytest.raises(PermissionError):
        ensure_record_accessible(cow_b, owner_a.id)
