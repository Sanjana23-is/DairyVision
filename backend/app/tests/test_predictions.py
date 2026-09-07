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


