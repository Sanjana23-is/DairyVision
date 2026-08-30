from datetime import date
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models import AnomalyRecord, Cow, DailyObservation, Farm, User
from app.schemas.observation import ObservationCreate
from app.services.anomaly_detection_service import AnomalyDetectionService
from app.services.observation_service import ObservationService


def _create_user_farm_cow(session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"anom_{user_id}@example.com", full_name="Anomaly User")
    session.add(user); session.flush()

    farm = Farm(id=str(uuid4()), name="Anom Farm", timezone="UTC", created_by=user.id, latitude=0.0, longitude=0.0)
    session.add(farm); session.flush()

    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="A1", owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=550.0, age_months=36)
    session.add(cow); session.flush()

    return user.id, farm.id, cow.id


def test_detect_for_normal_observation(db_session: Session):
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    obs = DailyObservation(id=str(uuid4()), cow_id=cow_id, observation_date=date.today(), milk_produced_liters=15.0, feed_quantity_kg=12.0, owner_id=user_id)
    db_session.add(obs); db_session.commit()

    service = AnomalyDetectionService(db_session)
    record = service.detect_for_observation(user_id, obs.id, persist=True)

    assert record is not None
    assert record.cow_id == cow_id
    assert record.farm_id == farm_id
    assert record.owner_id == user_id
    assert record.severity == "Normal"


def test_detect_for_critical_temperature_spike(db_session: Session):
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    obs = DailyObservation(id=str(uuid4()), cow_id=cow_id, observation_date=date.today(), milk_produced_liters=10.0, body_temperature_c=40.5, owner_id=user_id)
    db_session.add(obs); db_session.commit()

    service = AnomalyDetectionService(db_session)
    record = service.detect_for_observation(user_id, obs.id, persist=True)

    assert record is not None
    assert record.severity == "Critical"
    assert "High Temperature Spike" in record.issue_tags


def test_auto_trigger_anomaly_detection_on_observation_created(db_session: Session):
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    obs_svc = ObservationService(db_session)

    obs = obs_svc.create_observation(
        user_id,
        ObservationCreate(farm_id=farm_id, cow_id=cow_id, milk_produced_liters=4.0, feed_quantity_kg=3.0),
    )

    record = db_session.query(AnomalyRecord).filter(AnomalyRecord.observation_id == obs.id).first()
    assert record is not None
    assert record.cow_id == cow_id
    assert record.owner_id == user_id


def test_anomaly_detection_prevents_duplicates(db_session: Session):
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    obs = DailyObservation(id=str(uuid4()), cow_id=cow_id, observation_date=date.today(), milk_produced_liters=15.0, owner_id=user_id)
    db_session.add(obs); db_session.commit()

    service = AnomalyDetectionService(db_session)
    rec1 = service.detect_for_observation(user_id, obs.id, persist=True)
    rec2 = service.detect_for_observation(user_id, obs.id, persist=True)

    assert rec1.id == rec2.id
    count = db_session.query(AnomalyRecord).filter(AnomalyRecord.observation_id == obs.id).count()
    assert count == 1


def test_run_herd_anomaly_scan(db_session: Session):
    user_id, farm_id, cow_id = _create_user_farm_cow(db_session)
    obs = DailyObservation(id=str(uuid4()), cow_id=cow_id, observation_date=date.today(), milk_produced_liters=12.0, owner_id=user_id)
    db_session.add(obs); db_session.commit()

    service = AnomalyDetectionService(db_session)
    scanned_cnt = service.run_herd_anomaly_scan(user_id, farm_id)

    assert scanned_cnt >= 1
    summary = service.get_anomaly_summary(user_id, farm_id)
    assert summary["summary"]["total_scanned"] == 1



def test_anomaly_user_scoping_isolation(db_session: Session):
    u1, f1, c1 = _create_user_farm_cow(db_session)
    u2, f2, c2 = _create_user_farm_cow(db_session)

    service = AnomalyDetectionService(db_session)
    sum1 = service.get_anomaly_summary(u1, f1)
    sum2 = service.get_anomaly_summary(u2, f2)

    assert sum1["summary"]["total_scanned"] == 1
    assert sum2["summary"]["total_scanned"] == 1
