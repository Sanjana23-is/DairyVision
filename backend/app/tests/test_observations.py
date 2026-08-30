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


def test_create_observation_without_health_info(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        milk_produced_liters=15.0,
    )
    observation = service.create_observation(user_id, payload)

    assert observation.id is not None
    assert observation.health_condition == "normal" or observation.health_condition is None
    assert observation.body_temperature_c is None
    assert observation.body_condition_score is None


def test_create_observation_with_health_condition(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        health_condition="mastitis",
    )
    observation = service.create_observation(user_id, payload)

    assert observation.id is not None
    assert observation.health_condition == "mastitis"


def test_create_observation_with_body_temperature(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        body_temperature_c=38.5,
    )
    observation = service.create_observation(user_id, payload)

    assert observation.id is not None
    assert float(observation.body_temperature_c) == 38.5


def test_create_observation_with_bcs(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        body_condition_score=3.5,
    )
    observation = service.create_observation(user_id, payload)

    assert observation.id is not None
    assert float(observation.body_condition_score) == 3.5


def test_observation_rejects_bcs_outside_range(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)

    with pytest.raises(Exception):
        ObservationCreate(
            farm_id=farm_id,
            cow_id=cow_id,
            body_condition_score=0.5,
        )

    with pytest.raises(Exception):
        ObservationCreate(
            farm_id=farm_id,
            cow_id=cow_id,
            body_condition_score=5.5,
        )


def test_observation_rejects_invalid_health_condition(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)

    with pytest.raises(Exception):
        ObservationCreate(
            farm_id=farm_id,
            cow_id=cow_id,
            health_condition="invalid_disease",
        )


def test_existing_observation_compatibility(db_session: Session) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        milk_produced_liters=14.0,
        feed_quantity_kg=12.0,
        symptoms={"condition": "abnormal", "signs": ["lethargy"]},
        notes="Legacy observation format",
    )
    observation = service.create_observation(user_id, payload)

    assert observation.id is not None
    assert observation.symptoms == {"condition": "abnormal", "signs": ["lethargy"]}
    assert observation.notes == "Legacy observation format"


def test_auto_health_eval_on_normal_observation(db_session: Session) -> None:
    from app.models import HealthAlert
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        milk_produced_liters=15.0,
        health_condition="normal",
    )
    obs = service.create_observation(user_id, payload)

    alert = db_session.query(HealthAlert).filter(HealthAlert.observation_id == obs.id).first()
    assert alert is not None
    assert alert.cow_id == cow_id
    assert alert.farm_id == farm_id
    assert alert.owner_id == user_id
    assert alert.alert_level in ("Healthy", "Warning")



def test_auto_health_eval_fever_creates_critical_alert(db_session: Session) -> None:
    from app.models import HealthAlert
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        health_condition="fever",
    )
    obs = service.create_observation(user_id, payload)

    alert = db_session.query(HealthAlert).filter(HealthAlert.observation_id == obs.id).first()
    assert alert is not None
    assert alert.alert_level == "Critical"


def test_auto_health_eval_abnormal_temp_triggers_alert(db_session: Session) -> None:
    from app.models import HealthAlert
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        body_temperature_c=40.5,
    )
    obs = service.create_observation(user_id, payload)

    alert = db_session.query(HealthAlert).filter(HealthAlert.observation_id == obs.id).first()
    assert alert is not None
    assert alert.alert_level == "Critical"


def test_auto_health_eval_high_thi_evaluated(db_session: Session) -> None:
    from app.models import HealthAlert, WeatherLog
    from datetime import datetime, timezone
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)

    # create a weather log with high THI (78.0)
    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm_id,
        owner_id=user_id,
        temperature=32.0,
        humidity=70.0,
        thi=78.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.commit()

    service = ObservationService(db_session)
    payload = ObservationCreate(
        farm_id=farm_id,
        cow_id=cow_id,
        milk_produced_liters=10.0,
    )
    obs = service.create_observation(user_id, payload)

    alert = db_session.query(HealthAlert).filter(HealthAlert.observation_id == obs.id).first()
    assert alert is not None
    assert alert.alert_level in ("Warning", "Critical")


def test_auto_health_eval_milk_drop_risk(db_session: Session) -> None:
    from app.models import HealthAlert, MilkPrediction
    from datetime import datetime, timezone
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)

    service = ObservationService(db_session)
    obs = service.create_observation(user_id, ObservationCreate(farm_id=farm_id, cow_id=cow_id, milk_produced_liters=5.0))

    # attach a prediction with high expected yield (20.0 L) vs observed (5.0 L) -> 75% drop
    pred = MilkPrediction(
        id=str(uuid4()),
        cow_id=cow_id,
        observation_id=obs.id,
        predicted_milk_yield=20.0,
        model_version="test_v1",
        owner_id=user_id,
        prediction_timestamp=datetime.now(timezone.utc),
    )
    db_session.add(pred)
    db_session.commit()

    from app.services.health_alert_service import HealthAlertService
    has = HealthAlertService(db_session)
    alert = has.evaluate_and_create(user_id=user_id, observation_id=obs.id)

    assert alert is not None
    assert alert.prediction_id == pred.id
    assert alert.alert_level in ("Warning", "Critical")


def test_auto_health_eval_links_ids_properly(db_session: Session) -> None:
    from app.models import HealthAlert
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    obs = service.create_observation(user_id, ObservationCreate(farm_id=farm_id, cow_id=cow_id, milk_produced_liters=12.0))

    alert = db_session.query(HealthAlert).filter(HealthAlert.observation_id == obs.id).first()
    assert alert is not None
    assert alert.observation_id == obs.id
    assert alert.cow_id == cow_id
    assert alert.farm_id == farm_id
    assert alert.owner_id == user_id


def test_health_eval_failure_does_not_fail_observation(db_session: Session, monkeypatch) -> None:
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    def mock_eval(*args, **kwargs):
        raise RuntimeError("Subsystem failure")

    from app.services.health_alert_service import HealthAlertService
    monkeypatch.setattr(HealthAlertService, "evaluate_and_create", mock_eval)

    obs = service.create_observation(user_id, ObservationCreate(farm_id=farm_id, cow_id=cow_id, milk_produced_liters=10.0))

    assert obs is not None
    assert obs.id is not None


def test_auto_health_eval_prevents_duplicate_alerts(db_session: Session) -> None:
    from app.models import HealthAlert
    from app.services.health_alert_service import HealthAlertService

    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    service = ObservationService(db_session)

    obs = service.create_observation(user_id, ObservationCreate(farm_id=farm_id, cow_id=cow_id, health_condition="normal"))

    # Initial alert count for this observation
    count_1 = db_session.query(HealthAlert).filter(HealthAlert.observation_id == obs.id).count()
    assert count_1 == 1

    # Re-evaluate health alert for same observation
    has = HealthAlertService(db_session)
    has.evaluate_and_create(user_id=user_id, observation_id=obs.id)

    count_2 = db_session.query(HealthAlert).filter(HealthAlert.observation_id == obs.id).count()
    assert count_2 == 1  # Updated in place, no duplicate row added


