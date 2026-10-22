from uuid import uuid4
from datetime import datetime, date, timezone

import joblib
import os

from sqlalchemy.orm import Session

from app.services.prediction_service import PredictionService
from app.services.feature_engineering_service import FeatureEngineeringService
from app.exceptions import PredictionNotFound, PredictionValidationError
from app.models import User, Farm, Cow, DailyObservation, WeatherLog, MilkPrediction


def _create_owner_entities(session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f'u{user_id}@example.com', full_name='Pred Test')
    session.add(user); session.flush()
    farm = Farm(id=str(uuid4()), name='Pred Farm', timezone='UTC', created_by=user.id, latitude=0.0, longitude=0.0)
    session.add(farm); session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='T1', owner_id=user.id, created_by=user.id, age_months=48, weight_kg=500.0)

    session.add(cow); session.flush()
    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=25.0,
        humidity=60.0,
        thi=70.0,
        recorded_at=datetime.now(timezone.utc),
    )
    session.add(weather); session.flush()
    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_date=date.today(),
        owner_id=user.id,
        feed_quantity_kg=20.0,
        weather_log_id=weather.id,
    )
    session.add(obs)
    session.commit()
    return user, farm, cow, obs


def test_successful_prediction(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    # create a mock model file
    from sklearn.dummy import DummyRegressor
    import joblib
    model = DummyRegressor(strategy='mean')
    import numpy as np
    X = np.zeros((2, len([])))
    y = np.array([1.0, 2.0])
    model.fit(X, y)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)

    svc = PredictionService(db_session, model_path=str(model_path))
    saved = svc.predict_for_observation(user.id, obs.id)
    assert isinstance(saved, MilkPrediction)
    assert saved.owner_id == user.id


def test_invalid_ownership(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    other_id = str(uuid4())
    from sklearn.dummy import DummyRegressor
    import joblib
    model = DummyRegressor(strategy='mean')
    import numpy as np
    X = np.zeros((2, 0))
    y = np.array([1.0, 2.0])
    model.fit(X, y)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)

    svc = PredictionService(db_session, model_path=str(model_path))
    try:
        svc.predict_for_observation(other_id, obs.id)
        assert False
    except PermissionError:
        pass


def test_missing_observation(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    from sklearn.dummy import DummyRegressor
    import joblib
    model = DummyRegressor(strategy='mean')
    import numpy as np
    X = np.zeros((2, 0))
    y = np.array([1.0, 2.0])
    model.fit(X, y)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)

    svc = PredictionService(db_session, model_path=str(model_path))
    try:
        svc.predict_for_observation(user.id, 'non-existent')
        assert False
    except PredictionNotFound:
        pass


def test_prediction_persistence(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    from sklearn.dummy import DummyRegressor
    import joblib
    model = DummyRegressor(strategy='mean')
    import numpy as np
    X = np.zeros((2, 0))
    y = np.array([1.0, 2.0])
    model.fit(X, y)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)

    svc = PredictionService(db_session, model_path=str(model_path))
    saved = svc.predict_for_observation(user.id, obs.id)
    # Query DB to ensure persisted
    reloaded = db_session.get(MilkPrediction, saved.id)
    assert reloaded is not None


def test_health_status_healthy_condition_maps_to_zero(db_session: Session):
    # Matches training-time encoding in data_loader.py:
    # health_status = (Disease_Status != "Healthy").astype(int)
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.symptoms = {"condition": "healthy"}
    db_session.add(obs)
    db_session.commit()

    fv = FeatureEngineeringService(db_session).build_features_for_observation(user.id, obs.id)
    assert fv.health_status == 0


