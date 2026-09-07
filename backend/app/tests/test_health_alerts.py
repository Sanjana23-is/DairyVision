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
    assert res.alert_level in ('Warning', 'Critical')


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
    obs.health_condition = "fever"
    db_session.add(obs); db_session.commit()
    svc = HealthAlertService(db_session)
    res = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    reloaded = db_session.get(HealthAlert, res.id)
    assert reloaded is not None
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


def test_multiple_observations_same_cow_single_active_alert(db_session: Session):
    from app.models import DailyObservation
    user, farm, cow, obs1 = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)

    obs1.health_condition = "fever"
    db_session.add(obs1); db_session.commit()
    ha1 = svc.evaluate_and_create(user.id, cow.id, observation_id=obs1.id)
    assert ha1.alert_level in ("Warning", "Critical")

    obs2 = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), health_condition="fever", owner_id=user.id)
    db_session.add(obs2); db_session.commit()
    ha2 = svc.evaluate_and_create(user.id, cow.id, observation_id=obs2.id)

    assert ha2.id == ha1.id

    active_alerts = db_session.query(HealthAlert).filter(HealthAlert.cow_id == cow.id, HealthAlert.resolved.is_(False)).all()
    assert len(active_alerts) == 1


def test_multi_observation_evidence_summary(db_session: Session):
    from app.models import DailyObservation
    user, farm, cow, obs1 = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)

    obs1.body_temperature_c = 40.1
    db_session.add(obs1); db_session.commit()
    svc.evaluate_and_create(user.id, cow.id, observation_id=obs1.id)

    obs2 = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), body_temperature_c=39.9, owner_id=user.id)
    db_session.add(obs2); db_session.commit()
    ha2 = svc.evaluate_and_create(user.id, cow.id, observation_id=obs2.id)

    assert "recent observations" in ha2.description


def test_pre_existing_three_duplicate_momo_alerts_deduplicated(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)

    # Manually insert 3 pre-existing active Heat Stress alerts for Momo
    h1 = HealthAlert(id=str(uuid4()), cow_id=cow.id, farm_id=farm.id, alert_level="Critical", alert_type="heat_stress", description="Day 1 Heat Stress", resolved=False, owner_id=user.id)
    h2 = HealthAlert(id=str(uuid4()), cow_id=cow.id, farm_id=farm.id, alert_level="Critical", alert_type="heat_stress", description="Day 2 Heat Stress", resolved=False, owner_id=user.id)
    h3 = HealthAlert(id=str(uuid4()), cow_id=cow.id, farm_id=farm.id, alert_level="Critical", alert_type="heat_stress", description="Day 3 Heat Stress", resolved=False, owner_id=user.id)
    db_session.add_all([h1, h2, h3])
    db_session.commit()

    # API list_health_alerts should return exactly 1 active alert for Momo
    active_list = svc.list_health_alerts(user.id, resolved=False)
    momo_active = [a for a in active_list if a.cow_id == cow.id]
    assert len(momo_active) == 1

    # New observation evaluation confirms heat stress risk and updates that alert instead of creating another
    from app.models import WeatherLog
    from datetime import datetime, timezone
    wl = WeatherLog(id=str(uuid4()), farm_id=farm.id, owner_id=user.id, temperature=31.0, humidity=75.0, thi=78.0, recorded_at=datetime.now(timezone.utc))
    db_session.add(wl); db_session.commit()
    obs.weather_log_id = wl.id
    db_session.add(obs); db_session.commit()

    evaluated = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    assert evaluated.id in (h1.id, h2.id, h3.id)


    # Re-check active list
    active_after = svc.list_health_alerts(user.id, resolved=False)
    assert len([a for a in active_after if a.cow_id == cow.id]) == 1


def test_different_risk_types_and_cows_and_resolved_history(db_session: Session):
    from app.models import Cow
    user, farm, cow1, obs1 = _create_owner_entities(db_session)
    svc = HealthAlertService(db_session)

    cow2 = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='T2', owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=480.0)
    db_session.add(cow2); db_session.commit()

    # Cow 1 - Heat Stress
    h_heat = HealthAlert(id=str(uuid4()), cow_id=cow1.id, farm_id=farm.id, alert_level="Warning", alert_type="heat_stress", resolved=False, owner_id=user.id)
    # Cow 1 - High Temperature (different risk type)
    h_fever = HealthAlert(id=str(uuid4()), cow_id=cow1.id, farm_id=farm.id, alert_level="Critical", alert_type="high_temperature", resolved=False, owner_id=user.id)
    # Cow 2 - Heat Stress (different cow)
    h_cow2 = HealthAlert(id=str(uuid4()), cow_id=cow2.id, farm_id=farm.id, alert_level="Warning", alert_type="heat_stress", resolved=False, owner_id=user.id)
    # Cow 1 - Resolved historical alert (preserved history)
    h_old = HealthAlert(id=str(uuid4()), cow_id=cow1.id, farm_id=farm.id, alert_level="Warning", alert_type="heat_stress", resolved=True, owner_id=user.id)

    db_session.add_all([h_heat, h_fever, h_cow2, h_old])
    db_session.commit()

    # Active alerts should have 3 distinct active items (2 for Cow 1, 1 for Cow 2)
    active_list = svc.list_health_alerts(user.id, resolved=False)
    assert len(active_list) == 3

    # Resolved list should retain historical alert
    all_list = svc.list_health_alerts(user.id, resolved=True)
    assert any(a.id == h_old.id for a in all_list)

    # Summary counts check distinct cows
    summary = svc.get_health_summary(user.id, farm.id)
    assert summary["summary"]["needs_attention"] == 2  # Cow 1 + Cow 2


def test_farmer_facing_enriched_health_alert_response(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    cow.name = "Momo"
    obs.body_temperature_c = 40.2
    db_session.add(cow); db_session.add(obs); db_session.commit()

    svc = HealthAlertService(db_session)
    alert = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    enriched = svc.enrich_health_alert_response(alert)

    assert enriched.cow_name == "Momo"
    assert enriched.risk_display_name == "High Temperature"
    assert "Momo" in enriched.why_explanation
    assert "body temperature" in enriched.why_explanation.lower()
    assert "heat_score=" not in enriched.why_explanation
    assert enriched.evidence is not None
    assert "Body Temperature" in enriched.evidence
    assert "40.2 °C" in enriched.evidence["Body Temperature"]
    assert "Heat Stress Index (THI)" not in enriched.evidence
    assert enriched.recommended_actions is not None
    assert len(enriched.recommended_actions) >= 1


def test_farmer_facing_tag_id_fallback(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    cow.name = None
    cow.tag_id = "T1"
    obs.body_temperature_c = 40.1
    db_session.add(cow); db_session.add(obs); db_session.commit()

    svc = HealthAlertService(db_session)
    alert = svc.evaluate_and_create(user.id, cow.id, observation_id=obs.id)
    enriched = svc.enrich_health_alert_response(alert)

    assert enriched.cow_name == "T1"
    assert "T1" in enriched.why_explanation
    assert cow.id[:8] not in enriched.why_explanation





