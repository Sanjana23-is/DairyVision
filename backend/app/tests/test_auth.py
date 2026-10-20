import os
import pytest
from unittest.mock import MagicMock, patch
from app.services.auth_service import AuthService
from app.schemas.auth import LoginRequest, SignupRequest

def test_format_supabase_error_expired_token():
    service = AuthService()

    # Test different variations of token expiry messages
    exc1 = Exception("invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired")
    err1 = service._format_supabase_error(exc1, action="me", email=None)
    assert str(err1) == "The provided authentication token is invalid or expired."

    exc2 = Exception("token is expired")
    err2 = service._format_supabase_error(exc2, action="login", email="test@example.com")
    assert str(err2) == "The provided authentication token is invalid or expired."

    exc3 = Exception("invalid signature")
    err3 = service._format_supabase_error(exc3, action="me", email=None)
    assert str(err3) == "The provided authentication token is invalid or expired."

    exc4 = Exception("some random database error")
    err4 = service._format_supabase_error(exc4, action="login", email="test@example.com")
    assert str(err4) == "Supabase authentication failed during login."


def test_format_supabase_error_transient_disconnect():
    from app.exceptions import AuthServiceUnavailable, AuthUnauthorized
    service = AuthService()

    exc = Exception("httpx.RemoteProtocolError: Server disconnected")
    err = service._format_supabase_error(exc, action="me", email=None)
    assert isinstance(err, AuthServiceUnavailable)
    assert str(err) == "Authentication service is temporarily unavailable. Please try again."


@patch("app.services.auth_service.supabase")
def test_transient_supabase_error_retries_and_raises_service_unavailable(mock_supabase, session):
    from app.exceptions import AuthServiceUnavailable

    mock_supabase.auth.get_user.side_effect = Exception("Server disconnected")

    service = AuthService(db=session)
    with pytest.raises(AuthServiceUnavailable):
        service.me("valid-token")

    # Verify bounded retry executed max_retries + 1 times (3 attempts total)
    assert mock_supabase.auth.get_user.call_count == 3


def test_get_current_user_maps_service_unavailable_to_503(session):
    from fastapi import HTTPException
    from app.dependencies.auth import get_current_user
    from app.exceptions import AuthServiceUnavailable

    with patch("app.dependencies.auth.AuthService") as mock_auth_cls:
        mock_instance = MagicMock()
        mock_instance.me.side_effect = AuthServiceUnavailable("Auth service unavailable")
        mock_auth_cls.return_value = mock_instance

        with pytest.raises(HTTPException) as exc_info:
            get_current_user("some-token", session)

        assert exc_info.value.status_code == 503
        assert exc_info.value.detail == "Auth service unavailable"


def test_get_current_user_maps_invalid_token_to_401(session):
    from fastapi import HTTPException
    from app.dependencies.auth import get_current_user
    from app.exceptions import AuthUnauthorized

    with patch("app.dependencies.auth.AuthService") as mock_auth_cls:
        mock_instance = MagicMock()
        mock_instance.me.side_effect = AuthUnauthorized("The provided authentication token is invalid or expired.")
        mock_auth_cls.return_value = mock_instance

        with pytest.raises(HTTPException) as exc_info:
            get_current_user("invalid-token", session)

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "The provided authentication token is invalid or expired."


@patch("app.services.auth_service.supabase")
def test_login_success(mock_supabase, session):
    # Mock supabase response for sign_in_with_password
    mock_user = MagicMock()
    mock_user.id = "user-id-123"
    mock_user.email = "test@example.com"
    mock_user.user_metadata = {"full_name": "Test User"}
    mock_user.avatar_url = None

    mock_session = MagicMock()
    mock_session.access_token = "mock-access-token"

    mock_response = MagicMock()
    mock_response.user = mock_user
    mock_response.session = mock_session

    mock_supabase.auth.sign_in_with_password.return_value = mock_response

    service = AuthService(db=session)
    payload = LoginRequest(email="test@example.com", password="password")

    res = service.login(payload)
    assert res.access_token == "mock-access-token"
    assert res.user.id == "user-id-123"
    assert res.user.email == "test@example.com"

def test_cors_origins_parsing():
    from app.core.config import _list_from_env
    import os

    # Test JSON list format
    with patch.dict(os.environ, {"TEST_CORS_JSON": '["http://localhost:3000","http://localhost:3001"]'}):
        origins = _list_from_env("TEST_CORS_JSON", "http://fallback")
        assert origins == ["http://localhost:3000", "http://localhost:3001"]

    # Test comma-separated format
    with patch.dict(os.environ, {"TEST_CORS_COMMA": "http://localhost:3000, http://localhost:3001"}):
        origins = _list_from_env("TEST_CORS_COMMA", "http://fallback")
        assert origins == ["http://localhost:3000", "http://localhost:3001"]

