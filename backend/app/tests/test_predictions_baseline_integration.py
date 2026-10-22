from datetime import date, datetime, timedelta, timezone
from uuid import uuid4
import pytest
from sqlalchemy.orm import Session

from app.models import User, Farm, Cow, DailyObservation, WeatherLog, MilkPrediction
from app.services.prediction_service import PredictionService
from app.api.v1.predictions import get_cow_baseline


def _create_integration_fixtures(session: Session, num_history: int = 5):
    user_id = str(uuid4())
    user = User(id=user_id, email=f"integ_{user_id}@example.com", full_name="Integration User")
    session.add(user)
    session.flush()

    farm = Farm(id=str(uuid4()), name="Integ Farm", created_by=user.id, latitude=12.97, longitude=77.59)
    session.add(farm)
    session.flush()

    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="INT-COW-1", owner_id=user.id, created_by=user.id, age_months=48, weight_kg=500.0)
    session.add(cow)
    session.flush()

    today = date(2026, 10, 15)

    # Historical observations
    for i in range(1, num_history + 1):
        h_obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            owner_id=user.id,
            observation_date=today - timedelta(days=i),
            milk_produced_liters=18.0 + (i % 3) * 0.5,
            feed_quantity_kg=20.0,
        )
        session.add(h_obs)

    # Weather
    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=25.0,
        humidity=60.0,
        thi=70.0,
        recorded_at=datetime.now(timezone.utc),
    )
    session.add(weather)
    session.flush()

    # Target observation
    cur_obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=today,
        milk_produced_liters=10.0,  # Drop from ~18 L
        feed_quantity_kg=20.0,
        weather_log_id=weather.id,
    )
    session.add(cur_obs)
    session.commit()

    return user, farm, cow, cur_obs


def test_predict_for_observation_enriches_baseline_and_anomaly(db_session: Session):
    user, farm, cow, cur_obs = _create_integration_fixtures(db_session, num_history=5)
    svc = PredictionService(db_session)

    pred = svc.predict_for_observation(user.id, cur_obs.id)

    assert isinstance(pred, MilkPrediction)
    assert getattr(pred, "expected_baseline") is not None
    assert getattr(pred, "expected_baseline") >= 18.0
    assert getattr(pred, "actual_yield") == 10.0
    assert getattr(pred, "drop_liters") is not None
    assert getattr(pred, "drop_liters") >= 8.0  # ~18 - 10 = 8 L
    assert getattr(pred, "drop_percentage") is not None
    assert getattr(pred, "drop_percentage") > 40.0
    assert getattr(pred, "anomaly_status") == "unusual_drop"
    assert getattr(pred, "observations_used") == 5
    assert getattr(pred, "baseline_status") == "established_baseline"
    assert "substantially below recent baseline" in getattr(pred, "alert_explanation")
    assert "feed, water access" in getattr(pred, "recommended_action")


def test_cow_baseline_summary_method(db_session: Session):
    user, farm, cow, cur_obs = _create_integration_fixtures(db_session, num_history=4)
    svc = PredictionService(db_session)

    summary = svc.get_cow_baseline_summary(cow.id, cur_obs.observation_date)

    assert summary["cow_id"] == cow.id
    assert summary["baseline_status"] == "established_baseline"
    assert summary["observations_used"] == 4
    assert summary["expected_baseline"] is not None
    assert len(summary["observations_history"]) == 4
    assert summary["has_today_observation"] is True
    assert summary["actual_yield"] == 10.0  # cur_obs yield in fixture is 10.0
    assert summary["drop_liters"] is not None
    assert summary["anomaly_status"] == "unusual_drop"


def test_get_cow_baseline_api_endpoint(db_session: Session):
    user, farm, cow, cur_obs = _create_integration_fixtures(db_session, num_history=3)
    svc = PredictionService(db_session)

    res = get_cow_baseline(cow_id=cow.id, target_date=cur_obs.observation_date.isoformat(), user_id=user.id, service=svc)

    assert res["cow_id"] == cow.id
    assert res["baseline_status"] == "established_baseline"
    assert res["observations_used"] == 3
    assert res["expected_baseline"] is not None
    assert res["has_today_observation"] is True
    assert res["actual_yield"] == 10.0


def test_cow_baseline_summary_missing_today_observation(db_session: Session):
    from datetime import date, timedelta
    user, farm, cow, cur_obs = _create_integration_fixtures(db_session, num_history=4)
    svc = PredictionService(db_session)

    # Query for a future date where no observation has been logged
    future_date = cur_obs.observation_date + timedelta(days=5)
    summary = svc.get_cow_baseline_summary(cow.id, future_date)

    assert summary["cow_id"] == cow.id
    assert summary["has_today_observation"] is False
    assert summary["actual_yield"] is None
    assert summary["anomaly_status"] == "missing_observation"
    assert "No milk yield recorded" in summary["alert_explanation"]
    # Baseline is still calculated from prior history!
    assert summary["expected_baseline"] is not None
    assert summary["baseline_status"] == "established_baseline"


