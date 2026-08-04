from uuid import uuid4
from datetime import datetime, date, timezone

import joblib
import os

from sqlalchemy.orm import Session

from app.services.prediction_service import PredictionService
from app.models import User, Farm, Cow, DailyObservation, WeatherLog, MilkPrediction
from app.schemas.feature import FeatureVector


def _create_owner_entities(session: Session):
    user_id = str(uuid4())
    user = User(id=user_id, email=f'u{user_id}@example.com', full_name='Pred Test')
    session.add(user); session.flush()
    farm = Farm(id=str(uuid4()), name='Pred Farm', timezone='UTC', created_by=user.id, latitude=0.0, longitude=0.0)
    session.add(farm); session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='T1', owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=500.0)
    session.add(cow); session.flush()
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id)
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
    fv = FeatureVector(age=10, weight=500.0, health_status=0, feed=20.0, temperature=25.0, humidity=60.0, thi=70.0)
    fv.observation_id = obs.id
    saved = svc.predict_for_observation(user.id, obs.id, fv)
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
    fv = FeatureVector(age=10, weight=500.0, health_status=0, feed=20.0)
    fv.observation_id = obs.id
    try:
        svc.predict_for_observation(other_id, obs.id, fv)
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
    fv = FeatureVector(age=10, weight=500.0, health_status=0, feed=20.0)
    fv.observation_id = 'non-existent'
    try:
        svc.predict_for_observation(user.id, fv.observation_id, fv)
        assert False
    except ValueError:
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
    fv = FeatureVector(age=10, weight=500.0, health_status=0, feed=20.0)
    fv.observation_id = obs.id
    saved = svc.predict_for_observation(user.id, obs.id, fv)
    # Query DB to ensure persisted
    reloaded = db_session.query(MilkPrediction).get(saved.id)
    assert reloaded is not None
