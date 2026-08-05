from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import (
    Cow,
    DailyObservation,
    Farm,
    HealthAlert,
    MilkPrediction,
    Recommendation,
    User,
    WeatherLog,
)
from app.services.dashboard_service import DashboardService


def _create_owner_entities(session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"u{user_id}@example.com", full_name="Dashboard User")
    session.add(user)
    session.flush()
    farm = Farm(id=str(uuid4()), name="Dashboard Farm", timezone="UTC", created_by=user.id)
    session.add(farm)
    session.flush()
    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="DASH1",
        owner_id=user.id,
        created_by=user.id,
        birth_date=date.today(),
        weight_kg=450.0,
    )
    session.add(cow)
    session.flush()
    observation = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_date=date.today(),
        owner_id=user.id,
    )
    session.add(observation)
    session.commit()
    return user, farm, cow, observation


def test_dashboard_summary_empty_farm(db_session: Session):
    user, farm, _, _ = _create_owner_entities(db_session)
    service = DashboardService(db_session)

    summary = service.get_dashboard_summary(user.id, farm.id)

    assert summary["farm"].id == farm.id
    assert summary["active_cow_count"] == 1
    assert summary["herd_summary"] == [{"status": "active", "count": 1}]
    assert summary["todays_milk_predictions"] == []
    assert summary["average_predicted_milk_yield"] == 0.0
    assert summary["todays_weather"] is None
    assert summary["active_health_alerts"] == []
    assert summary["recent_recommendations"] == []
    assert len(summary["recent_observations"]) == 1


def test_dashboard_summary_populated_farm(db_session: Session):
    user, farm, cow, observation = _create_owner_entities(db_session)
    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=22.5,
        humidity=55.0,
        thi=68.0,
        recorded_at=datetime.now(timezone.utc),
    )
    prediction = MilkPrediction(
        id=str(uuid4()),
        cow_id=cow.id,
        predicted_milk_yield=20.0,
        model_version="v1",
        confidence_score=0.92,
        prediction_timestamp=datetime.now(timezone.utc),
        owner_id=user.id,
    )
    alert = HealthAlert(
        id=str(uuid4()),
        cow_id=cow.id,
        farm_id=farm.id,
        alert_level="Warning",
        alert_type="heat",
        description="Heat risk",
        confidence=0.75,
        owner_id=user.id,
    )
    recommendation = Recommendation(
        id=str(uuid4()),
        cow_id=cow.id,
        alert_id=alert.id,
        farm_id=farm.id,
        title="Check water",
        description="Provide extra water.",
        category="Heat Stress Management",
        priority="Medium",
        recommendation_type="generated",
        owner_id=user.id,
    )
    db_session.add_all([weather, prediction, alert, recommendation])
    db_session.commit()

    service = DashboardService(db_session)
    summary = service.get_dashboard_summary(user.id, farm.id)

    assert summary["active_cow_count"] == 1
    assert summary["todays_weather"].id == weather.id
    assert summary["active_health_alerts"][0].id == alert.id
    assert summary["recent_recommendations"][0].id == recommendation.id
    assert summary["average_predicted_milk_yield"] == 20.0
    assert summary["todays_milk_predictions"][0].id == prediction.id


def test_dashboard_trends_and_observation_history(db_session: Session):
    user, farm, cow, observation = _create_owner_entities(db_session)
    db_session.add_all([
        WeatherLog(
            id=str(uuid4()),
            farm_id=farm.id,
            owner_id=user.id,
            temperature=20.0,
            humidity=50.0,
            thi=65.0,
            recorded_at=datetime.now(timezone.utc),
        ),
        MilkPrediction(
            id=str(uuid4()),
            cow_id=cow.id,
            predicted_milk_yield=18.0,
            model_version="v1",
            confidence_score=0.85,
            prediction_timestamp=datetime.now(timezone.utc),
            owner_id=user.id,
        ),
        HealthAlert(
            id=str(uuid4()),
            cow_id=cow.id,
            farm_id=farm.id,
            alert_level="Warning",
            alert_type="health",
            description="Mild alert",
            confidence=0.7,
            owner_id=user.id,
        ),
    ])
    db_session.commit()

    service = DashboardService(db_session)
    milk_trends = service.get_milk_yield_trends(user.id, farm.id)
    alert_trends = service.get_health_alert_trends(user.id, farm.id)
    weather_trends = service.get_weather_trends(user.id, farm.id)
    observations = service.get_observation_history(user.id, farm.id)

    assert milk_trends
    assert alert_trends
    assert weather_trends
    assert observations[0]["cow_id"] == cow.id


def test_dashboard_invalid_ownership(db_session: Session):
    user, farm, _, _ = _create_owner_entities(db_session)
    other_user_id = str(uuid4())
    other_user = User(id=other_user_id, email=f"u{other_user_id}@example.com", full_name="Other User")
    db_session.add(other_user)
    db_session.commit()

    service = DashboardService(db_session)
    try:
        service.get_dashboard_summary(other_user.id, farm.id)
        assert False, "Expected PermissionError"
    except PermissionError:
        assert True
