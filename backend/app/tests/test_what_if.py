from uuid import uuid4
from datetime import datetime, timezone

import types
import sys
import joblib
import numpy as np
from sklearn.dummy import DummyRegressor
from sqlalchemy.orm import Session

from app.services.what_if_service import WhatIfService
from app.schemas.what_if import WhatIfRequest, CowWhatIfRequest, HerdWhatIfRequest, SimulationInput
from app.schemas.feature import FeatureVector
from app.models import WeatherLog, FarmSettings


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
    assert result.financial_impact is not None
    assert result.financial_impact.using_default_assumptions is True


def test_what_if_partial_scenario_produces_complete_feature_vector(db_session: Session, tmp_path):
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
    result = service.run_what_if(user.id, request)

    from config import ALL_FEATURES as CF
    missing = [f for f in CF if getattr(result.scenario_features, f, None) is None]
    assert missing == [], f"scenario_features missing required fields: {missing}"

    assert result.scenario_features.age == result.current_features.age
    assert result.scenario_features.weight == result.current_features.weight
    assert result.scenario_features.health_status == result.current_features.health_status
    assert result.scenario_features.feed == result.current_features.feed

    assert result.scenario_features.temperature == 25.0
    assert result.scenario_features.humidity == 50.0

    assert result.scenario_features.temp_humidity == 25.0 * 50.0
    assert result.scenario_features.thi_squared == 65.0 * 65.0
    assert result.scenario_features.feed_thi_interaction == result.current_features.feed * 65.0

    assert result.scenario_features.observation_id == obs.id
    assert result.current_features.temperature == 30.0
    assert result.current_features.humidity == 60.0