def test_health_status_non_healthy_condition_maps_to_one(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.symptoms = {"condition": "abnormal"}
    db_session.add(obs)
    db_session.commit()

    fv = FeatureEngineeringService(db_session).build_features_for_observation(user.id, obs.id)
    assert fv.health_status == 1


def test_health_status_slightly_abnormal_condition_maps_to_one(db_session: Session):
    # Confirms no 3-way encoding: slightly_abnormal must map to 1, same as abnormal
    user, farm, cow, obs = _create_owner_entities(db_session)
    obs.symptoms = {"condition": "slightly_abnormal"}
    db_session.add(obs)
    db_session.commit()

    fv = FeatureEngineeringService(db_session).build_features_for_observation(user.id, obs.id)
    assert fv.health_status == 1


def test_health_status_no_symptoms_recorded_maps_to_zero(db_session: Session):
    # No symptoms recorded at all should not be treated as "diseased"
    user, farm, cow, obs = _create_owner_entities(db_session)
    # obs.symptoms left unset (None) by _create_owner_entities

    fv = FeatureEngineeringService(db_session).build_features_for_observation(user.id, obs.id)
    assert fv.health_status == 0


# --- Route-level tests: verify create_prediction maps exceptions to the
# correct HTTP status codes, not just that the right Python exception is
# raised by the service layer. ---


class _FakeModel:
    """Tiny picklable model. If predict_fn is given, raises whatever it
    raises when .predict() is called, letting tests simulate a model/sklearn
    -side failure independent of our own feature-completeness validation.
    Must live at module level -- joblib/pickle cannot serialize a class
    defined inside a function."""

    def __init__(self, predict_fn=None):
        self._fn = predict_fn

    def predict(self, X):
        if self._fn is not None:
            return self._fn(X)
        return [1.0]


def _make_dummy_model_path(tmp_path, predict_fn=None):
    import joblib

    model = _FakeModel(predict_fn)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)
    return str(model_path)


def _raise_nan_value_error(_X):
    raise ValueError("Input X contains NaN. LinearRegression does not accept missing values.")


def test_route_missing_observation_returns_404(db_session: Session, tmp_path):
    from fastapi import HTTPException
    from app.api.v1.predictions import create_prediction
    from app.schemas.feature import FeatureVector

    user, farm, cow, obs = _create_owner_entities(db_session)
    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    payload = FeatureVector(observation_id='non-existent')
    try:
        create_prediction(payload, user.id, service)
        assert False, "expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 404


def test_route_missing_feature_returns_422_and_names_it(db_session: Session, tmp_path):
    from fastapi import HTTPException
    from app.api.v1.predictions import create_prediction
    from app.schemas.feature import FeatureVector

    user_id = str(uuid4())
    user = User(id=user_id, email=f'u{user_id}@example.com', full_name='Incomplete Obs Test')
    db_session.add(user); db_session.flush()
    farm = Farm(id=str(uuid4()), name='Incomplete Farm', timezone='UTC', created_by=user.id, latitude=0.0, longitude=0.0)
    db_session.add(farm); db_session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='T-INC', owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=500.0)
    db_session.add(cow); db_session.flush()
    # Deliberately incomplete: no feed_quantity_kg, no weather_log_id, matching
    # an observation created without the optional feed/weather data.
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id)
    db_session.add(obs)
    db_session.commit()

    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    payload = FeatureVector(observation_id=obs.id)
    try:
        create_prediction(payload, user.id, service)
        assert False, "expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 422
        # The missing feature(s) must be named, not silently imputed.
        assert 'feed' in exc.detail or 'temperature' in exc.detail or 'thi' in exc.detail


def test_route_model_valueerror_returns_422_not_404(db_session: Session, tmp_path):
    # Confirms a ValueError raised by the model/sklearn itself (e.g. the real
    # "Input X contains NaN" case) is never mapped to 404, even though our
    # own feature-completeness validation (Fix 2) already prevents NaN from
    # reaching the model in practice. This uses complete feature data, so
    # the ValueError can only be coming from the model call itself.
    from fastapi import HTTPException
    from app.api.v1.predictions import create_prediction
    from app.schemas.feature import FeatureVector

    user, farm, cow, obs = _create_owner_entities(db_session)

    model_path = _make_dummy_model_path(tmp_path, predict_fn=_raise_nan_value_error)
    service = PredictionService(db_session, model_path=model_path)

    payload = FeatureVector(observation_id=obs.id)
    try:
        create_prediction(payload, user.id, service)
        assert False, "expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 422
        assert exc.status_code != 404


def test_route_successful_prediction(db_session: Session, tmp_path):
    from app.api.v1.predictions import create_prediction
    from app.schemas.feature import FeatureVector

    user, farm, cow, obs = _create_owner_entities(db_session)
    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    payload = FeatureVector(observation_id=obs.id)
    saved = create_prediction(payload, user.id, service)
    assert isinstance(saved, MilkPrediction)
    assert saved.owner_id == user.id


