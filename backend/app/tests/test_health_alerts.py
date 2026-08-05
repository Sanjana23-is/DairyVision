from uuid import uuid4
from datetime import date

from sqlalchemy.orm import Session

from app.services.health_alert_service import HealthAlertService
from app.models import HealthAlert, WeatherLog
from app.schemas.feature import FeatureVector


def _create_owner_entities(session: Session):
    from app.models import User, Farm, Cow, DailyObservation

    user_id = str(uuid4())
    user = User(id=user_id, email=f'u{user_id}@example.com', full_name='HA Test')
    session.add(user); session.flush()
    farm = Farm(id=str(uuid4()), name='HA Farm', timezone='UTC', created_by=user.id, latitude=0.0, longitude=0.0)
    session.add(farm); session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='T1', owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=500.0)
    session.add(cow); session.flush()
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id)
    session.add(obs)
    session.commit()
    return user, farm, cow, obs


def test_healthy_alert(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)
    # no weather, no prediction, expect Healthy
    res = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    assert res.alert_level == 'Healthy'
    assert 0.0 <= float(res.confidence) <= 1.0


def test_warning_alert_from_thi(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    # create weather with moderate THI
    from datetime import datetime, timezone
    wl = WeatherLog(id=str(uuid4()), farm_id=farm.id, owner_id=user.id, temperature=30.0, humidity=70.0, thi=75.0, recorded_at=datetime.now(timezone.utc))
    db_session.add(wl); db_session.commit()
    svc = HealthAlertService(db_session)
    res = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id, weather_log_id=wl.id)
    assert res.alert_level in ('Warning','Critical')


def test_critical_alert_from_symptoms(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.symptoms = {'lethargy': True}
    db_session.add(obs); db_session.commit()
    svc = HealthAlertService(db_session)
    res = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    assert res.alert_level == 'Critical'


def test_invalid_ownership(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    other = str(uuid4())
    svc = HealthAlertService(db_session)
    try:
        svc.evaluate_and_create(other, cow.id, observation_id=obs.id)
        assert False
    except PermissionError:
        pass


def test_persistence(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)
    res = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    reloaded = db_session.query(HealthAlert).get(res.id)
    assert reloaded is not None
    assert float(reloaded.confidence) == float(res.confidence)
    assert 'confidence=' not in (reloaded.description or '')
