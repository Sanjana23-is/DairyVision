from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.models import Cow, DailyObservation, User, Farm, DigitalTwinState
from app.schemas.observation import ObservationCreate
from app.services.observation_service import ObservationService
from app.services.digital_twin_service import DigitalTwinService


def test_observation_creation_triggers_digital_twin_refresh(db_session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"dtm_{user_id}@example.com", full_name="DT Monitoring Tester")
    farm = Farm(id=str(uuid4()), name="DT Monitoring Farm", created_by=user_id)
    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="DTM-01",
        name="Bessie",
        birth_date=date(2020, 1, 1),
        weight_kg=550.0,
        owner_id=user_id,
        created_by=user_id,
    )
    db_session.add_all([user, farm, cow])
    db_session.commit()

    # Verify no DigitalTwinState record yet
    state_before = (
        db_session.query(DigitalTwinState)
        .filter(DigitalTwinState.cow_id == cow.id, DigitalTwinState.owner_id == user_id)
        .first()
    )
    assert state_before is None

    # Log observation using ObservationService
    obs_svc = ObservationService(db_session)
    obs_payload = ObservationCreate(
        cow_id=cow.id,
        farm_id=farm.id,
        observation_date=date.today(),
        milk_produced_liters=28.5,
        body_temperature_c=38.5,
        feed_quantity_kg=24.0,
        body_condition_score=3.5,
    )
    obs = obs_svc.create_observation(user_id, obs_payload)
    assert obs is not None

    # Verify DigitalTwinState record was automatically created/refreshed in DB
    state_after = (
        db_session.query(DigitalTwinState)
        .filter(DigitalTwinState.cow_id == cow.id, DigitalTwinState.owner_id == user_id)
        .first()
    )
    assert state_after is not None
    assert state_after.cow_id == cow.id
    assert state_after.vitality_score >= 80.0
    assert state_after.health_status == "Healthy"


def test_refresh_cow_digital_twin_endpoint(db_session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"dtm_ep_{user_id}@example.com", full_name="Endpoint Tester")
    farm = Farm(id=str(uuid4()), name="Endpoint Farm", created_by=user_id)
    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="DTM-02",
        name="Clarabell",
        owner_id=user_id,
        created_by=user_id,
    )
    db_session.add_all([user, farm, cow])
    db_session.commit()

    dt_svc = DigitalTwinService(db_session)
    res = dt_svc.refresh_cow_digital_twin_state(user_id, cow.id)

    assert res.cow_id == cow.id
    assert res.cow_name == "Clarabell"
    assert res.vitality_score == 100.0

    db_record = (
        db_session.query(DigitalTwinState)
        .filter(DigitalTwinState.cow_id == cow.id, DigitalTwinState.owner_id == user_id)
        .first()
    )
    assert db_record is not None
    assert db_record.vitality_score == 100.0