def test_predict_no_fallback_to_zero_raises_explicit_error(db_session: Session, tmp_path):
    """Point 1: Neither valid baseline nor ML prediction must raise explicit error instead of fabricating 0.0 L."""
    from app.exceptions import PredictionValidationError

    user_id = str(uuid4())
    user = User(id=user_id, email=f"err_{user_id}@example.com", full_name="Err User")
    db_session.add(user)
    db_session.flush()

    farm = Farm(id=str(uuid4()), name="Err Farm", created_by=user.id, latitude=12.97, longitude=77.59)
    db_session.add(farm)
    db_session.flush()

    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="ERR-COW", owner_id=user.id, created_by=user.id, age_months=48, weight_kg=500.0)
    db_session.add(cow)
    db_session.flush()

    # Observation with NO prior history and NO weather log (will fail feature extraction and ML)
    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=date.today(),
        milk_produced_liters=15.0,
        feed_quantity_kg=20.0,
        weather_log_id=None,
    )
    db_session.add(obs)
    db_session.commit()

    # Use a dummy model path that does not exist or forces failure
    svc = PredictionService(db_session, model_path=str(tmp_path / "nonexistent.pkl"))

    # Must raise PredictionValidationError, NEVER return a fabricated predicted_milk_yield=0.0
    with pytest.raises(PredictionValidationError) as exc_info:
        svc.predict_for_observation(user.id, obs.id)

    assert "missing required weather data" in str(exc_info.value) or "Cannot generate milk yield estimation" in str(exc_info.value)

    # Ensure zero record was written to DB
    zero_pred = db_session.query(MilkPrediction).filter(MilkPrediction.observation_id == obs.id).first()
    assert zero_pred is None


def test_confidence_interval_for_baseline_vs_provisional(db_session: Session):
    """Point 2: Confidence interval must be calibrated from empirical variability or marked limited_data."""
    user, farm, cow, cur_obs = _create_integration_fixtures(db_session, num_history=5)
    svc = PredictionService(db_session)

    pred = svc.predict_for_observation(user.id, cur_obs.id)
    # Established baseline -> historical empirical variability
    assert getattr(pred, "confidence_data_status") == "historical"
    assert getattr(pred, "confidence_lower") <= pred.predicted_milk_yield <= getattr(pred, "confidence_upper")
    assert 0.50 <= pred.confidence_score <= 0.99

    # Now test provisional baseline with only 1 prior observation
    user2, farm2, cow2, cur_obs2 = _create_integration_fixtures(db_session, num_history=1)
    pred2 = svc.predict_for_observation(user2.id, cur_obs2.id)
    assert getattr(pred2, "confidence_data_status") == "limited_data"
    assert getattr(pred2, "confidence_lower") <= pred2.predicted_milk_yield <= getattr(pred2, "confidence_upper")


def test_get_cow_baseline_summary_invalid_timezone_fallback(db_session: Session):
    """Point 3: Invalid farm timezone falls back cleanly to UTC without crashing."""
    user, farm, cow, cur_obs = _create_integration_fixtures(db_session, num_history=3)
    farm.timezone = "Invalid/Malformed_Zone_Name"
    db_session.commit()

    svc = PredictionService(db_session)
    # Call with target_date=None to trigger timezone lookup
    summary = svc.get_cow_baseline_summary(cow.id, target_date=None)
    assert summary["target_date"] is not None
    # Must match UTC date format YYYY-MM-DD
    assert len(summary["target_date"]) == 10


def test_get_cow_baseline_summary_duplicate_target_observations(db_session: Session):
    """Point 4: Duplicate observations on target date prioritize latest valid entry and do not sum."""
    user, farm, cow, cur_obs = _create_integration_fixtures(db_session, num_history=3)

    # Add duplicate observation on the same target date with a different yield
    duplicate_obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=cur_obs.observation_date,
        milk_produced_liters=14.0,
        feed_quantity_kg=20.0,
        created_at=datetime.now(timezone.utc) + timedelta(minutes=5),  # Newer
    )
    db_session.add(duplicate_obs)
    db_session.commit()

    svc = PredictionService(db_session)
    summary = svc.get_cow_baseline_summary(cow.id, cur_obs.observation_date)

    # Must prioritize latest created valid entry (14.0), NEVER sum them (10.0 + 14.0 = 24.0 would be false)
    assert summary["actual_yield"] == 14.0
    # Must record duplicate observation warning in data_quality_warnings
    assert any("Duplicate observation detected for target date" in w for w in summary["data_quality_warnings"])


def test_insufficient_history_never_invents_personalized_baseline(db_session: Session):
    """Point 5: Insufficient history must never produce a fabricated baseline."""
    user_id = str(uuid4())
    user = User(id=user_id, email=f"cold_{user_id}@example.com", full_name="Cold Start User")
    db_session.add(user)
    db_session.flush()

    farm = Farm(id=str(uuid4()), name="Cold Farm", created_by=user.id, latitude=12.97, longitude=77.59)
    db_session.add(farm)
    db_session.flush()

    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="COLD-1", owner_id=user.id, created_by=user.id, age_months=36, weight_kg=480.0)
    db_session.add(cow)
    db_session.flush()

    # Zero prior history
    target_date = date(2026, 10, 20)
    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        owner_id=user.id,
        observation_date=target_date,
        milk_produced_liters=16.0,
    )
    db_session.add(obs)
    db_session.commit()

    svc = PredictionService(db_session)
    summary = svc.get_cow_baseline_summary(cow.id, target_date)

    assert summary["baseline_status"] == "insufficient_history"
    assert summary["expected_baseline"] is None
    assert summary["observations_used"] == 0
    assert summary["anomaly_status"] == "insufficient_history"
    assert summary["drop_liters"] is None
    assert summary["drop_percentage"] is None
