from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.supabase import supabase
from app.database.session import SessionLocal
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.auth import AuthResponse, AuthUser, LoginRequest, LogoutResponse, MeResponse, SignupRequest

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Optional[Session] = None) -> None:
        self.db = db or SessionLocal()

    def signup(self, payload: SignupRequest) -> AuthResponse:
        try:
            response = supabase.auth.sign_up(
                {
                    "email": str(payload.email),
                    "password": payload.password,
                    "options": {"data": {"full_name": payload.full_name}},
                }
            )
        except Exception as exc:
            logger.exception("Supabase signup failed for %s", payload.email)
            raise self._format_supabase_error(exc, action="signup", email=payload.email) from exc

        user_data = getattr(response, "user", None)
        if user_data is None:
            raise RuntimeError("Supabase signup did not return a user")

        self._sync_local_user(user_data, payload.full_name)
        return self._build_auth_response(user_data, getattr(response, "session", None))

    def login(self, payload: LoginRequest) -> AuthResponse:
        try:
            response = supabase.auth.sign_in_with_password(
                {"email": str(payload.email), "password": payload.password}
            )
        except Exception as exc:
            logger.exception("Supabase login failed for %s", payload.email)
            raise self._format_supabase_error(exc, action="login", email=payload.email) from exc

        user_data = getattr(response, "user", None)
        if user_data is None:
            raise RuntimeError("Supabase login did not return a user")

        self._sync_local_user(user_data)
        return self._build_auth_response(user_data, getattr(response, "session", None))

    def logout(self) -> LogoutResponse:
        supabase.auth.sign_out()
        return LogoutResponse(message="Logged out successfully")

    def me(self, access_token: Optional[str] = None) -> MeResponse:
        try:
            user_response = supabase.auth.get_user(access_token)
            user_data = user_response.user if user_response else None
            if user_data is None:
                raise RuntimeError("No authenticated user found")
        except Exception as exc:
            logger.exception("Supabase get_user failed")
            raise self._format_supabase_error(exc, action="me", email=None) from exc

        self._sync_local_user(user_data)
        return MeResponse(user=self._build_auth_user(user_data))

    def _sync_local_user(self, user_data: object, full_name: Optional[str] = None) -> None:
        user_id = getattr(user_data, "id", None)
        email = getattr(user_data, "email", None)
        if not user_id or not email:
            return

        existing = self.db.scalar(select(User).where(User.id == user_id))
        if existing is None:
            existing = User(
                id=user_id,
                email=email,
                full_name=full_name or getattr(user_data, "user_metadata", {}).get("full_name") or email,
                avatar_url=getattr(user_data, "avatar_url", None),
                is_active=True,
                is_superuser=False,
            )
            self.db.add(existing)
        else:
            existing.email = email
            existing.full_name = full_name or existing.full_name or getattr(user_data, "user_metadata", {}).get("full_name") or email
            existing.avatar_url = getattr(user_data, "avatar_url", None)
            existing.is_active = True

        self._ensure_default_preferences(existing)
        self.db.commit()

    def _ensure_default_preferences(self, user: User) -> None:
        existing_preference = self.db.scalar(select(UserPreference).where(UserPreference.user_id == user.id))
        if existing_preference is None:
            self.db.add(
                UserPreference(
                    user_id=user.id,
                    preferred_language="en",
                    preferred_currency="INR",
                    breed_display_preference="canonical",
                    show_local_names=True,
                )
            )

    def _build_auth_response(self, user_data: object, session: Optional[object] = None) -> AuthResponse:
        auth_user = self._build_auth_user(user_data)
        access_token = None
        if session is not None:
            access_token = getattr(session, "access_token", None)
        return AuthResponse(access_token=access_token, user=auth_user)

    def _format_supabase_error(self, exc: Exception, action: str, email: Optional[str]) -> RuntimeError:
        message = str(exc).strip()
        lowered = message.lower()

        if "rate limit" in lowered or "429" in lowered:
            detail = "Supabase auth is temporarily rate-limiting signups. Please wait a few minutes and try again."
        elif "invalid email" in lowered or "email address" in lowered and "invalid" in lowered:
            detail = "The supplied email address is invalid."
        elif "password" in lowered:
            detail = "The supplied password does not meet the current authentication requirements."
        elif "already" in lowered and "registered" in lowered:
            detail = "An account already exists for this email address."
        elif action == "me" and "jwt" in lowered:
            detail = "The provided authentication token is invalid or expired."
        else:
            detail = f"Supabase authentication failed during {action}."

        logger.warning("Supabase auth error for action=%s email=%s message=%s", action, email, message)
        return RuntimeError(detail)

    def _build_auth_user(self, user_data: object) -> AuthUser:
        user_metadata = getattr(user_data, "user_metadata", {}) or {}
        return AuthUser(
            id=str(getattr(user_data, "id", "")),
            email=str(getattr(user_data, "email", "")),
            full_name=user_metadata.get("full_name") or getattr(user_data, "full_name", None),
            avatar_url=getattr(user_data, "avatar_url", None),
            is_active=True,
            is_superuser=False,
        )


def get_auth_service(db: Optional[Session] = None) -> AuthService:
    return AuthService(db=db)
