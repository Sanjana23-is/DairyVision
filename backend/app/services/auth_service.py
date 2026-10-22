from __future__ import annotations

import logging
import time
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.supabase import supabase
from app.database.session import SessionLocal
from app.exceptions import AuthError, AuthServiceUnavailable, AuthUnauthorized, AuthRateLimitExceeded
from app.models.user import User
from app.models.user_preference import UserPreference
from app.schemas.auth import AuthResponse, AuthUser, LoginRequest, LogoutResponse, MeResponse, SignupRequest


logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Optional[Session] = None) -> None:
        self.db = db or SessionLocal()

    def signup(self, payload: SignupRequest) -> AuthResponse:
        email_str = str(payload.email).strip().lower()
        try:
            user_data = None
            try:
                admin_response = supabase.auth.admin.create_user(
                    {
                        "email": email_str,
                        "password": payload.password,
                        "email_confirm": True,
                        "user_metadata": {"full_name": payload.full_name},
                    }
                )
                user_data = getattr(admin_response, "user", None)
            except Exception as admin_exc:
                admin_msg = str(admin_exc).lower()
                if "already" in admin_msg and "registered" in admin_msg:
                    raise self._format_supabase_error(admin_exc, action="signup", email=email_str) from admin_exc
                logger.warning("Admin create_user fallback to sign_up: %s", admin_exc)
                response = supabase.auth.sign_up(
                    {
                        "email": email_str,
                        "password": payload.password,
                        "options": {"data": {"full_name": payload.full_name}},
                    }
                )
                user_data = getattr(response, "user", None)
                if user_data:
                    try:
                        supabase.auth.admin.update_user_by_id(user_data.id, {"email_confirm": True})
                    except Exception:
                        pass

            if user_data is None:
                raise RuntimeError("Supabase signup did not return a user")

            self._sync_local_user(user_data, payload.full_name)

            # Sign in immediately with password to obtain active access_token session
            session = None
            try:
                sign_in_res = supabase.auth.sign_in_with_password(
                    {"email": email_str, "password": payload.password}
                )
                session = getattr(sign_in_res, "session", None)
            except Exception as sign_in_exc:
                logger.warning("Immediate post-signup sign_in failed: %s", sign_in_exc)

            return self._build_auth_response(user_data, session)
        except Exception as exc:
            logger.exception("Supabase signup failed for %s", email_str)
            raise self._format_supabase_error(exc, action="signup", email=email_str) from exc

    def login(self, payload: LoginRequest) -> AuthResponse:
        email_str = str(payload.email).strip().lower()
        try:
            try:
                response = supabase.auth.sign_in_with_password(
                    {"email": email_str, "password": payload.password}
                )
            except Exception as login_exc:
                if "email not confirmed" in str(login_exc).lower():
                    logger.info("User %s email not confirmed in Supabase. Attempting auto-confirmation...", email_str)
                    try:
                        admin_users = supabase.auth.admin.list_users()
                        target = next((u for u in admin_users if u.email and u.email.lower() == email_str), None)
                        if target:
                            supabase.auth.admin.update_user_by_id(target.id, {"email_confirm": True})
                            response = supabase.auth.sign_in_with_password(
                                {"email": email_str, "password": payload.password}
                            )
                        else:
                            raise login_exc
                    except Exception:
                        raise login_exc
                else:
                    raise login_exc
        except Exception as exc:
            logger.exception("Supabase login failed for %s", email_str)
            raise self._format_supabase_error(exc, action="login", email=email_str) from exc

        user_data = getattr(response, "user", None)
        if user_data is None:
            raise RuntimeError("Supabase login did not return a user")

        self._sync_local_user(user_data)

        # Enforce account active status
        db_user = self.db.scalar(select(User).where(User.id == str(user_data.id)))
        if db_user and not db_user.is_active:
            raise AuthUnauthorized("This account has been deactivated.")

        return self._build_auth_response(user_data, getattr(response, "session", None))

    def logout(self) -> LogoutResponse:
        supabase.auth.sign_out()
        return LogoutResponse(message="Logged out successfully")

    def send_password_reset(self, email: str, redirect_to: Optional[str] = None) -> None:
        """Send a password reset email via Supabase with redirect_to. Raises on failure."""
        from app.core.config import get_settings
        settings = get_settings()

        email_str = email.strip().lower()
        target_redirect = None
        if redirect_to:
            redirect_clean = redirect_to.strip()
            allowed_origins = [o.rstrip("/") for o in settings.cors_origins] + [settings.frontend_url.rstrip("/")]
            if any(redirect_clean.startswith(origin) for origin in allowed_origins):
                target_redirect = redirect_clean

        if not target_redirect:
            target_redirect = f"{settings.frontend_url.rstrip('/')}/reset-password"

        try:
            supabase.auth.reset_password_email(email_str, options={"redirect_to": target_redirect})
        except Exception as exc:
            logger.warning("Password reset email failed for %s: %s", email_str, exc)
            status_code = getattr(exc, "status", None) or getattr(getattr(exc, "response", None), "status_code", None)
            lowered = str(exc).lower()
            if status_code == 429 or "rate limit" in lowered or "429" in lowered or "too many requests" in lowered:
                raise AuthRateLimitExceeded("Email rate limit exceeded. Please wait a few minutes before trying again.") from exc
            raise self._format_supabase_error(exc, action="reset_password_email", email=email_str) from exc

    def update_password(self, user_id: str, new_password: str) -> None:
        """Update a user's password in Supabase Auth via admin API."""
        if not new_password or len(new_password.strip()) < 8:
            raise AuthUnauthorized("Password must be at least 8 characters long.")

        db_user = self.db.scalar(select(User).where(User.id == user_id))
        if db_user and not db_user.is_active:
            raise AuthUnauthorized("This account has been deactivated.")

        try:
            supabase.auth.admin.update_user_by_id(user_id, {"password": new_password})
        except Exception as exc:
            logger.exception("Supabase admin update_user_by_id failed for user %s", user_id)
            raise self._format_supabase_error(exc, action="reset_password", email=None) from exc

    @staticmethod
    def _is_transient_error(exc: Exception) -> bool:
        message = str(exc).lower()
        exc_type = type(exc).__name__.lower()

        if any(keyword in exc_type for keyword in ("remoteprotocol", "connect", "timeout", "network", "gaierror")):
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
            "connection refused",
            "failed to establish a new connection",
            "temporary failure in name resolution",
            "nodename nor servname provided",
            "network is unreachable",
            "tenant not found",
            "project not found",
        )
        if any(keyword in message for keyword in transient_keywords):
            return True

        # Note: 429 is rate-limiting, NOT a transient network glitch, so it should not be retried in a tight loop.
        status_code = getattr(exc, "status", None) or getattr(getattr(exc, "response", None), "status_code", None)
        if status_code in (500, 502, 503, 504):
            return True

        return False

    def me(self, access_token: Optional[str] = None) -> MeResponse:
        if not access_token:
            raise AuthUnauthorized("No authentication token provided")

        from app.core.config import get_settings
        settings = get_settings()
        jwt_secret = settings.supabase_jwt_secret

        # Fast path: In-memory cryptographic JWT verification (< 1ms, zero network calls)
        if jwt_secret:
            try:
                import jwt as pyjwt

                payload = pyjwt.decode(
                    access_token,
                    key=jwt_secret,
                    algorithms=["HS256"],
                    options={"verify_exp": True, "verify_aud": False},
                )
                user_id = payload.get("sub")
                email = payload.get("email")
                if user_id and email:
                    # Enforce account active status
                    db_user = self.db.scalar(select(User).where(User.id == str(user_id)))
                    if db_user and not db_user.is_active:
                        raise AuthUnauthorized("This account has been deactivated.")

                    user_meta = payload.get("user_metadata", {}) or {}

                    class _JWTPayloadUser:
                        def __init__(self, uid: str, em: str, meta: dict, active: bool = True):
                            self.id = uid
                            self.email = em
                            self.user_metadata = meta
                            self.avatar_url = meta.get("avatar_url")
                            self.is_active = active
                            self.is_superuser = False

                    user_data = _JWTPayloadUser(str(user_id), str(email), user_meta, db_user.is_active if db_user else True)
                    self._sync_local_user(user_data)
                    return MeResponse(user=self._build_auth_user(user_data))
            except AuthUnauthorized:
                raise
            except pyjwt.ExpiredSignatureError:
                raise AuthUnauthorized("The provided authentication token is invalid or expired.")
            except pyjwt.PyJWTError as jwt_err:
                logger.debug("Local JWT verification failed, falling back to remote Supabase auth: %s", jwt_err)
            except Exception as e:
                logger.debug("Unexpected local JWT error, falling back to remote Supabase auth: %s", e)

        # Fallback path: Remote verification via Supabase API (used when secret unset, mock tests, or JWKS)
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
        db_user = self.db.scalar(select(User).where(User.id == str(user_data.id)))
        if db_user and not db_user.is_active:
            raise AuthUnauthorized("This account has been deactivated.")
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

        name_candidate = full_name or getattr(user_data, "user_metadata", {}).get("full_name")
        if not name_candidate or str(name_candidate).strip() == email or "@" in str(name_candidate):
            clean_name = "Farmer"
        else:
            clean_name = str(name_candidate).strip()

        if existing is None:
            existing = User(
                id=user_id,
                email=email,
                full_name=clean_name,
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

            current_name = existing.full_name
            if not current_name or current_name == email or "@" in current_name:
                existing.full_name = clean_name
                has_changes = True
            elif full_name and full_name.strip() and full_name.strip() != current_name and "@" not in full_name:
                existing.full_name = full_name.strip()
                has_changes = True

            expected_avatar_url = getattr(user_data, "avatar_url", None)
            if existing.avatar_url != expected_avatar_url:
                existing.avatar_url = expected_avatar_url
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

        status_code = getattr(exc, "status", None) or getattr(getattr(exc, "response", None), "status_code", None)
        if status_code == 429 or "rate limit" in lowered or "429" in lowered or "too many requests" in lowered:
            detail = "Email rate limit exceeded. Please wait a few minutes before trying again."
            logger.warning("Supabase rate limit for action=%s email=%s message=%s", action, email, message)
            return AuthRateLimitExceeded(detail)

        if self._is_transient_error(exc):
            detail = "Authentication service is temporarily unavailable. Please try again."
            logger.warning("Supabase transient auth error for action=%s email=%s message=%s", action, email, message)
            return AuthServiceUnavailable(detail)
        elif "invalid email" in lowered or ("email address" in lowered and "invalid" in lowered):
            detail = "The supplied email address is invalid."
        elif "invalid login credentials" in lowered or "invalid credentials" in lowered:
            detail = "The supplied email address or password is incorrect."
            return AuthUnauthorized(detail)
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

        email_str = str(getattr(user_data, "email", ""))
        raw_name = (
            (db_user.full_name if db_user and db_user.full_name else None)
            or user_metadata.get("full_name")
            or getattr(user_data, "full_name", None)
        )
        if not raw_name or str(raw_name).strip() == email_str or "@" in str(raw_name) or str(raw_name).strip() == "":
            full_name = "Farmer"
        else:
            full_name = str(raw_name).strip()

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