def test_route_missing_weather_explains_coordinates_required(db_session: Session, tmp_path):
    from fastapi import HTTPException
    from app.api.v1.predictions import create_prediction
    from app.schemas.feature import FeatureVector

    user_id = str(uuid4())
    user = User(id=user_id, email=f"u{user_id}@example.com", full_name="No Weather Test")
    db_session.add(user)
    db_session.flush()
    farm = Farm(id=str(uuid4()), name="No Weather Farm", timezone="UTC", created_by=user.id, latitude=None, longitude=None)
    db_session.add(farm)
    db_session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id="T-NOWX", owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=500.0)
    db_session.add(cow)
    db_session.flush()
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id, feed_quantity_kg=20.0, weather_log_id=None)
    db_session.add(obs)
    db_session.commit()

    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    payload = FeatureVector(observation_id=obs.id)
    try:
        create_prediction(payload, user.id, service)
        assert False, "expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 422
        assert "missing required weather data" in exc.detail
        assert "latitude and longitude" in exc.detail


def test_prediction_confidence_intervals_limited_data(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    saved = service.predict_for_observation(user.id, obs.id)
    assert saved.confidence_score is not None
    assert getattr(saved, "confidence_data_status") == "limited_data"
    assert getattr(saved, "confidence_lower") >= 0.0
    assert getattr(saved, "confidence_lower") <= saved.predicted_milk_yield <= getattr(saved, "confidence_upper")


def test_prediction_confidence_intervals_historical_data(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)

    # Seed 3 historical predictions with matching observations
    for i in range(3):
        h_obs = DailyObservation(
            id=str(uuid4()),
            cow_id=cow.id,
            observation_date=date.today(),
            owner_id=user.id,
            milk_produced_liters=20.0 + i,
            feed_quantity_kg=20.0,
        )
        db_session.add(h_obs)
        db_session.flush()

        h_pred = MilkPrediction(
            id=str(uuid4()),
            cow_id=cow.id,
            observation_id=h_obs.id,
            predicted_milk_yield=19.5 + i,
            confidence_score=0.85,
            model_version="test",
            owner_id=user.id,
            prediction_timestamp=datetime.now(timezone.utc),
        )
        db_session.add(h_pred)
    db_session.commit()

    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    saved = service.predict_for_observation(user.id, obs.id)
    assert saved.confidence_score is not None
    assert getattr(saved, "confidence_data_status") == "historical"
    assert getattr(saved, "confidence_lower") >= 0.0
    assert getattr(saved, "confidence_lower") <= saved.predicted_milk_yield <= getattr(saved, "confidence_upper")
    assert 0.50 <= saved.confidence_score <= 0.99


def test_list_milk_predictions_endpoint_serialization(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    saved = service.predict_for_observation(user.id, obs.id)

    from app.api.v1.dairy import list_milk_predictions
    from app.services.crud_service import CRUDService
    from app.schemas.crud import MilkPredictionResponse
    crud = CRUDService(db_session)

    orm_list = list_milk_predictions(farm_id=farm.id, user_id=user.id, service=crud, db=db_session)
    assert len(orm_list) >= 1
    pydantic_item = MilkPredictionResponse.model_validate(orm_list[0])
    assert pydantic_item.id == saved.id
    assert pydantic_item.prediction_timestamp is not None
    assert pydantic_item.created_at is not None
    assert pydantic_item.confidence_score is not None
    assert pydantic_item.confidence_data_status is not None


def test_prediction_auto_fetches_historical_weather_for_observation(db_session: Session, tmp_path):
    """
    Regression test: Verifies that when an observation has no weather log,
    predict_for_observation automatically retrieves weather for the observation date
    using the farm's coordinates, calculates THI via the scientific utility, and
    successfully generates the milk yield prediction.
    """
    from unittest.mock import MagicMock, patch
    from app.services.weather_provider import WeatherProvider, WeatherSnapshot
    from app.services.weather_service import WeatherService
    from app.core.scientific import calculate_thi

    user_id = str(uuid4())
    user = User(id=user_id, email=f"u{user_id}@example.com", full_name="Lakshmi Test User")
    db_session.add(user)
    db_session.flush()

    farm = Farm(
        id=str(uuid4()),
        name="Luna Dairy Farm",
        location_city="Bengaluru",
        location_country="India",
        timezone="UTC",
        created_by=user.id,
        latitude=12.9716,
        longitude=77.5946,
    )
    db_session.add(farm)
    db_session.flush()

    cow = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="COW-LAKSHMI-01",
        name="Lakshmi",
        owner_id=user.id,
        created_by=user.id,
        birth_date=date(2022, 1, 1),
        weight_kg=520.0,
    )
    db_session.add(cow)
    db_session.flush()

    # Historical observation on 26 September 2026 without a weather log
    obs_date = date(2026, 9, 26)
    obs = DailyObservation(
        id=str(uuid4()),
        cow_id=cow.id,
        observation_date=obs_date,
        owner_id=user.id,
        feed_quantity_kg=22.0,
        milk_produced_liters=18.5,
        weather_log_id=None,
    )
    db_session.add(obs)
    db_session.commit()

    model_path = _make_dummy_model_path(tmp_path)
    service = PredictionService(db_session, model_path=model_path)

    # Mock WeatherProvider to simulate Open-Meteo response on 2026-09-26
    mock_provider = MagicMock(spec=WeatherProvider)
    mock_provider.fetch_snapshot.return_value = WeatherSnapshot(
        temperature=27.5,
        humidity=52.0,
        rainfall=0.0,
        wind_speed=6.8,
        pressure=911.8,
        cloud_cover=34.0,
    )

    with patch("app.services.weather_service.OpenMeteoWeatherProvider", return_value=mock_provider):
        pred = service.predict_for_observation(user.id, obs.id)

    # 1. Prediction must succeed
    assert pred is not None
    assert pred.predicted_milk_yield is not None
    assert pred.observation_id == obs.id

    # 2. Observation must be linked to newly created weather log
    db_session.refresh(obs)
    assert obs.weather_log_id is not None

    # 3. Weather log must have exact values and scientifically calculated THI
    wl = db_session.get(WeatherLog, obs.weather_log_id)
    assert wl is not None
    assert float(wl.temperature) == 27.5
    assert float(wl.humidity) == 52.0
    expected_thi = calculate_thi(27.5, 52.0)
    assert abs(float(wl.thi) - expected_thi) < 0.01


_captured_spy_inputs = []


class _SpyModel:
    def __init__(self):
        from ml_engine.config import ALL_FEATURES
        self.feature_names_in_ = ALL_FEATURES

    def predict(self, X):
        _captured_spy_inputs.append(X)
        import numpy as np
        return np.array([16.5])


def test_inference_feature_vector_age_unit_conversion_12_and_48_months(db_session: Session, tmp_path):
    """
    Regression test:
    Proves that cow ages of 12 months and 48 months (stored in Cow.age_months and
    converted to 1.0 and 4.0 years on FeatureVector.age by FeatureEngineeringService)
    reach model inference as exactly 12.0 and 48.0 months respectively, with
    matching age-to-weight ratios (age_months / weight), NOT the years-based ratio.
    """
    import pandas as pd

    _captured_spy_inputs.clear()

    user_id = str(uuid4())
    user = User(id=user_id, email=f"u_{user_id[:8]}@example.com", full_name="Age Unit Test")
    db_session.add(user)
    db_session.flush()

    farm = Farm(id=str(uuid4()), name="Age Farm", timezone="UTC", created_by=user.id, latitude=12.97, longitude=77.59)
    db_session.add(farm)
    db_session.flush()

    # Cow A: 12 months, 400.0 kg
    cow_12m = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="COW-12M",
        owner_id=user.id,
        created_by=user.id,
        age_months=12,
        weight_kg=400.0,
    )
    # Cow B: 48 months, 500.0 kg
    cow_48m = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="COW-48M",
        owner_id=user.id,
        created_by=user.id,
        age_months=48,
        weight_kg=500.0,
    )
    db_session.add_all([cow_12m, cow_48m])
    db_session.flush()

    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=24.0,
        humidity=50.0,
        thi=68.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.flush()

    obs_12m = DailyObservation(
        id=str(uuid4()),
        cow_id=cow_12m.id,
        observation_date=date.today(),
        owner_id=user.id,
        feed_quantity_kg=18.0,
        weather_log_id=weather.id,
    )
    obs_48m = DailyObservation(
        id=str(uuid4()),
        cow_id=cow_48m.id,
        observation_date=date.today(),
        owner_id=user.id,
        feed_quantity_kg=22.0,
        weather_log_id=weather.id,
    )
    db_session.add_all([obs_12m, obs_48m])
    db_session.commit()

    model_path = tmp_path / "spy_model.pkl"
    joblib.dump(_SpyModel(), model_path)

    service = PredictionService(db_session, model_path=str(model_path))

    # --- Run inference for Cow A (12 months) ---
    pred_12m = service.predict_for_observation(user.id, obs_12m.id)
    assert pred_12m is not None
    assert len(_captured_spy_inputs) == 1

    x_12 = _captured_spy_inputs[0]
    assert isinstance(x_12, pd.DataFrame)
    age_12 = float(x_12["age"].iloc[0])
    ratio_12 = float(x_12["age_weight_ratio"].iloc[0])

    assert age_12 == 12.0, f"Expected inference age to be 12.0 months, got {age_12}"
    expected_ratio_12 = 12.0 / 400.0  # 0.03
    assert abs(ratio_12 - expected_ratio_12) < 1e-6, (
        f"Expected age_weight_ratio to be {expected_ratio_12}, got {ratio_12}"
    )

    # --- Run inference for Cow B (48 months) ---
    pred_48m = service.predict_for_observation(user.id, obs_48m.id)
    assert pred_48m is not None
    assert len(_captured_spy_inputs) == 2

    x_48 = _captured_spy_inputs[1]
    assert isinstance(x_48, pd.DataFrame)
    age_48 = float(x_48["age"].iloc[0])
    ratio_48 = float(x_48["age_weight_ratio"].iloc[0])

    assert age_48 == 48.0, f"Expected inference age to be 48.0 months, got {age_48}"
    expected_ratio_48 = 48.0 / 500.0  # 0.096
    assert abs(ratio_48 - expected_ratio_48) < 1e-6, (
        f"Expected age_weight_ratio to be {expected_ratio_48}, got {ratio_48}"
    )


