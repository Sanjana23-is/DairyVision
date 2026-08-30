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
    reloaded = db_session.get(HealthAlert, res.id)
    assert float(reloaded.confidence) == float(res.confidence)
    assert 'confidence=' not in (reloaded.description or '')


def test_health_summary_returns_correct_counts(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)

    # Initially normal observation
    svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    summary = svc.get_health_summary(user.id, farm.id)

    assert summary["summary"]["total_cows"] == 1
    assert summary["summary"]["needs_attention"] == 0
    assert summary["summary"]["healthy"] == 1


def test_health_summary_user_and_farm_scoping(db_session: Session):
    user1, farm1, cow1, obs1 = _create_owner_entities(db_session)
    user2, farm2, cow2, obs2 = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)

    svc.evaluate_and_create(user1.id, cow1.id, observation_id=obs1.id)
    svc.evaluate_and_create(user2.id, cow2.id, observation_id=obs2.id)

    sum1 = svc.get_health_summary(user1.id, farm1.id)
    sum2 = svc.get_health_summary(user2.id, farm2.id)

    assert sum1["summary"]["total_cows"] == 1
    assert sum2["summary"]["total_cows"] == 1


def test_health_summary_risk_breakdown_categories(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.health_condition = "fever"
    db_session.add(obs); db_session.commit()

    svc = HealthAlertService(db_session)
    svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)

    summary = svc.get_health_summary(user.id, farm.id)
    assert summary["summary"]["critical"] == 1
    assert summary["summary"]["needs_attention"] == 1
    assert len(summary["attention_cows"]) == 1
    assert summary["attention_cows"][0]["cow_name"] == "T1"


def test_health_summary_handles_resolved_alerts(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.health_condition = "mastitis"
    db_session.add(obs); db_session.commit()

    svc = HealthAlertService(db_session)
    ha = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)

    # Active
    sum_before = svc.get_health_summary(user.id, farm.id)
    assert sum_before["summary"]["needs_attention"] == 1

    # Resolve
    ha.resolved = True
    db_session.commit()

    sum_after = svc.get_health_summary(user.id, farm.id)
    assert sum_after["summary"]["needs_attention"] == 0
    assert sum_after["summary"]["healthy"] == 1


def test_health_summary_multiple_alerts_same_cow(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)

    # Create critical alert
    ha1 = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        farm_id=farm.id,
        alert_level="Critical",
        alert_type="composite",
        description="heat_score=0.90",
        confidence=0.9,
        resolved=False,
        owner_id=user.id,
    )
    ha2 = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        farm_id=farm.id,
        alert_level="Warning",
        alert_type="composite",
        description="milk_score=0.50",
        confidence=0.5,
        resolved=False,
        owner_id=user.id,
    )
    db_session.add(ha1); db_session.add(ha2); db_session.commit()

    summary = svc.get_health_summary(user.id, farm.id)
    assert summary["summary"]["total_cows"] == 1
    assert summary["summary"]["critical"] == 1
    assert summary["summary"]["needs_attention"] == 1
    assert len(summary["attention_cows"]) == 1


def test_health_summary_empty_state(db_session: Session):
    from app.models import User
    user_id = str(uuid4())
    user = User(id=user_id, email=f'empty_{user_id}@example.com', full_name='Empty Test')
    db_session.add(user); db_session.commit()

    svc = HealthAlertService(db_session)
    summary = svc.get_health_summary(user.id)

    assert summary["summary"]["total_cows"] == 0
    assert summary["summary"]["healthy"] == 0
    assert summary["summary"]["needs_attention"] == 0
    assert summary["attention_cows"] == []