def test_financial_impact_default_and_custom_assumptions(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    service = WhatIfService(db_session)

    # 1. Default assumptions test
    default_impact = service._compute_financial_impact(
        farm_id=farm.id,
        delta_milk_l=2.0,
        delta_feed_kg=1.0,
    )
    assert default_impact.milk_price_per_liter == 42.0
    assert default_impact.feed_cost_per_kg == 24.0
    assert default_impact.using_default_assumptions is True
    assert default_impact.daily_revenue_change == 84.0  # 2.0 * 42.0
    assert default_impact.daily_feed_cost_change == 24.0 # 1.0 * 24.0
    assert default_impact.daily_net_benefit == 60.0       # 84.0 - 24.0
    assert default_impact.monthly_net_benefit == 1800.0   # 60.0 * 30.0
    assert default_impact.decision_classification == "positive"
    assert default_impact.revenue_per_feed_cost_ratio == 3.5

    # 2. Custom farm settings test
    farm_settings = FarmSettings(
        farm_id=farm.id,
        milk_price_per_liter=50.0,
        feed_cost_per_kg=22.0,
        default_currency='INR',
    )
    db_session.add(farm_settings)
    db_session.commit()

    custom_impact = service._compute_financial_impact(
        farm_id=farm.id,
        delta_milk_l=2.0,
        delta_feed_kg=1.0,
    )
    assert custom_impact.milk_price_per_liter == 50.0
    assert custom_impact.feed_cost_per_kg == 22.0
    assert custom_impact.using_default_assumptions is False
    assert custom_impact.daily_revenue_change == 100.0
    assert custom_impact.daily_feed_cost_change == 22.0
    assert custom_impact.daily_net_benefit == 78.0
    assert custom_impact.monthly_net_benefit == 2340.0


def test_financial_impact_scenario_overrides_and_negative_net_benefit(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    service = WhatIfService(db_session)

    # 3. Scenario override & negative net benefit test (Decreased milk -1.5L + Increased feed +2kg)
    impact = service._compute_financial_impact(
        farm_id=farm.id,
        delta_milk_l=-1.5,
        delta_feed_kg=2.0,
        override_milk_price=40.0,
        override_feed_cost=25.0,
    )
    assert impact.milk_price_per_liter == 40.0
    assert impact.feed_cost_per_kg == 25.0
    assert impact.using_default_assumptions is False
    assert impact.daily_revenue_change == -60.0    # -1.5 * 40.0
    assert impact.daily_feed_cost_change == 50.0    # 2.0 * 25.0
    assert impact.daily_net_benefit == -110.0       # -60.0 - 50.0
    assert impact.monthly_net_benefit == -3300.0    # -110.0 * 30.0
    assert impact.daily_net_benefit < 0  # Must not be clamped to 0
    assert impact.decision_classification == "negative"
    assert impact.revenue_per_feed_cost_ratio == -1.2


def test_financial_explanation_and_classification_scenarios(db_session: Session):
    user, farm, cow, obs = _create_owner_entities(db_session)
    service = WhatIfService(db_session)

    # User example: +0.13 L milk, +2 kg feed @ ₹42/L and ₹24/kg
    # daily revenue: 0.13 * 42 = 5.46
    # daily feed cost: 2 * 24 = 48.0
    # daily net benefit: 5.46 - 48.0 = -42.54
    impact = service._compute_financial_impact(
        farm_id=farm.id,
        delta_milk_l=0.13,
        delta_feed_kg=2.0,
        override_milk_price=42.0,
        override_feed_cost=24.0,
    )
    assert impact.daily_revenue_change == 5.46
    assert impact.daily_feed_cost_change == 48.0
    assert impact.daily_net_benefit == -42.54
    assert impact.decision_classification == "negative"
    assert impact.revenue_per_feed_cost_ratio == 0.11  # 5.46 / 48.0 = 0.11375 -> 0.11
    assert "₹48.00" in impact.explanation_text
    assert "₹5.46" in impact.explanation_text
    assert "₹42.54" in impact.explanation_text

    # Zero feed change with positive milk
    zero_feed = service._compute_financial_impact(
        farm_id=farm.id,
        delta_milk_l=1.5,
        delta_feed_kg=0.0,
    )
    assert zero_feed.daily_feed_cost_change == 0.0
    assert zero_feed.revenue_per_feed_cost_ratio is None
    assert zero_feed.decision_classification == "positive"
    assert "With feed intake unchanged" in zero_feed.explanation_text

    # Break-even scenario (|net_benefit| <= 1.0)
    break_even = service._compute_financial_impact(
        farm_id=farm.id,
        delta_milk_l=0.5,
        delta_feed_kg=0.875,
        override_milk_price=42.0,
        override_feed_cost=24.0,
    ) # rev = 21.0, feed_cost = 21.0, net = 0.0
    assert break_even.daily_net_benefit == 0.0
    assert break_even.decision_classification == "near_break_even"
    assert "near break-even impact" in break_even.explanation_text


def test_cow_and_herd_what_if_financial_response(db_session: Session, tmp_path):
    user, farm, cow, obs = _create_owner_entities(db_session)
    model = DummyRegressor(strategy='mean')
    X = np.zeros((2, 13))
    y = np.array([15.0, 15.0])
    model.fit(X, y)
    model_path = tmp_path / 'what_if_model.pkl'
    joblib.dump(model, model_path)

    service = WhatIfService(db_session, model_path=str(model_path))

    cow_req = CowWhatIfRequest(
        scenario=SimulationInput(
            temperature_c=25.0,
            humidity_pct=60.0,
            feed_quantity_kg=24.0,
            override_milk_price_per_liter=45.0,
            override_feed_cost_per_kg=25.0,
        )
    )
    cow_res = service.run_cow_what_if(user.id, cow.id, cow_req)
    assert cow_res.financial_impact is not None
    assert cow_res.financial_impact.milk_price_per_liter == 45.0
    assert cow_res.financial_impact.feed_cost_per_kg == 25.0
    assert cow_res.financial_impact.explanation_text != ""

    herd_req = HerdWhatIfRequest(
        farm_id=farm.id,
        scenario=SimulationInput(
            temperature_c=25.0,
            humidity_pct=60.0,
            feed_quantity_kg=24.0,
        )
    )
    herd_res = service.run_herd_what_if(user.id, herd_req)
    assert herd_res.financial_impact is not None
    assert herd_res.financial_impact.using_default_assumptions is True
    assert herd_res.financial_impact.explanation_text != ""
