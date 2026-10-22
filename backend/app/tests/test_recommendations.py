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
    assert any(rec.why_reason and "heat stress" in rec.why_reason.lower() for rec in recommendations)


def test_generate_recommendations_for_critical_alert_and_shap(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.symptoms = {'lethargy': True}
    db_session.add(obs)
    db_session.commit()

    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_id=obs.id,
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


def test_generate_recommendations_for_anomaly(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    from app.models import AnomalyRecord
    anom = AnomalyRecord(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_id=obs.id,
        farm_id=farm.id,
        owner_id=user.id,
        anomaly_score=0.85,
        severity="Critical",
        anomaly_type="composite",
        issue_tags=["Extreme Heat Stress", "Abnormal Milk Drop"],
    )
    db_session.add(anom)
    db_session.commit()

    service = RecommendationService(db_session)
    recs = service.generate_recommendations(user.id, anomaly_id=anom.id)

    assert len(recs) >= 1
    assert any(r.category == "Heat Stress Management" for r in recs)
    assert any(r.category == "Feeding Strategy" for r in recs)


def test_auto_generate_recommendation_on_observation_created(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    from app.services.observation_service import ObservationService
    from app.schemas.observation import ObservationCreate

    obs_svc = ObservationService(db_session)
    new_obs = obs_svc.create_observation(
        user.id,
        ObservationCreate(farm_id=farm.id, cow_id=cow.id, milk_produced_liters=4.0, feed_quantity_kg=3.0),
    )

    recs = db_session.query(Recommendation).filter(Recommendation.observation_id == new_obs.id).all()
    assert len(recs) >= 1


def test_prevent_duplicate_pending_recommendation(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_level='Warning',
        alert_type='composite',
        description='Duplicate test alert',
        owner_id=user.id,
    )
    db_session.add(alert)
    db_session.commit()

    service = RecommendationService(db_session)
    recs1 = service.generate_recommendations(user.id, health_alert_id=alert.id, observation_id=obs.id)
    first_count = db_session.query(Recommendation).filter(Recommendation.owner_id == user.id, Recommendation.completed.is_(False)).count()

    recs2 = service.generate_recommendations(user.id, health_alert_id=alert.id, observation_id=obs.id)
    second_count = db_session.query(Recommendation).filter(Recommendation.owner_id == user.id, Recommendation.completed.is_(False)).count()

    assert second_count == first_count
    assert recs1[0].id == recs2[0].id


def test_completed_recommendation_allows_new_recommendation(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_level='Warning',
        alert_type='composite',
        description='Completed test alert',
        owner_id=user.id,
    )
    db_session.add(alert)
    db_session.commit()

    service = RecommendationService(db_session)
    recs1 = service.generate_recommendations(user.id, health_alert_id=alert.id, observation_id=obs.id)
    rec_obj = recs1[0]
    rec_obj.completed = True
    db_session.commit()

    recs2 = service.generate_recommendations(user.id, health_alert_id=alert.id, observation_id=obs.id)
    assert recs2[0].id != rec_obj.id
    assert recs2[0].completed is False


def test_different_cows_and_types_deduplicated_separately(db_session: Session):
    user, farm, cow1, obs1 = _create_owner_entities(db_session)
    cow2 = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id='REC2',
        owner_id=user.id,
        created_by=user.id,
        birth_date=date.today(),
        weight_kg=500.0,
    )
    db_session.add(cow2)
    db_session.commit()

    rec1 = Recommendation(
        id=str(uuid4()),
        farm_id=farm.id,
        cow_id=cow1.id,
        title="Check ventilation",
        category="Heat Stress Management",
        priority="Medium",
        recommendation_type="generated",
        owner_id=user.id,
        completed=False,
    )
    rec2 = Recommendation(
        id=str(uuid4()),
        farm_id=farm.id,
        cow_id=cow2.id,
        title="Check ventilation",
        category="Heat Stress Management",
        priority="Medium",
        recommendation_type="generated",
        owner_id=user.id,
        completed=False,
    )
    rec3 = Recommendation(
        id=str(uuid4()),
        farm_id=farm.id,
        cow_id=None,
        title="Farm climate alert",
        category="Heat Stress Management",
        priority="High",
        recommendation_type="generated",
        owner_id=user.id,
        completed=False,
    )
    db_session.add_all([rec1, rec2, rec3])
    db_session.commit()

    from app.api.v1.dairy import list_recommendations
    res = list_recommendations(farm_id=farm.id, user_id=user.id, db=db_session)
    titles_and_cows = [(r.cow_id, r.title) for r in res]

    assert (cow1.id, "Check ventilation") in titles_and_cows
    assert (cow2.id, "Check ventilation") in titles_and_cows
    assert (None, "Farm climate alert") in titles_and_cows


def test_get_recommendations_endpoint_serialization(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    rec = Recommendation(
        id=str(uuid4()),
        farm_id=farm.id,
        cow_id=cow.id,
        title="Serialization Test Recommendation",
        category="General Farm Management",
        priority="Medium",
        recommendation_type="generated",
        owner_id=user.id,
        completed=False,
    )
    db_session.add(rec)
    db_session.commit()

    from app.api.v1.dairy import list_recommendations
    res = list_recommendations(farm_id=farm.id, completed=False, user_id=user.id, db=db_session)
    assert len(res) >= 1
    item = res[0]
    assert item.id == rec.id
    assert item.created_at is not None
    assert not hasattr(item, "updated_at") or getattr(item, "updated_at", None) is None


def test_batch_complete_recommendations_by_cow(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    rec1 = Recommendation(
        id=str(uuid4()),
        farm_id=farm.id,
        cow_id=cow.id,
        title="Check feed quality",
        category="Feeding Strategy",
        priority="High",
        recommendation_type="generated",
        owner_id=user.id,
        completed=False,
    )
    rec2 = Recommendation(
        id=str(uuid4()),
        farm_id=farm.id,
        cow_id=cow.id,
        title="Monitor heat stress",
        category="Heat Stress Management",
        priority="Medium",
        recommendation_type="generated",
        owner_id=user.id,
        completed=False,
    )
    db_session.add_all([rec1, rec2])
    db_session.commit()

    from app.api.v1.dairy import batch_complete_recommendations
    from app.schemas.recommendation import BatchCompleteRequest

    res = batch_complete_recommendations(
        BatchCompleteRequest(cow_id=cow.id),
        user_id=user.id,
        db=db_session,
    )
    assert res["success"] is True
    assert res["updated_count"] == 2

    # Verify both recommendations are marked completed
    completed_recs = db_session.query(Recommendation).filter(Recommendation.cow_id == cow.id).all()
    assert len(completed_recs) == 2
    assert all(r.completed is True for r in completed_recs)


def test_generating_new_heat_stress_updates_existing_category_recommendation(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    service = RecommendationService(db_session)

    # First generation with elevated THI (low priority heat stress)
    w1 = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=28.0,
        humidity=65.0,
        thi=72.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(w1)
    db_session.commit()

    recs1 = service.generate_recommendations(user.id, observation_id=obs.id, weather_log_id=w1.id)
    heat_recs1 = [r for r in recs1 if r.category == "Heat Stress Management"]
    assert len(heat_recs1) == 1
    first_rec_id = heat_recs1[0].id
    assert heat_recs1[0].priority == "Low"

    # Second generation with extreme THI (high priority heat stress)
    w2 = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=35.0,
        humidity=80.0,
        thi=80.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(w2)
    db_session.commit()

    recs2 = service.generate_recommendations(user.id, observation_id=obs.id, weather_log_id=w2.id)
    heat_recs2 = [r for r in recs2 if r.category == "Heat Stress Management"]

    # Verify the existing heat stress recommendation was updated rather than duplicated
    all_uncompleted_heat = db_session.query(Recommendation).filter(
        Recommendation.cow_id == cow.id,
        Recommendation.category == "Heat Stress Management",
        Recommendation.completed.is_(False),
    ).all()
    assert len(all_uncompleted_heat) == 1
    assert all_uncompleted_heat[0].id == first_rec_id
    assert all_uncompleted_heat[0].priority == "High"
    assert "Activate emergency" in all_uncompleted_heat[0].title


def test_actionable_recommendation_retires_generic_monitoring(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    service = RecommendationService(db_session)

    # Create baseline monitoring recommendation
    baseline_rec = Recommendation(
        id=str(uuid4()),
        farm_id=farm.id,
        cow_id=cow.id,
        title="Continue monitoring farm conditions",
        category="General Farm Management",
        priority="Low",
        recommendation_type="generated",
        owner_id=user.id,
        completed=False,
    )
    db_session.add(baseline_rec)
    db_session.commit()

    # Now generate an actionable recommendation (e.g. fever alert)
    obs.body_temperature_c = 40.2
    db_session.add(obs)
    db_session.commit()

    service.generate_recommendations(user.id, observation_id=obs.id)

    # Verify baseline is now marked completed
    db_session.refresh(baseline_rec)
    assert baseline_rec.completed is True

    # And veterinary attention recommendation is active
    vet_recs = db_session.query(Recommendation).filter(
        Recommendation.cow_id == cow.id,
        Recommendation.category == "Veterinary Attention",
        Recommendation.completed.is_(False),
    ).all()
    assert len(vet_recs) == 1


