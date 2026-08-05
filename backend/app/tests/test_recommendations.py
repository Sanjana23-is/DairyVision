from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import (
    Cow,
    DailyObservation,
    ExplainabilityResult,
    Farm,
    HealthAlert,
    MilkPrediction,
    Recommendation,
    User,
    WeatherLog,
)
from app.services.recommendation_service import RecommendationService


def _create_owner_entities(session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f'u{user_id}@example.com', full_name='Recommendation User')
    session.add(user)
    session.flush()
    farm = Farm(id=str(uuid4()), name='Recommendation Farm', timezone='UTC', created_by=user.id)
    session.add(farm)
    session.flush()
    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id='REC1',
        owner_id=user.id,
        created_by=user.id,
        birth_date=date.today(),
        weight_kg=450.0,
    )
    session.add(cow)
    session.flush()
    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_date=date.today(),
        owner_id=user.id,
    )
    session.add(obs)
    session.commit()
    return user, farm, cow, obs


def test_generate_recommendations_for_healthy_context(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_level='Healthy',
        alert_type='composite',
        description='No immediate issues',
        owner_id=user.id,
    )
    db_session.add(alert)
    db_session.commit()

    service = RecommendationService(db_session)
    recommendations = service.generate_recommendations(user.id, health_alert_id=alert.id, observation_id=obs.id)

    assert len(recommendations) >= 1
    assert all(rec.owner_id == user.id for rec in recommendations)
    assert any(rec.category == 'Observation Frequency' or rec.category == 'General Farm Management' for rec in recommendations)


def test_generate_recommendations_for_warning_heat_stress(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=32.0,
        humidity=75.0,
        thi=78.0,
        recorded_at=datetime.now(timezone.utc),
    )
    session = db_session
    session.add(weather)
    obs.weather_log_id = weather.id
    session.add(obs)
    session.commit()

    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_level='Warning',
        alert_type='composite',
        description='Moderate heat stress detected',
        owner_id=user.id,
    )
    session.add(alert)
    session.commit()

    service = RecommendationService(db_session)
    recommendations = service.generate_recommendations(user.id, health_alert_id=alert.id, weather_log_id=weather.id)

    assert any(rec.category == 'Heat Stress Management' for rec in recommendations)
    assert any(rec.priority in ('Medium', 'High') for rec in recommendations)


def test_generate_recommendations_for_critical_alert_and_shap(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.symptoms = {'lethargy': True}
    db_session.add(obs)
    db_session.commit()

    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_level='Critical',
        alert_type='composite',
        description='Lethargy symptoms present',
        owner_id=user.id,
    )
    db_session.add(alert)
    db_session.commit()

    explainability = ExplainabilityResult(
        id=str(uuid4()),
        prediction_id=None,
        fingerprint='rec-test-shap',
        owner_id=user.id,
        observation_id=obs.id,
        cow_id=cow.id,
        farm_id=farm.id,
        model_version='test-model',
        details={'features': [{'feature': 'temperature', 'value': 32.0, 'shap_value': 0.8, 'rank': 1}]},
        top_positive=[{'feature': 'temperature', 'value': 32.0, 'shap_value': 0.8, 'rank': 1}],
        top_negative=[],
    )
    db_session.add(explainability)
    db_session.commit()

    service = RecommendationService(db_session)
    recommendations = service.generate_recommendations(user.id, health_alert_id=alert.id, explainability_id=explainability.id)

    assert any(rec.category == 'Veterinary Attention' for rec in recommendations)
    assert any(rec.priority == 'High' for rec in recommendations)


def test_recommendation_persistence(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_level='Warning',
        alert_type='composite',
        description='Persistence test',
        owner_id=user.id,
    )
    db_session.add(alert)
    db_session.commit()

    service = RecommendationService(db_session)
    recommendations = service.generate_recommendations(user.id, health_alert_id=alert.id, observation_id=obs.id)

    persisted = db_session.query(Recommendation).filter(Recommendation.alert_id == alert.id).all()
    assert len(persisted) == len(recommendations)
    assert persisted[0].title == recommendations[0].title


def test_generate_recommendations_invalid_ownership(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    other_user_id = str(uuid4())
    other_user = User(id=other_user_id, email=f'u{other_user_id}@example.com', full_name='Other User')
    db_session.add(other_user)
    db_session.commit()

    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_level='Warning',
        alert_type='composite',
        description='Ownership test',
        owner_id=user.id,
    )
    db_session.add(alert)
    db_session.commit()

    service = RecommendationService(db_session)
    try:
        service.generate_recommendations(other_user.id, health_alert_id=alert.id)
        assert False
    except PermissionError:
        assert True
