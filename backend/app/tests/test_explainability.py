from uuid import uuid4
import types
import sys

from sqlalchemy.orm import Session

from app.services.explainability_service import ExplainabilityService
from app.services.prediction_service import PredictionService
from app.services.feature_engineering_service import FeatureEngineeringService
from app.models import MilkPrediction
from app.schemas.feature import FeatureVector


def _create_owner_entities(session: Session):
    from uuid import uuid4
    from datetime import date, datetime, timezone
    from app.models import User, Farm, Cow, DailyObservation, WeatherLog

    user_id = str(uuid4())
    user = User(id=user_id, email=f'u{user_id}@example.com', full_name='Expl Test')
    session.add(user); session.flush()
    farm = Farm(id=str(uuid4()), name='Expl Farm', timezone='UTC', created_by=user.id, latitude=0.0, longitude=0.0)
    session.add(farm); session.flush()
    cow = Cow(id=str(uuid4()), farm_id=farm.id, tag_id='T1', owner_id=user.id, created_by=user.id, birth_date=date.today(), weight_kg=500.0)
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


def test_explain_by_prediction_id_caches(db_session: Session, tmp_path):
    # This is the actual production flow: the frontend only ever sends
    # prediction_id, never a feature_vector (see frontend/src/services/
    # explainability.ts). Previously this was hardcoded to always raise --
    # this test now exercises the real, fixed path.
    user, farm, cow, obs = _create_owner_entities(db_session)
    # prepare a trivial model file
    import joblib
    from sklearn.dummy import DummyRegressor
    import numpy as np

    model = DummyRegressor(strategy='mean')
    X = np.zeros((2, 0))
    y = np.array([1.0, 2.0])
    model.fit(X, y)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)

    # create a prediction via PredictionService
    psvc = PredictionService(db_session, model_path=str(model_path))
    pred = psvc.predict_for_observation(user.id, obs.id)

    # monkeypatch shap to deterministic fake
    class FakeExplainer:
        def __init__(self, model):
            self.model = model

        def shap_values(self, x):
            # return small deterministic vector length equal to config.ALL_FEATURES
            from config import ALL_FEATURES as CF
            import numpy as _np
            vals = _np.zeros((1, len(CF)))
            for i in range(len(CF)):
                vals[0, i] = float(i) * 0.1 - 0.2
            return vals

    fake_shap = types.SimpleNamespace(TreeExplainer=lambda model: FakeExplainer(model))
    sys.modules['shap'] = fake_shap

    svc = ExplainabilityService(db_session, model_path=str(model_path))
    # No feature_vector supplied -- this is the exact call shape the live
    # frontend uses. Must not raise.
    res1 = svc.explain(user.id, prediction_id=pred.id)
    assert res1.observation_id == obs.id
    assert len((res1.details or {}).get('features', [])) >= 0

    # Second call for the same prediction should hit the get_by_prediction_id
    # fast path and return the identical cached result.
    res2 = svc.explain(user.id, prediction_id=pred.id)
    assert res1.id == res2.id


def test_explain_by_prediction_id_wrong_owner_is_forbidden(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    import joblib
    from sklearn.dummy import DummyRegressor
    import numpy as np

    model = DummyRegressor(strategy='mean')
    X = np.zeros((2, 0))
    y = np.array([1.0, 2.0])
    model.fit(X, y)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)

    psvc = PredictionService(db_session, model_path=str(model_path))
    pred = psvc.predict_for_observation(user.id, obs.id)

    from app.models import User
    other_id = str(uuid4())
    other_user = User(id=other_id, email=f'u{other_id}@example.com', full_name='Other')
    db_session.add(other_user)
    db_session.commit()

    fake_shap = types.SimpleNamespace(TreeExplainer=lambda model: None)
    sys.modules['shap'] = fake_shap

    svc = ExplainabilityService(db_session, model_path=str(model_path))
    try:
        svc.explain(other_user.id, prediction_id=pred.id)
        assert False, "expected PermissionError"
    except PermissionError:
        pass


def test_explain_by_feature_vector(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    import joblib
    from sklearn.dummy import DummyRegressor
    import numpy as np

    model = DummyRegressor(strategy='mean')
    X = np.zeros((2, 0))
    y = np.array([1.0, 2.0])
    model.fit(X, y)
    model_path = tmp_path / 'best_milk_model.pkl'
    joblib.dump(model, model_path)

    class FakeExplainer2:
        def __init__(self, model):
            pass

        def shap_values(self, x):
            from config import ALL_FEATURES as CF
            import numpy as _np
            vals = _np.ones((1, len(CF))) * 0.5
            return vals

    import types, sys
    sys.modules['shap'] = types.SimpleNamespace(TreeExplainer=lambda m: FakeExplainer2(m))

    svc = ExplainabilityService(db_session, model_path=str(model_path))
    # Use the real, complete, internally-consistent baseline for this
    # observation instead of a hand-built partial FeatureVector -- an
    # incomplete vector would now correctly fail Finding 3's validation.
    fv = FeatureEngineeringService(db_session).build_features_for_observation(user.id, obs.id)
    res = svc.explain(user.id, feature_vector=fv)
    assert res.owner_id == user.id
    assert isinstance(res.top_positive, list)
