from __future__ import annotations

import logging
import time
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.supabase import supabase
from app.database.session import SessionLocal
from app.exceptions import AuthError, AuthServiceUnavailable, AuthUnauthorized
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

    @staticmethod
    def _is_transient_error(exc: Exception) -> bool:
        message = str(exc).lower()
        exc_type = type(exc).__name__.lower()

        if any(keyword in exc_type for keyword in ("remoteprotocol", "connect", "timeout", "network")):
            return True

        transient_keywords = (
            "server disconnected",
            "connection closed",
            "connection reset",
            "remote host closed",
            "timed out",
            "timeout",
            "service unavailable",
            "502",
            "503",
            "504",
        )
        if any(keyword in message for keyword in transient_keywords):
            return True

        status_code = getattr(exc, "status", None) or getattr(getattr(exc, "response", None), "status_code", None)
        if status_code in (429, 500, 502, 503, 504):
            return True

        return False

    def me(self, access_token: Optional[str] = None) -> MeResponse:
        user_response = None
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                user_response = supabase.auth.get_user(access_token)
                break
            except Exception as exc:
                if self._is_transient_error(exc) and attempt < max_retries:
                    logger.warning("Transient Supabase error on attempt %d: %s. Retrying...", attempt + 1, exc)
                    time.sleep(0.1 * (attempt + 1))
                    continue
                logger.exception("Supabase get_user failed")
                raise self._format_supabase_error(exc, action="me", email=None) from exc

        user_data = user_response.user if user_response else None
        if user_data is None:
            raise AuthUnauthorized("No authenticated user found")

        self._sync_local_user(user_data)
        return MeResponse(user=self._build_auth_user(user_data))

    def _sync_local_user(self, user_data: object, full_name: Optional[str] = None) -> None:
        user_id = getattr(user_data, "id", None)
        email = getattr(user_data, "email", None)
        if not user_id or not email:
            # pyrefly: ignore [invalid-syntax]
            return

        has_changes = False

        existing = self.db.scalar(select(User).where(User.id == user_id))

        if existing is None:
            existing = self.db.scalar(select(User).where(User.email == email))
            if existing is not None:
                self._migrate_user_id(existing.id, user_id, email)
                existing = self.db.scalar(select(User).where(User.id == user_id))
                has_changes = True

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
            has_changes = True
        else:
            if existing.email != email:
                existing.email = email
                has_changes = True

            expected_full_name = (
                full_name
                or existing.full_name
                or getattr(user_data, "user_metadata", {}).get("full_name")
                or email
            )
            if existing.full_name != expected_full_name:
                existing.full_name = expected_full_name
                has_changes = True

            expected_avatar_url = getattr(user_data, "avatar_url", None)
            if existing.avatar_url != expected_avatar_url:
                existing.avatar_url = expected_avatar_url
                has_changes = True

            if not existing.is_active:
                existing.is_active = True
                has_changes = True

        pref_created = self._ensure_default_preferences(existing)

        if has_changes or pref_created:
            self.db.commit()

    def _ensure_default_preferences(self, user: User) -> bool:
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
            return True
        return False

    def _migrate_user_id(self, old_id: str, new_id: str, email: str) -> None:
        from sqlalchemy import update, delete
        from app.models import (
            User, Farm, Cow, MilkPrediction, DailyObservation, ActivityLog,
            FarmMember, WeatherLog, UserPreference, HealthAlert, Recommendation
        )

        # 1. Update old user's email to a temporary email to satisfy the UNIQUE constraint
        self.db.execute(
            update(User)
            .where(User.id == old_id)
            .values(email=f"{email}_temp_sync")
        )

        # 2. Get old user metadata using ORM
        old_user = self.db.get(User, old_id)
        if not old_user:
            return

        # 3. Insert new user record with the new ID
        new_user = User(
            id=new_id,
            email=email,
            full_name=old_user.full_name,
            avatar_url=old_user.avatar_url,
            is_active=old_user.is_active,
            is_superuser=old_user.is_superuser
        )
        self.db.add(new_user)
        self.db.flush()

        # 4. Update all dependent tables referencing the user ID using SQLAlchemy update construct
        updates = [
            (Farm, Farm.created_by),
            (Cow, Cow.created_by),
            (Cow, Cow.owner_id),
            (MilkPrediction, MilkPrediction.owner_id),
            (DailyObservation, DailyObservation.observed_by),
            (DailyObservation, DailyObservation.owner_id),
            (ActivityLog, ActivityLog.user_id),
            (ActivityLog, ActivityLog.owner_id),
            (FarmMember, FarmMember.user_id),
            (FarmMember, FarmMember.invited_by),
            (WeatherLog, WeatherLog.owner_id),
            (UserPreference, UserPreference.user_id),
            (HealthAlert, HealthAlert.owner_id),
            (Recommendation, Recommendation.owner_id),
        ]

        for model, column in updates:
            try:
                self.db.execute(
                    update(model)
                    .where(column == old_id)
                    .values({column.key: new_id})
                )
            except Exception as e:
                logger.warning("Failed to update user ID in table %s: %s", model.__tablename__, str(e))

        # 5. Delete old user preference record if it exists
        try:
            self.db.execute(
                delete(UserPreference).where(UserPreference.user_id == old_id)
            )
        except Exception:
            pass

        # 6. Delete old user record
        self.db.delete(old_user)
        self.db.flush()

    def _build_auth_response(self, user_data: object, session: Optional[object] = None) -> AuthResponse:
        auth_user = self._build_auth_user(user_data)
        access_token = None
        if session is not None:
            access_token = getattr(session, "access_token", None)
        return AuthResponse(access_token=access_token, user=auth_user)

    def _format_supabase_error(self, exc: Exception, action: str, email: Optional[str]) -> Exception:
        message = str(exc).strip()
        lowered = message.lower()

        if self._is_transient_error(exc):
            detail = "Authentication service is temporarily unavailable. Please try again."
            logger.warning("Supabase transient auth error for action=%s email=%s message=%s", action, email, message)
            return AuthServiceUnavailable(detail)

        if "rate limit" in lowered or "429" in lowered:
            detail = "Supabase auth is temporarily rate-limiting signups. Please wait a few minutes and try again."
            return AuthServiceUnavailable(detail)
        elif "invalid email" in lowered or ("email address" in lowered and "invalid" in lowered):
            detail = "The supplied email address is invalid."
        elif "password" in lowered:
            detail = "The supplied password does not meet the current authentication requirements."
        elif "already" in lowered and "registered" in lowered:
            detail = "An account already exists for this email address."
        elif "jwt" in lowered or "expired" in lowered or "invalid claims" in lowered or "signature" in lowered:
            detail = "The provided authentication token is invalid or expired."
            logger.warning("Supabase auth error for action=%s email=%s message=%s", action, email, message)
            return AuthUnauthorized(detail)
        else:
            detail = f"Supabase authentication failed during {action}."

        logger.warning("Supabase auth error for action=%s email=%s message=%s", action, email, message)
        return AuthUnauthorized(detail)

    def update_profile(self, user_id: str, full_name: str) -> AuthUser:
        db_user = self.db.scalar(select(User).where(User.id == user_id))
        if db_user is None:
            raise AuthUnauthorized("User not found")

        db_user.full_name = full_name.strip()
        self.db.commit()
        self.db.refresh(db_user)

        return AuthUser(
            id=db_user.id,
            email=db_user.email,
            full_name=db_user.full_name,
            avatar_url=db_user.avatar_url,
            is_active=db_user.is_active,
            is_superuser=db_user.is_superuser,
        )

    def _build_auth_user(self, user_data: object) -> AuthUser:
        user_id = str(getattr(user_data, "id", ""))
        db_user = self.db.scalar(select(User).where(User.id == user_id)) if user_id else None

        user_metadata = getattr(user_data, "user_metadata", {}) or {}
        full_name = (
            (db_user.full_name if db_user and db_user.full_name else None)
            or user_metadata.get("full_name")
            or getattr(user_data, "full_name", None)
        )

        return AuthUser(
            id=user_id,
            email=str(getattr(user_data, "email", "")),
            full_name=full_name,
            avatar_url=getattr(user_data, "avatar_url", None),
            is_active=db_user.is_active if db_user else True,
            is_superuser=db_user.is_superuser if db_user else False,
        )


def get_auth_service(db: Optional[Session] = None) -> AuthService:
    return AuthService(db=db)
