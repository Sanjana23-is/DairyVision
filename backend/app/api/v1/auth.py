from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import get_current_user, get_optional_auth_service
from app.exceptions import AuthError, AuthServiceUnavailable, AuthUnauthorized, AuthRateLimitExceeded
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    LogoutResponse,
    MeResponse,
    SignupRequest,
    UpdateUserRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, auth_service: Annotated[AuthService, Depends(get_optional_auth_service)]) -> AuthResponse:
    try:
        return auth_service.signup(payload)
    except AuthUnauthorized as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AuthServiceUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("Auth signup route failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected auth signup error")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authentication failed during signup") from exc


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, auth_service: Annotated[AuthService, Depends(get_optional_auth_service)]) -> AuthResponse:
    try:
        return auth_service.login(payload)
    except AuthUnauthorized as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except AuthServiceUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("Auth login route failed")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected auth login error")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed during login") from exc


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    auth_service: Annotated[AuthService, Depends(get_optional_auth_service)],
) -> ForgotPasswordResponse:
    """Send a password reset email. Handles rate limits cleanly without false success claims."""
    try:
        auth_service.send_password_reset(payload.email, redirect_to=payload.redirect_to)
        return ForgotPasswordResponse(message="If an account exists with this email, a password reset link has been sent.")
    except AuthRateLimitExceeded as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc
    except AuthServiceUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password recovery service is temporarily unavailable. Please try again later.",
        ) from exc
    except Exception:
        # Silently swallow non-rate-limit errors to prevent email enumeration attacks
        logger.info("Password reset request processed for %s", payload.email)
        return ForgotPasswordResponse(message="If an account exists with this email, a password reset link has been sent.")


@router.post("/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    payload: ResetPasswordRequest,
    current_user: Annotated[MeResponse, Depends(get_current_user)],
    auth_service: Annotated[AuthService, Depends(get_optional_auth_service)],
) -> ResetPasswordResponse:
    """Update user password using verified recovery session."""
    try:
        auth_service.update_password(user_id=current_user.user.id, new_password=payload.password)
        return ResetPasswordResponse(message="Password has been successfully updated.")
    except AuthUnauthorized as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except AuthServiceUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except AuthRateLimitExceeded as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.exception("Auth reset-password route failed")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected auth reset-password error")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password reset failed") from exc


@router.post("/logout", response_model=LogoutResponse)
def logout(
    auth_service: Annotated[AuthService, Depends(get_optional_auth_service)],
    _current_user: Annotated[MeResponse, Depends(get_current_user)],
) -> LogoutResponse:
    return auth_service.logout()


@router.get("/me", response_model=MeResponse)
def me(current_user: Annotated[MeResponse, Depends(get_current_user)]) -> MeResponse:
    return current_user


@router.put("/me", response_model=MeResponse)
def update_me(
    payload: UpdateUserRequest,
    current_user: Annotated[MeResponse, Depends(get_current_user)],
    auth_service: Annotated[AuthService, Depends(get_optional_auth_service)],
) -> MeResponse:
    if payload.full_name:
        updated_auth_user = auth_service.update_profile(current_user.user.id, payload.full_name)
        return MeResponse(user=updated_auth_user)
    return current_user