def test_inference_feature_vector_age_older_cow_no_heuristic(db_session: Session, tmp_path):
    """
    Regression test:
    Proves that cow age of 180 months (15.0 years) reaches model inference
    as exactly 180.0 months, confirming the legacy 'age < 15' heuristic was removed.
    """
    import pandas as pd

    _captured_spy_inputs.clear()

    user_id = str(uuid4())
    user = User(id=user_id, email=f"u_{user_id[:8]}@example.com", full_name="Older Cow Test")
    db_session.add(user)
    db_session.flush()

    farm = Farm(id=str(uuid4()), name="Old Cow Farm", timezone="UTC", created_by=user.id, latitude=12.97, longitude=77.59)
    db_session.add(farm)
    db_session.flush()

    cow_old = Cow(
        id=str(uuid4()),
        farm_id=farm.id,
        tag_id="COW-180M",
        owner_id=user.id,
        created_by=user.id,
        age_months=180,
        weight_kg=600.0,
    )
    db_session.add(cow_old)
    db_session.flush()

    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=24.0,
        humidity=50.0,
        thi=68.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.flush()

    obs_old = DailyObservation(
        id=str(uuid4()),
        cow_id=cow_old.id,
        observation_date=date.today(),
        owner_id=user.id,
        feed_quantity_kg=25.0,
        weather_log_id=weather.id,
    )
    db_session.add(obs_old)
    db_session.commit()

    model_path = tmp_path / "old_cow_model.pkl"
    joblib.dump(_SpyModel(), model_path)

    service = PredictionService(db_session, model_path=str(model_path))
    service.predict_for_observation(user.id, obs_old.id)

    assert len(_captured_spy_inputs) == 1
    x_old = _captured_spy_inputs[0]
    assert float(x_old["age"].iloc[0]) == 180.0
    assert abs(float(x_old["age_weight_ratio"].iloc[0]) - (180.0 / 600.0)) < 1e-6



