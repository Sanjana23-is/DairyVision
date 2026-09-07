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
