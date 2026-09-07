from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.models import Cow, DailyObservation, MilkPrediction, User, Farm, WeatherLog
from app.services.digital_twin_service import DigitalTwinService


def _create_digital_twin_entities(db_session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"dt_{user_id}@example.com", full_name="Digital Twin Tester")
    farm = Farm(id=str(uuid4()), name="Digital Twin Farm", created_by=user_id)


    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="DT-01", name="Momo", birth_date=date(2021, 5, 10), weight_kg=520.0, owner_id=user_id, created_by=user_id)

    
    db_session.add_all([user, farm, cow])
    db_session.commit()

    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_date=date.today(),
        milk_produced_liters=24.5,
        body_temperature_c=38.6,
        feed_quantity_kg=22.0,

        body_condition_score=3.25,
        owner_id=user_id,
    )
    db_session.add(obs)
    db_session.commit()

    pred = MilkPrediction(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_id=obs.id,
        predicted_milk_yield=25.0,
        model_version="v1.0",
        confidence_score=0.92,
        owner_id=user_id,
        prediction_timestamp=datetime.now(timezone.utc),
    )
    db_session.add(pred)
    db_session.commit()

    return user, farm, cow, obs, pred


def test_get_cow_digital_twin_success(db_session: Session):
    user, farm, cow, obs, pred = _create_digital_twin_entities(db_session)
    svc = DigitalTwinService(db_session)

    res = svc.get_cow_digital_twin(user.id, cow.id)

    assert res.cow_id == cow.id
    assert res.cow_name == "Momo"
    assert res.vitality_score >= 80.0

    assert res.health_status == "Healthy"
    assert res.heat_stress_level == "Comfort"
    assert res.production.current_yield_l == 24.5
    assert res.production.predicted_yield_l == 25.0
    assert res.production.efficiency_pct == 98.0
    assert len(res.vital_signs) >= 2
    assert len(res.top_drivers) >= 1

    # Verify zero raw UUID exposure in status summary
    assert cow.id not in res.status_summary
    assert "Momo" in res.status_summary


def test_get_herd_digital_twin_success(db_session: Session):
    user, farm, cow, obs, pred = _create_digital_twin_entities(db_session)
    svc = DigitalTwinService(db_session)

    herd_res = svc.get_herd_digital_twin(user.id, farm.id)

    assert herd_res.herd_summary.total_cows == 1
    assert herd_res.herd_summary.average_vitality_score >= 80.0
    assert herd_res.herd_summary.health_distribution["Healthy"] == 1
    assert len(herd_res.cow_states) == 1
    assert herd_res.cow_states[0].cow_name == "Momo"


def test_digital_twin_ownership_isolation(db_session: Session):
    user, farm, cow, obs, pred = _create_digital_twin_entities(db_session)
    other_user_id = str(uuid4())
    svc = DigitalTwinService(db_session)

    with pytest.raises(PermissionError):
        svc.get_cow_digital_twin(other_user_id, cow.id)


def test_digital_twin_not_found(db_session: Session):
    user, farm, cow, obs, pred = _create_digital_twin_entities(db_session)
    svc = DigitalTwinService(db_session)

    with pytest.raises(ValueError):
        svc.get_cow_digital_twin(user.id, str(uuid4()))


def test_herd_digital_twin_without_preexisting_state_record(db_session: Session):
    """
    Regression test: An existing cow with observations but NO record in `digital_twin_states`
    must still appear in the herd Digital Twin.
    """
    user, farm, cow, obs, pred = _create_digital_twin_entities(db_session)
    svc = DigitalTwinService(db_session)

    # Ensure no DigitalTwinState table record exists
    herd_res = svc.get_herd_digital_twin(user.id, farm.id)

    assert herd_res.herd_summary.total_cows == 1
    assert len(herd_res.cow_states) == 1
    assert herd_res.cow_states[0].cow_id == cow.id
    assert herd_res.cow_states[0].cow_name == "Momo"
    assert herd_res.cow_states[0].vitality_score >= 80.0

