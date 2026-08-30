from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database.base import Base
from app.main import app
from app.models import Cow, Farm, User
from app.schemas.crud import CowCreate, CowUpdate
from app.tests.test_ownership import session as ownership_session_fixture


client = TestClient(app)


def _create_user_and_farm(session: Session) -> tuple[str, str]:
    user_id = str(uuid4())
    user = User(id=user_id, email=f"user+{user_id}@example.com", full_name="Test User")
    session.add(user)
    session.flush()
    farm = Farm(id=str(uuid4()), name="Test Farm", timezone="UTC", created_by=user.id)
    session.add(farm)
    session.commit()
    return user.id, farm.id


def test_cow_crud_ownership(session: Session) -> None:
    user_id, farm_id = _create_user_and_farm(session)

    cow_payload = CowCreate(farm_id=farm_id, tag_id="TAG123", status="active")
    cow = Cow(
        id=str(uuid4()),
        farm_id=cow_payload.farm_id,
        tag_id=cow_payload.tag_id,
        status=cow_payload.status,
        owner_id=user_id,
        created_by=user_id,
    )
    session.add(cow)
    session.commit()

    fetched = session.query(Cow).filter(Cow.owner_id == user_id).one_or_none()
    assert fetched is not None
    assert fetched.tag_id == cow_payload.tag_id
    assert fetched.owner_id == user_id

    updated = session.get(Cow, fetched.id)
    assert updated is not None
    updated.status = "dry"
    session.commit()

    reloaded = session.get(Cow, fetched.id)
    assert reloaded.status == "dry"

    session.delete(reloaded)
    session.commit()
    assert session.query(Cow).filter(Cow.id == fetched.id).first() is None


def test_user_cannot_access_another_users_cow(session: Session) -> None:
    owner_a_id, farm_id = _create_user_and_farm(session)
    owner_b_id = str(uuid4())
    owner_b = User(id=owner_b_id, email=f"other+{owner_b_id}@example.com", full_name="Other User")
    session.add(owner_b)
    session.commit()

    cow = Cow(
        id=str(uuid4()),
        farm_id=farm_id,
        tag_id="TAG999",
        status="active",
        owner_id=owner_a_id,
        created_by=owner_a_id,
    )
    session.add(cow)
    session.commit()

    forbidden = session.query(Cow).filter(Cow.owner_id == owner_b_id, Cow.id == cow.id).first()
    assert forbidden is None
