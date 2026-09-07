from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.core.database import get_db
from app.dependencies.auth import get_current_user_id
from app.main import app
from app.models import (
    Cow,
    Farm,
    HealthAlert,
    MilkPrediction,
    Recommendation,
    User,
    WeatherLog,
)


def test_create_and_list_farms_api() -> None:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    test_user_id = str(uuid4())
    session = SessionLocal()
    session.add(User(id=test_user_id, email=f"user+{test_user_id}@example.com", full_name="Test User"))
    session.commit()
    session.close()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user_id() -> str:
        return test_user_id

    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    payload = {
        "name": "Demo Farm",
        "description": "Test farm",
        "location_city": "Pune",
        "location_country": "India",
        "timezone": "Asia/Kolkata",
        "is_active": True,
    }

    response = client.post("/api/v1/farms", json=payload)
    assert response.status_code == 201, response.text

    payload_response = response.json()
    assert payload_response["name"] == payload["name"]
    assert payload_response["timezone"] == payload["timezone"]
    assert payload_response["created_by"] == test_user_id

    list_response = client.get("/api/v1/farms")
    assert list_response.status_code == 200, list_response.text
    assert len(list_response.json()) == 1
    assert list_response.json()[0]["name"] == payload["name"]

    app.dependency_overrides.clear()


def test_dashboard_summary_api_returns_200() -> None:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    test_user_id = str(uuid4())
    session = SessionLocal()
    farm_id = str(uuid4())
    cow_id = str(uuid4())
    alert_id = str(uuid4())
    prediction_id = str(uuid4())
    recommendation_id = str(uuid4())
    weather_id = str(uuid4())

    session.add(User(id=test_user_id, email=f"user+{test_user_id}@example.com", full_name="Test User"))
    session.add(Farm(id=farm_id, name="Demo Farm", timezone="UTC", created_by=test_user_id))
    session.add(
        Cow(
            id=cow_id,
            farm_id=farm_id,
            tag_id="COW1",
            owner_id=test_user_id,
            created_by=test_user_id,
            status="active",
        )
    )
    session.add(
        WeatherLog(
            id=weather_id,
            farm_id=farm_id,
            owner_id=test_user_id,
            temperature=20.0,
            humidity=40.0,
            thi=65.0,
            recorded_at=datetime.now(timezone.utc),
        )
    )
    session.add(
        MilkPrediction(
            id=prediction_id,
            cow_id=cow_id,
            predicted_milk_yield=15.0,
            model_version="v1",
            confidence_score=0.85,
            prediction_timestamp=datetime.now(timezone.utc),
            owner_id=test_user_id,
        )
    )
    session.add(
        HealthAlert(
            id=alert_id,
            cow_id=cow_id,
            farm_id=farm_id,
            alert_level="Warning",
            alert_type="health",
            description="Test alert",
            confidence=0.8,
            owner_id=test_user_id,
        )
    )
    session.add(
        Recommendation(
            id=recommendation_id,
            cow_id=cow_id,
            alert_id=alert_id,
            farm_id=farm_id,
            title="Test recommendation",
            description="Take action",
            category="General",
            priority="Low",
            recommendation_type="manual",
            owner_id=test_user_id,
        )
    )
    session.commit()
    session.close()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user_id() -> str:
        return test_user_id

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    client = TestClient(app)

    response = client.get(f"/api/v1/dashboard/farms/{farm_id}/summary")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["farm"]["id"] == farm_id
    assert data["active_cow_count"] == 1
    assert data["todays_milk_predictions"][0]["cow_id"] == cow_id
    assert data["todays_weather"]["farm_id"] == farm_id
    assert data["active_health_alerts"][0]["id"] == alert_id
    assert data["recent_recommendations"][0]["id"] == recommendation_id

    app.dependency_overrides.clear()


def test_dashboard_trends_api_returns_200() -> None:
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    test_user_id = str(uuid4())
    session = SessionLocal()
    farm_id = str(uuid4())
    cow_id = str(uuid4())
    alert_id = str(uuid4())
    prediction_id = str(uuid4())
    recommendation_id = str(uuid4())
    weather_id = str(uuid4())

    session.add(User(id=test_user_id, email=f"user+{test_user_id}@example.com", full_name="Test User"))
    session.add(Farm(id=farm_id, name="Demo Farm", timezone="UTC", created_by=test_user_id))
    session.add(
        Cow(
            id=cow_id,
            farm_id=farm_id,
            tag_id="COW1",
            owner_id=test_user_id,
            created_by=test_user_id,
            status="active",
        )
    )
    session.add(
        WeatherLog(
            id=weather_id,
            farm_id=farm_id,
            owner_id=test_user_id,
            temperature=20.0,
            humidity=40.0,
            thi=65.0,
            recorded_at=datetime.now(timezone.utc),
        )
    )
    session.add(
        MilkPrediction(
            id=prediction_id,
            cow_id=cow_id,
            predicted_milk_yield=15.0,
            model_version="v1",
            confidence_score=0.85,
            prediction_timestamp=datetime.now(timezone.utc),
            owner_id=test_user_id,
        )
    )
    session.add(
        HealthAlert(
            id=alert_id,
            cow_id=cow_id,
            farm_id=farm_id,
            alert_level="Warning",
            alert_type="health",
            description="Test alert",
            confidence=0.8,
            owner_id=test_user_id,
        )
    )
    session.add(
        Recommendation(
            id=recommendation_id,
            cow_id=cow_id,
            alert_id=alert_id,
            farm_id=farm_id,
            title="Test recommendation",
            description="Take action",
            category="General",
            priority="Low",
            recommendation_type="manual",
            owner_id=test_user_id,
        )
    )
    session.commit()
    session.close()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_get_current_user_id() -> str:
        return test_user_id

    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    response = client.get(f"/api/v1/dashboard/farms/{farm_id}/trends")
    assert response.status_code == 200, response.text
    data = response.json()
    assert "milk_yield_trends" in data
    assert "weather_trends" in data
    assert "health_alert_trends" in data
    assert "recommendation_category_distribution" in data
    assert "health_alert_distribution" in data
    assert "cow_health_status_distribution" in data
    assert data["recommendation_category_distribution"][0]["category"] == "General"
    assert data["health_alert_distribution"][0]["category"] == "Warning"
    assert data["cow_health_status_distribution"][0]["category"] == "active"

    app.dependency_overrides.clear()
