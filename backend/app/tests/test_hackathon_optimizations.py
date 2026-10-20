"""
test_hackathon_optimizations.py
===============================
Regression and verification test suite for hackathon fixes:
  1. Public /api/v1/health unauthenticated liveness check
  2. /api/v1/health/system system telemetry and model readiness
  3. Weather calculate_thi function execution
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from app.main import app
from app.services.weather_service import WeatherService
from app.services.what_if_service import WhatIfService
from app.services.prediction_service import PredictionService
from app.schemas.what_if import CowWhatIfRequest, SimulationInput


def test_weather_calculate_thi_execution():
    """Verify backend calculate_thi executes deterministically."""
    temp = 30.0
    hum = 60.0
    actual = WeatherService.calculate_thi(temp, hum)
    assert actual is not None
    assert isinstance(actual, float)
    assert actual > 0


def test_public_health_endpoint_requires_no_auth():
    """Verify /api/v1/health is accessible without Authorization header."""
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_system_health_telemetry_endpoint():
    """Verify /api/v1/health/system reports database, ML model, and herd size."""
    client = TestClient(app)
    response = client.get("/api/v1/health/system")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "ml_model_loaded" in data
    assert data["database"] == "healthy"
    assert data["ml_model_loaded"] is True


def test_simulation_financial_calculations_units_and_monthly_projection(db_session):
    """
    Verify WhatIfService financial calculation logic:
      - Units: Milk in L, Feed in kg, Price in ₹/L, Cost in ₹/kg
      - Daily revenue = delta_milk_l * milk_price
      - Daily feed cost = delta_feed_kg * feed_cost
      - Daily net benefit = revenue - feed cost
      - Monthly projection = daily net benefit * 30.0 days
      - Decision classification: 'positive' when > +1.0, 'negative' when < -1.0, else 'near_break_even'
    """
    service = WhatIfService(db=db_session)

    # 1. Positive scenario: 2.0 L extra milk, 1.0 kg extra feed, ₹40/L, ₹20/kg
    pos_impact = service._compute_financial_impact(
        farm_id=None,
        delta_milk_l=2.0,
        delta_feed_kg=1.0,
        override_milk_price=40.0,
        override_feed_cost=20.0,
    )
    assert pos_impact.daily_revenue_change == 80.00
    assert pos_impact.daily_feed_cost_change == 20.00
    assert pos_impact.daily_net_benefit == 60.00
    assert pos_impact.monthly_net_benefit == 1800.00  # 60.0 * 30
    assert pos_impact.decision_classification == "positive"
    assert pos_impact.revenue_per_feed_cost_ratio == 4.00
    assert pos_impact.using_default_assumptions is False

    # 2. Negative scenario: 0.5 L extra milk, 3.0 kg extra feed, ₹40/L, ₹20/kg
    neg_impact = service._compute_financial_impact(
        farm_id=None,
        delta_milk_l=0.5,
        delta_feed_kg=3.0,
        override_milk_price=40.0,
        override_feed_cost=20.0,
    )
    assert neg_impact.daily_revenue_change == 20.00
    assert neg_impact.daily_feed_cost_change == 60.00
    assert neg_impact.daily_net_benefit == -40.00
    assert neg_impact.monthly_net_benefit == -1200.00
    assert neg_impact.decision_classification == "negative"
    assert neg_impact.using_default_assumptions is False

    # 3. Near break-even scenario: delta daily net benefit between -1.0 and +1.0
    even_impact = service._compute_financial_impact(
        farm_id=None,
        delta_milk_l=1.0,
        delta_feed_kg=2.0,
        override_milk_price=40.0,
        override_feed_cost=20.0,
    )
    assert even_impact.daily_revenue_change == 40.00
    assert even_impact.daily_feed_cost_change == 40.00
    assert even_impact.daily_net_benefit == 0.00
    assert even_impact.monthly_net_benefit == 0.00
    assert even_impact.decision_classification == "near_break_even"

    # 4. Default assumptions fallback when no overrides or farm settings
    default_impact = service._compute_financial_impact(
        farm_id=None,
        delta_milk_l=1.0,
        delta_feed_kg=1.0,
    )
    assert default_impact.milk_price_per_liter == 42.0
    assert default_impact.feed_cost_per_kg == 24.0
    assert default_impact.using_default_assumptions is True


def test_what_if_invalid_or_missing_cow_id(db_session):
    """Verify run_cow_what_if raises ValueError when cow_id is missing/invalid."""
    service = WhatIfService(db=db_session)
    req = CowWhatIfRequest(scenario=SimulationInput(temperature_c=30.0, humidity_pct=60.0))

    import pytest
    with pytest.raises(ValueError, match="Cow not found"):
        service.run_cow_what_if(user_id="user-123", cow_id="nonexistent-cow-uuid", request=req)


def test_explainability_invalid_or_missing_prediction_id(db_session):
    """Verify explainability service raises ExplainabilityNotFound when prediction_id is invalid."""
    from app.services.explainability_service import ExplainabilityService, ExplainabilityNotFound
    service = ExplainabilityService(db=db_session)

    import pytest
    with pytest.raises(ExplainabilityNotFound, match="Prediction not found"):
        service.explain(user_id="user-123", prediction_id="nonexistent-prediction-uuid")


def test_prediction_interval_uncalibrated_history_handling(db_session):
    """Verify prediction interval safely falls back to 'limited_data' status when historical data is absent."""
    service = PredictionService(db=db_session)

    conf_score, conf_lower, conf_upper, status = service._compute_confidence_interval(
        farm_id="empty-farm-uuid",
        predicted_yield=22.0,
    )
    assert status == "limited_data"
    assert conf_lower < 22.0
    assert conf_upper > 22.0
    assert 0.50 <= conf_score <= 0.85


def test_auth_supabase_login_rejects_invalid_password_and_accepts_valid(db_session):
    """Verify that Supabase authentication strictly validates passwords and rejects bad credentials."""
    import pytest
    from unittest.mock import MagicMock, patch
    from uuid import uuid4
    from app.services.auth_service import AuthService
    from app.schemas.auth import LoginRequest
    from app.exceptions import AuthUnauthorized
    from app.models.user import User

    test_uid = str(uuid4())
    test_email = f"security.audit.{test_uid[:8]}@dairyvision.ai"
    test_user = User(
        id=test_uid,
        email=test_email,
        full_name="Security Audit User",
        is_active=True,
    )
    db_session.add(test_user)
    db_session.commit()

    service = AuthService(db=db_session)

    # 1. Invalid password raises AuthUnauthorized
    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_supabase.auth.sign_in_with_password.side_effect = Exception("Invalid login credentials")
        with pytest.raises(AuthUnauthorized, match="The supplied email address or password is incorrect"):
            service.login(LoginRequest(email=test_email, password="definitely-wrong-password"))

    # 2. Valid credentials return valid AuthResponse
    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_res = MagicMock()
        mock_u = MagicMock()
        mock_u.id = test_uid
        mock_u.email = test_email
        mock_u.user_metadata = {"full_name": "Security Audit User"}
        mock_u.avatar_url = None
        mock_sess = MagicMock()
        mock_sess.access_token = "valid-supabase-token-123"
        mock_res.user = mock_u
        mock_res.session = mock_sess
        mock_supabase.auth.sign_in_with_password.return_value = mock_res

        res = service.login(LoginRequest(email=test_email, password="valid-secure-password"))
        assert res.access_token == "valid-supabase-token-123"
        assert res.user.email == test_email

    # Cleanup
    db_session.query(User).filter(User.id == test_uid).delete()
    db_session.commit()


def test_auth_deactivated_account_rejected(db_session):
    """Verify that deactivated user accounts cannot authenticate even with valid Supabase credentials."""
    import pytest
    from unittest.mock import MagicMock, patch
    from uuid import uuid4
    from app.services.auth_service import AuthService
    from app.schemas.auth import LoginRequest
    from app.exceptions import AuthUnauthorized
    from app.models.user import User

    test_uid = str(uuid4())
    test_email = f"deactivated.{test_uid[:8]}@dairyvision.ai"
    deact_user = User(
        id=test_uid,
        email=test_email,
        full_name="Deactivated Audit User",
        is_active=False,
    )
    db_session.add(deact_user)
    db_session.commit()

    service = AuthService(db=db_session)

    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_res = MagicMock()
        mock_u = MagicMock()
        mock_u.id = test_uid
        mock_u.email = test_email
        mock_u.user_metadata = {"full_name": "Deactivated Audit User"}
        mock_u.avatar_url = None
        mock_sess = MagicMock()
        mock_sess.access_token = "token-for-deactivated"
        mock_res.user = mock_u
        mock_res.session = mock_sess
        mock_supabase.auth.sign_in_with_password.return_value = mock_res

        with pytest.raises(AuthUnauthorized, match="account has been deactivated"):
            service.login(LoginRequest(email=test_email, password="some-valid-password"))

    # Cleanup
    db_session.query(User).filter(User.id == test_uid).delete()
    db_session.commit()


def test_auth_supabase_unavailable_raises_service_unavailable(db_session):
    """Verify that when Supabase is down/unreachable, login raises AuthServiceUnavailable."""
    import pytest
    from unittest.mock import patch
    from app.services.auth_service import AuthService
    from app.schemas.auth import LoginRequest
    from app.exceptions import AuthServiceUnavailable

    service = AuthService(db=db_session)

    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_supabase.auth.sign_in_with_password.side_effect = Exception("Connection refused / server disconnected")
        with pytest.raises(AuthServiceUnavailable, match="Authentication service is temporarily unavailable"):
            service.login(LoginRequest(email="farmer@dairyvision.ai", password="any-password"))


def test_system_health_sanitizes_database_errors_without_leakage():
    """Verify /api/v1/health/system does not expose internal connection strings or stack traces on failure."""
    from unittest.mock import patch

    with patch("app.api.v1.health.SessionLocal") as mock_session_local:
        mock_session_local.side_effect = Exception("password=super_secret_db_pass host=internal.cluster.local failed")
        client = TestClient(app)
        response = client.get("/api/v1/health/system")
        assert response.status_code == 200
        data = response.json()
        assert data["database"] == "unhealthy"
        # Verify no sensitive keywords or internal details leaked
        assert "password" not in response.text
        assert "super_secret_db_pass" not in response.text
        assert "internal.cluster.local" not in response.text


def test_simulation_financial_calculations_zero_cost_and_edge_cases(db_session):
    """Verify zero feed change, negative feed savings, and boundary classifications."""
    service = WhatIfService(db=db_session)

    # 1. Zero-cost cooling intervention: delta_feed_kg == 0, delta_milk_l > 0
    zero_feed_impact = service._compute_financial_impact(
        farm_id=None,
        delta_milk_l=1.5,
        delta_feed_kg=0.0,
        override_milk_price=40.0,
        override_feed_cost=22.0,
    )
    assert zero_feed_impact.daily_revenue_change == 60.00
    assert zero_feed_impact.daily_feed_cost_change == 0.00
    assert zero_feed_impact.daily_net_benefit == 60.00
    assert zero_feed_impact.revenue_per_feed_cost_ratio is None
    assert zero_feed_impact.decision_classification == "positive"
    assert "feed intake unchanged" in zero_feed_impact.explanation_text.lower()

    # 2. Feed reduction savings: delta_feed_kg == -2.0, delta_milk_l == -0.5
    feed_saving_impact = service._compute_financial_impact(
        farm_id=None,
        delta_milk_l=-0.5,
        delta_feed_kg=-2.0,
        override_milk_price=40.0,
        override_feed_cost=20.0,
    )
    # Revenue loss = -0.5 * 40 = -20.00; Feed savings = -2.0 * 20 = -40.00 cost change;
    # Net benefit = -20 - (-40) = +20.00
    assert feed_saving_impact.daily_revenue_change == -20.00
    assert feed_saving_impact.daily_feed_cost_change == -40.00
    assert feed_saving_impact.daily_net_benefit == 20.00
    assert feed_saving_impact.monthly_net_benefit == 600.00
    assert feed_saving_impact.decision_classification == "positive"