def test_sync_local_user_migrates_id_when_supabase_id_changes(session):
    from app.models import User, Farm
    from app.services.auth_service import AuthService

    old_id = "old-id"
    new_id = "new-id"
    email = "migrate@example.com"

    user = User(id=old_id, email=email, full_name="Old Name", is_active=True)
    session.add(user)
    session.flush()

    farm = Farm(id="farm-id-123", name="My Farm", timezone="UTC", created_by=old_id)
    session.add(farm)
    session.commit()

    service = AuthService(db=session)

    class DummyUserData:
        def __init__(self, id, email):
            self.id = id
            self.email = email
            self.user_metadata = {"full_name": "New Name"}
            self.avatar_url = None

    dummy_user = DummyUserData(id=new_id, email=email)
    service._sync_local_user(dummy_user)

    user_with_old_id = session.query(User).filter(User.id == old_id).first()
    user_with_new_id = session.query(User).filter(User.id == new_id).first()

    assert user_with_old_id is None
    assert user_with_new_id is not None
    assert user_with_new_id.email == email

    updated_farm = session.get(Farm, "farm-id-123")
    assert updated_farm.created_by == new_id


def test_local_jwt_decode_fast_path(session):
    import jwt as pyjwt
    import time
    from app.services.auth_service import AuthService
    from app.core.config import get_settings

    secret = "test-jwt-secret-key-32-bytes-long"
    payload = {
        "sub": "local-jwt-user-001",
        "email": "localjwt@dairyvision.io",
        "user_metadata": {"full_name": "Local Verified Farmer"},
        "exp": int(time.time()) + 3600,
        "aud": "authenticated",
        "role": "authenticated",
    }
    token = pyjwt.encode(payload, secret, algorithm="HS256")

    with patch.dict(os.environ, {"SUPABASE_JWT_SECRET": secret}):
        get_settings.cache_clear()
        try:
            service = AuthService(db=session)

            with patch("app.services.auth_service.supabase") as mock_supabase:
                res = service.me(token)
                assert mock_supabase.auth.get_user.called is False
                assert res.user.id == "local-jwt-user-001"
                assert res.user.email == "localjwt@dairyvision.io"
                assert res.user.full_name == "Local Verified Farmer"
        finally:
            get_settings.cache_clear()


def test_local_jwt_decode_expired_token_raises_unauthorized(session):
    import jwt as pyjwt
    import time
    from app.services.auth_service import AuthService
    from app.exceptions import AuthUnauthorized
    from app.core.config import get_settings

    secret = "test-jwt-secret-key-32-bytes-long"
    payload = {
        "sub": "expired-user",
        "email": "expired@dairyvision.io",
        "exp": int(time.time()) - 100,
    }
    token = pyjwt.encode(payload, secret, algorithm="HS256")

    with patch.dict(os.environ, {"SUPABASE_JWT_SECRET": secret}):
        get_settings.cache_clear()
        try:
            service = AuthService(db=session)
            with pytest.raises(AuthUnauthorized) as exc_info:
                service.me(token)
            assert "invalid or expired" in str(exc_info.value).lower()
        finally:
            get_settings.cache_clear()


def test_login_route_invalid_password_returns_401(client):
    from unittest.mock import patch
    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_supabase.auth.sign_in_with_password.side_effect = Exception("Invalid login credentials")
        response = client.post("/api/v1/auth/login", json={"email": "audit@dairyvision.ai", "password": "wrong"})
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()


def test_login_route_supabase_unavailable_returns_503(client):
    from unittest.mock import patch
    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_supabase.auth.sign_in_with_password.side_effect = Exception("httpx.RemoteProtocolError: Server disconnected")
        response = client.post("/api/v1/auth/login", json={"email": "audit@dairyvision.ai", "password": "secret"})
        assert response.status_code == 503
        assert "temporarily unavailable" in response.json()["detail"].lower()


def test_login_route_deactivated_account_returns_401(client, session):
    from unittest.mock import MagicMock, patch
    from uuid import uuid4
    from app.models.user import User

    test_uid = str(uuid4())
    test_email = f"deact.route.{test_uid[:8]}@dairyvision.ai"
    user = User(id=test_uid, email=test_email, full_name="Deactivated Route User", is_active=False)
    session.add(user)
    session.commit()

    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_res = MagicMock()
        mock_u = MagicMock()
        mock_u.id = test_uid
        mock_u.email = test_email
        mock_u.user_metadata = {"full_name": "Deactivated Route User"}
        mock_u.avatar_url = None
        mock_sess = MagicMock()
        mock_sess.access_token = "valid-token-for-inactive"
        mock_res.user = mock_u
        mock_res.session = mock_sess
        mock_supabase.auth.sign_in_with_password.return_value = mock_res

        response = client.post("/api/v1/auth/login", json={"email": test_email, "password": "valid-password"})
        assert response.status_code == 401
        assert "deactivated" in response.json()["detail"].lower()

    session.query(User).filter(User.id == test_uid).delete()
    session.commit()


