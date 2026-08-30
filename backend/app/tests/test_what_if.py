from uuid import uuid4
from datetime import datetime, timezone

import types
import sys
import joblib
import numpy as np
from sklearn.dummy import DummyRegressor
from sqlalchemy.orm import Session

from app.services.what_if_service import WhatIfService
from app.schemas.what_if import WhatIfRequest
from app.schemas.feature import FeatureVector
from app.models import WeatherLog


def _create_owner_entities(session: Session):
    from uuid import uuid4
    from datetime import date
    from app.models import User, Farm, Cow, DailyObservation

    user_id = str(uuid4())
    user = User(id=user_id, email=f'u{user_id}@example.com', full_name='WhatIf Test')
    session.add(user); session.flush()
    farm = Farm(id=str(uuid4()), name='WhatIf Farm', timezone='UTC', created_by=user.id, latitude=0.0, longitude=0.0)
    session.add(farm); session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='T1', owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=500.0)
    session.add(cow); session.flush()
    obs = DailyObservation(id=str(uuid4()), cow_id=cow.id, observation_date=date.today(), owner_id=user.id, created_at=datetime.now(timezone.utc), feed_quantity_kg=20.0, milk_produced_liters=15.0)
    session.add(obs)
    session.commit()
    return user, farm, cow, obs


def test_what_if_service_runs_with_scenario(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    model = DummyRegressor(strategy='mean')
    X = np.zeros((2, 11))
    y = np.array([12.0, 10.0])
    model.fit(X, y)
    model_path = tmp_path / 'what_if_model.pkl'
    joblib.dump(model, model_path)

    class FakeExplainer:
        def __init__(self, model):
            pass

        def shap_values(self, x):
            from config import ALL_FEATURES as CF
            return np.full((1, len(CF)), 0.1)

    sys.modules['shap'] = types.SimpleNamespace(TreeExplainer=lambda m: FakeExplainer(m))

    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=30.0,
        humidity=60.0,
        thi=76.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.commit()
    obs.weather_log_id = weather.id
    db_session.add(obs)
    db_session.commit()

    request = WhatIfRequest(
        observation_id=obs.id,
        scenario=FeatureVector(observation_id=obs.id, temperature=25.0, humidity=50.0, thi=65.0),
        include_explainability=True,
        include_health_alert=True,
        include_recommendations=True,
    )

    service = WhatIfService(db_session, model_path=str(model_path))
    result = service.run_what_if(user.id, request)

    assert result.observation_id == obs.id
    assert result.current_health_alert is not None
    assert result.scenario_health_alert is not None
    assert result.current_explainability is not None
    assert result.scenario_explainability is not None
    assert isinstance(result.current_recommendations, list)
    assert isinstance(result.scenario_recommendations, list)
    assert result.current_prediction.predicted_milk_yield == result.current_prediction.predicted_milk_yield
    assert result.scenario_prediction.predicted_milk_yield == result.scenario_prediction.predicted_milk_yield


def test_what_if_partial_scenario_produces_complete_feature_vector(db_session: Session, tmp_path):
    # Regression test: a scenario that only overrides temperature/humidity/thi
    # must not fail PredictionService's missing-feature validation. The
    # resulting scenario_features must contain every field in
    # config.ALL_FEATURES, with unset fields inherited from the observation's
    # baseline and overridden fields' dependent engineered features
    # recomputed -- not left NaN or defaulted.
    user, farm, cow, obs = _create_owner_entities(db_session)
    model = DummyRegressor(strategy='mean')
    X = np.zeros((2, 13))
    y = np.array([12.0, 10.0])
    model.fit(X, y)
    model_path = tmp_path / 'what_if_model.pkl'
    joblib.dump(model, model_path)

    weather = WeatherLog(
        id=str(uuid4()),
        farm_id=farm.id,
        owner_id=user.id,
        temperature=30.0,
        humidity=60.0,
        thi=76.0,
        recorded_at=datetime.now(timezone.utc),
    )
    db_session.add(weather)
    db_session.commit()
    obs.weather_log_id = weather.id
    db_session.add(obs)
    db_session.commit()

    request = WhatIfRequest(
        observation_id=obs.id,
        scenario=FeatureVector(observation_id=obs.id, temperature=25.0, humidity=50.0, thi=65.0),
        include_explainability=False,
        include_health_alert=False,
        include_recommendations=False,
    )

    service = WhatIfService(db_session, model_path=str(model_path))
    # Must not raise PredictionValidationError for "missing" age/weight/feed --
    # those must come from the observation's baseline, not the scenario override.
    result = service.run_what_if(user.id, request)

    from config import ALL_FEATURES as CF
    missing = [f for f in CF if getattr(result.scenario_features, f, None) is None]
    assert missing == [], f"scenario_features missing required fields: {missing}"

    # Unset fields inherited from the observation's baseline.
    assert result.scenario_features.age == result.current_features.age
    assert result.scenario_features.weight == result.current_features.weight
    assert result.scenario_features.health_status == result.current_features.health_status
    assert result.scenario_features.feed == result.current_features.feed

    # Overridden fields applied as given.
    assert result.scenario_features.temperature == 25.0
    assert result.scenario_features.humidity == 50.0
    assert result.scenario_features.thi == 65.0

    # Dependent engineered features recomputed from the overridden values,
    # not left as the baseline's stale values.
    assert result.scenario_features.temp_humidity == 25.0 * 50.0
    assert result.scenario_features.thi_squared == 65.0 * 65.0
    assert result.scenario_features.feed_thi_interaction == result.current_features.feed * 65.0

    # observation_id preserved and the baseline itself untouched.
    assert result.scenario_features.observation_id == obs.id
    assert result.current_features.temperature == 30.0
    assert result.current_features.humidity == 60.0

    # The prediction itself must have actually succeeded.
    assert result.scenario_prediction.predicted_milk_yield == result.scenario_prediction.predicted_milk_yield
