from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.exceptions import ObservationForbidden, ObservationValidationError
from app.models import ActivityLog, Cow, DailyObservation, Farm, User
from app.schemas.observation import ObservationCreate, ObservationUpdate
from app.services.observation_service import ObservationService


def _create_user_farm_cow(session: Session) -> tuple[str, str, str]:
    user_id = str(uuid4())
    user = User(id=user_id, email=f"user+{user_id}@example.com", full_name="Test User")
    session.add(user)
    session.flush()

    farm = Farm(
        id=str(uuid4()),
        name="Test Farm",
        timezone="UTC",
        latitude=12.345678,
        longitude=98.765432,
        created_by=user.id,
    )
    session.add(farm)
    session.flush()

    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="TAG123",
        status="active",
        owner_id=user.id,
        created_by=user.id,
    )
    session.add(cow)
    session.commit()
    return user.id, farm.id, cow.id


def test_create_observation_succeeds_for_valid_cow_and_farm(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        milk_produced_liters=10.5,
        feed_quantity_kg=12.0,
        notes="Routine check",
    )

    observation = service.create_observation(user_id, payload)

    assert observation.id is not None
    assert observation.owner_id == user_id
    assert observation.observed_by == user_id
    assert observation.cow_id == cow_id
    assert observation.farm_id == farm_id
    assert observation.milk_produced_liters == 10.5
    assert observation.feed_quantity_kg == 12.0
    assert observation.notes == "Routine check"


def test_create_observation_rejects_unknown_cow(db_session: Session) -> None:
    user_id, farm_id, _ = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(farm_id=farm_id, cow_id=str(uuid4()))

    with pytest.raises(ObservationValidationError, match="Cow not found"):
        service.create_observation(user_id, payload)


def test_create_observation_rejects_cow_of_other_user(db_session: Session) -> None:
    owner_a_id, farm_a_id, cow_id = _create_user_farm_cow(db_session)

    owner_b_id = str(uuid4())
    owner_b = User(id=owner_b_id, email=f"other+{owner_b_id}@example.com", full_name="Other User")
    db_session.add(owner_b)
    db_session.commit()

    service = ObservationService(db_session)
    payload = ObservationCreate(farm_id=farm_a_id, cow_id=cow_id)

    with pytest.raises(ObservationForbidden, match="Cow does not belong to the authenticated user"):
        service.create_observation(owner_b_id, payload)


def test_update_observation_rejects_mismatched_farm(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    observation = service.create_observation(
        user_id,
        ObservationCreate(farm_id=farm_id, cow_id=cow_id, milk_produced_liters=5.0),
    )

    other_farm = Farm(id=str(uuid4()), name="Other Farm", timezone="UTC", created_by=user_id)
    db_session.add(other_farm)
    db_session.commit()

    with pytest.raises(ObservationValidationError, match="Cow does not belong to the specified farm"):
        service.update_observation(
            user_id,
            observation.id,
            ObservationUpdate(farm_id=other_farm.id),
        )


def test_delete_observation_removes_record_and_logs_activity(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    observation = service.create_observation(
        user_id,
        ObservationCreate(farm_id=farm_id, cow_id=cow_id, milk_produced_liters=8.0),
    )

    deleted = service.delete_observation(user_id, observation.id)

    assert deleted is True
    assert db_session.get(DailyObservation, observation.id) is None

    deleted_activity = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.cow_id == cow_id, ActivityLog.activity_type == "observation.deleted")
        .one_or_none()
    )
    assert deleted_activity is not None
    assert deleted_activity.activity_type == "observation.deleted"
    assert user_id == deleted_activity.owner_id


def test_create_observation_succeeds_without_farm_coordinates(db_session: Session) -> None:
    user_id = str(uuid4())
    user = User(id=user_id, email=f"user+{user_id}@example.com", full_name="Test User")
    db_session.add(user)
    db_session.flush()

    farm = Farm(
        id=str(uuid4()),
        name="No-Coords Farm",
        timezone="UTC",
        latitude=None,
        longitude=None,
        created_by=user.id,
    )
    db_session.add(farm)
    db_session.flush()

    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="TAG999",
        status="active",
        owner_id=user.id,
        created_by=user.id,
    )
    db_session.add(cow)
    db_session.commit()

    service = ObservationService(db_session)
    payload = ObservationCreate(
        farm_id=farm.id,
        cow_id=cow.id,
        milk_produced_liters=12.0,
        feed_quantity_kg=15.0,
        notes="Weather-free check",
    )

    observation = service.create_observation(user_id, payload)

    assert observation.id is not None
    assert observation.owner_id == user_id
    assert observation.observed_by == user_id
    assert observation.cow_id == cow.id
    assert observation.farm_id == farm.id
    assert observation.milk_produced_liters == 12.0
    assert observation.feed_quantity_kg == 15.0
    assert observation.weather_log_id is None