def test_token_validation_deactivated_user_in_me_returns_401(session):
    import jwt as pyjwt
    import time
    from uuid import uuid4
    from app.models.user import User
    from app.services.auth_service import AuthService
    from app.exceptions import AuthUnauthorized
    from app.core.config import get_settings

    test_uid = str(uuid4())
    test_email = f"deact.token.{test_uid[:8]}@dairyvision.ai"
    user = User(id=test_uid, email=test_email, full_name="Deactivated Token User", is_active=False)
    session.add(user)
    session.commit()

    cfg = get_settings()
    secret = cfg.supabase_jwt_secret or "dairyvision-hackathon-secure-jwt-secret-32b"
    payload = {
        "sub": test_uid,
        "email": test_email,
        "user_metadata": {"full_name": "Deactivated Token User"},
        "exp": int(time.time()) + 3600,
    }
    token = pyjwt.encode(payload, secret, algorithm="HS256")

    service = AuthService(db=session)
    with pytest.raises(AuthUnauthorized, match="deactivated"):
        service.me(token)

    session.query(User).filter(User.id == test_uid).delete()
    session.commit()


def test_protected_route_missing_token_returns_401(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Missing authorization header" in response.json()["detail"]


def test_send_password_reset_supplies_appropriate_redirect_to(session):
    from unittest.mock import patch
    from app.services.auth_service import AuthService

    service = AuthService(db=session)

    with patch("app.services.auth_service.supabase") as mock_supabase:
        service.send_password_reset("farmer@dairyvision.ai")
        mock_supabase.auth.reset_password_email.assert_called_once_with(
            "farmer@dairyvision.ai",
            options={"redirect_to": "http://localhost:3000/reset-password"},
        )


def test_send_password_reset_accepts_custom_allowed_redirect_to(session):
    from unittest.mock import patch
    from app.services.auth_service import AuthService

    service = AuthService(db=session)

    with patch("app.services.auth_service.supabase") as mock_supabase:
        service.send_password_reset("farmer@dairyvision.ai", redirect_to="http://localhost:5173/reset-password")
        mock_supabase.auth.reset_password_email.assert_called_once_with(
            "farmer@dairyvision.ai",
            options={"redirect_to": "http://localhost:5173/reset-password"},
        )


def test_reset_password_endpoint_updates_password_successfully(client, session):
    import jwt as pyjwt
    import time
    from unittest.mock import patch
    from uuid import uuid4
    from app.models.user import User
    from app.core.config import get_settings

    test_uid = str(uuid4())
    test_email = f"reset.user.{test_uid[:8]}@dairyvision.ai"
    user = User(id=test_uid, email=test_email, full_name="Reset User", is_active=True)
    session.add(user)
    session.commit()

    cfg = get_settings()
    secret = cfg.supabase_jwt_secret or "dairyvision-hackathon-secure-jwt-secret-32b"
    token = pyjwt.encode({"sub": test_uid, "email": test_email, "exp": int(time.time()) + 3600}, secret, algorithm="HS256")

    with patch("app.services.auth_service.supabase") as mock_supabase:
        response = client.post(
            "/api/v1/auth/reset-password",
            json={"password": "NewSecurePassword123!"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert "successfully updated" in response.json()["message"].lower()
        mock_supabase.auth.admin.update_user_by_id.assert_called_once_with(
            test_uid,
            {"password": "NewSecurePassword123!"},
        )

    session.query(User).filter(User.id == test_uid).delete()
    session.commit()


def test_reset_password_endpoint_rejects_short_password(client):
    import jwt as pyjwt
    import time
    from app.core.config import get_settings

    cfg = get_settings()
    secret = cfg.supabase_jwt_secret or "dairyvision-hackathon-secure-jwt-secret-32b"
    token = pyjwt.encode({"sub": "any-id", "email": "a@b.com", "exp": int(time.time()) + 3600}, secret, algorithm="HS256")

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"password": "short"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_reset_password_endpoint_rejects_expired_or_invalid_token(client):
    response = client.post(
        "/api/v1/auth/reset-password",
        json={"password": "NewSecurePassword123!"},
        headers={"Authorization": "Bearer invalid.expired.token"},
    )
    assert response.status_code == 401


def test_cors_preflight_reset_password(client):
    response = client.options(
        "/api/v1/auth/reset-password",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_cors_headers_on_error_responses(client):
    # 401 error response has CORS headers
    resp_401 = client.post(
        "/api/v1/auth/reset-password",
        json={"password": "NewPassword123!"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert resp_401.status_code == 401
    assert resp_401.headers.get("access-control-allow-origin") == "http://localhost:3000"

    # 422 validation error response has CORS headers
    resp_422 = client.post(
        "/api/v1/auth/reset-password",
        json={"password": "short"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert resp_422.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_headers_on_unhandled_500_error(client):
    from app.dependencies.auth import get_optional_auth_service

    def _crash():
        raise ZeroDivisionError("Simulated unhandled crash")

    client.app.dependency_overrides[get_optional_auth_service] = _crash
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "crash@dairyvision.ai", "password": "any"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 500
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        assert response.headers.get("access-control-allow-credentials") == "true"
    finally:
        client.app.dependency_overrides.pop(get_optional_auth_service, None)


def test_forgot_password_supabase_rate_limited_returns_429(client):
    with patch("app.services.auth_service.supabase") as mock_supabase:
        mock_supabase.auth.reset_password_email.side_effect = Exception("Email rate limit exceeded (429)")

        response = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "farmer@dairyvision.ai"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 429
        assert "rate limit exceeded" in response.json()["detail"].lower()
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        # Does NOT claim email was sent
        assert "has been sent" not in str(response.json()).lower()


def test_exception_handler_401_sanitizes_sensitive_details_and_includes_cors(client):
    from app.dependencies.auth import get_optional_auth_service
    from app.exceptions import AuthUnauthorized

    def _raise_sensitive_401():
        raise AuthUnauthorized("Sensitive token eyJhbGciOi... failed with psycopg connection string postgres://secret:pwd@host/db")

    client.app.dependency_overrides[get_optional_auth_service] = _raise_sensitive_401
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "audit@dairyvision.ai", "password": "any"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 401
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        detail = response.json()["detail"]
        assert "eyJ" not in detail
        assert "postgres" not in detail
        assert "psycopg" not in detail
        assert "secret" not in detail
        assert "pwd" not in detail
        assert "invalid or expired" in detail.lower()
    finally:
        client.app.dependency_overrides.pop(get_optional_auth_service, None)


def test_exception_handler_400_sanitizes_sensitive_details_and_includes_cors(client):
    from app.dependencies.auth import get_optional_auth_service
    from app.exceptions import AuthError

    def _raise_sensitive_400():
        raise AuthError("Internal error: SELECT * FROM users WHERE token = 'secret_token_123'")

    client.app.dependency_overrides[get_optional_auth_service] = _raise_sensitive_400
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "audit@dairyvision.ai", "password": "any"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 400
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        detail = response.json()["detail"]
        assert "SELECT" not in detail
        assert "secret_token_123" not in detail
        assert "users" not in detail
    finally:
        client.app.dependency_overrides.pop(get_optional_auth_service, None)


def test_exception_handler_503_includes_cors_and_safe_message(client):
    from app.dependencies.auth import get_optional_auth_service
    from app.exceptions import AuthServiceUnavailable

    def _raise_503():
        raise AuthServiceUnavailable("httpx.RemoteProtocolError: Server disconnected https://srldlurahlzfizpnnuyg.supabase.co")

    client.app.dependency_overrides[get_optional_auth_service] = _raise_503
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "audit@dairyvision.ai", "password": "any"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 503
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        detail = response.json()["detail"]
        assert "srldlurahlzfizpnnuyg" not in detail
        assert "https://" not in detail
        assert "temporarily unavailable" in detail.lower()
    finally:
        client.app.dependency_overrides.pop(get_optional_auth_service, None)


def test_exception_handler_429_includes_cors_and_safe_message(client):
    from app.dependencies.auth import get_optional_auth_service
    from app.exceptions import AuthRateLimitExceeded

    def _raise_429():
        raise AuthRateLimitExceeded("Too many requests from internal worker pid 45892")

    client.app.dependency_overrides[get_optional_auth_service] = _raise_429
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "audit@dairyvision.ai", "password": "any"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 429
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        detail = response.json()["detail"]
        assert "pid" not in detail
        assert "rate limit exceeded" in detail.lower()
    finally:
        client.app.dependency_overrides.pop(get_optional_auth_service, None)


def test_error_handling_middleware_500_includes_cors_and_safe_message(client):
    from app.dependencies.auth import get_optional_auth_service

    def _crash():
        raise RuntimeError("CRITICAL DATABASE CORRUPTION: table /var/data/users.db is corrupt")

    client.app.dependency_overrides[get_optional_auth_service] = _crash
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "crash@dairyvision.ai", "password": "any"},
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 500
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
        detail = response.json()["detail"]
        assert "/var/data" not in detail
        assert "CORRUPTION" not in detail
        assert detail == "Internal server error"
    finally:
        client.app.dependency_overrides.pop(get_optional_auth_service, None)
