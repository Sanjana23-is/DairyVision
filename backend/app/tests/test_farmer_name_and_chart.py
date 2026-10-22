from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.dependencies.auth import get_current_user_id
from app.main import app
from app.models import Cow, DailyObservation, Farm, MilkPrediction, User
from app.services.auth_service import AuthService
from app.services.dashboard_service import DashboardService


@pytest.fixture
def test_db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionTesting()
    try:
        yield session
    finally:
        session.close()


def test_auth_fallback_to_farmer_when_name_missing_or_email(test_db_session: Session):
    auth_service = AuthService(db=test_db_session)
    user_id = str(uuid4())
    email = "testfarmer@dairyvision.ai"

    # User object with email as full_name
    class MockUser:
        id = user_id
        email = "testfarmer@dairyvision.ai"
        user_metadata = {}

    auth_service._sync_local_user(MockUser(), full_name=None)
    db_user = test_db_session.query(User).filter(User.id == user_id).first()
    assert db_user is not None
    # Must fallback to Farmer, never email
    assert db_user.full_name == "Farmer"

    auth_user = auth_service._build_auth_user(MockUser())
    assert auth_user.full_name == "Farmer"

    # Update profile to real farmer name
    updated = auth_service.update_profile(user_id, "Sanjana Patel")
    assert updated.full_name == "Sanjana Patel"

    db_user_updated = test_db_session.query(User).filter(User.id == user_id).first()
    assert db_user_updated.full_name == "Sanjana Patel"


def test_create_farm_persists_farmer_name(test_db_session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email="farmer1@example.com", full_name="Farmer")
    test_db_session.add(user)
    test_db_session.commit()

    def override_get_db():
        yield test_db_session

    def override_get_current_user_id() -> str:
        return user_id

    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    res = client.post(
        "/api/v1/farms",
        json={
            "name": "Green Valley Farm",
            "farmer_name": "Ramesh Kumar",
            "location_city": "Mysuru",
        },
    )
    assert res.status_code == 201, res.text
    farm_data = res.json()
    assert farm_data["name"] == "Green Valley Farm"
    assert farm_data["created_by"] == user_id

    # Verify user's full_name in DB was updated to the farmer's name
    test_db_session.refresh(user)
    assert user.full_name == "Ramesh Kumar"

    app.dependency_overrides.clear()


def test_dashboard_trends_observation_alignment_and_baseline(test_db_session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email="chart_tester@dairyvision.ai", full_name="Chart Tester")
    test_db_session.add(user)
    test_db_session.flush()

    farm = Farm(id=str(uuid4()), name="Yield Test Farm", timezone="UTC", created_by=user_id)
    test_db_session.add(farm)
    test_db_session.flush()

    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="YIELD1", owner_id=user_id, created_by=user_id)
    test_db_session.add(cow)
    test_db_session.flush()

    # Seed observations for 5 days: Day 1 to 5
    base_date = date.today() - timedelta(days=5)
    obs_list = []
    for i in range(5):
        d = base_date + timedelta(days=i)
        obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            observation_date=d,
            milk_produced_liters=15.0 + i,
            owner_id=user_id,
        )
        obs_list.append(obs)
        test_db_session.add(obs)
    test_db_session.flush()

    # Add a model prediction only for the latest day (Day 5)
    latest_obs = obs_list[-1]
    pred = MilkPrediction(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_id=latest_obs.id,
        predicted_milk_yield=19.5,
        model_version="best_model.pkl",
        confidence_score=0.92,
        prediction_timestamp=datetime.now(timezone.utc),
        owner_id=user_id,
    )
    test_db_session.add(pred)
    test_db_session.commit()

    service = DashboardService(test_db_session)
    obs_trends = service.get_observation_trends(user_id, farm.id, days=10)
    milk_trends = service.get_milk_yield_trends(user_id, farm.id, days=10)

    # 1. Observation trends must have 5 points
    assert len(obs_trends) == 5
    assert len(milk_trends) == 5

    # 2. Dates must match exactly
    obs_dates = [o["date"] for o in obs_trends]
    pred_dates = [m["date"] for m in milk_trends]
    assert obs_dates == pred_dates

    # 3. Latest day has model_prediction
    latest_trend = milk_trends[-1]
    assert latest_trend["target_type"] == "model_prediction"
    assert latest_trend["total_predicted_milk_yield"] == 19.5
    assert latest_trend["prediction_count"] == 1

    # 4. Earlier days have baseline (or None for day 1 if 0 prior observations)
    # Day 1: 0 prior observations, so baseline is None (gap)
    first_trend = milk_trends[0]
    assert first_trend["target_type"] is None
    assert first_trend["expected_yield"] is None

    # Day 4: has 3 prior observations (Days 1, 2, 3), so baseline exists
    day4_trend = milk_trends[3]
    assert day4_trend["target_type"] == "baseline"
    assert day4_trend["expected_yield"] is not None
    assert day4_trend["prediction_count"] == 0
