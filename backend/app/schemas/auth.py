from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.split("@", 1)[1]:
            raise ValueError("email must be a valid email address")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.strip()) < 8:
            raise ValueError("password must be at least 8 characters long")
        return value

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("full_name is required")
        return normalized


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or "." not in normalized.split("@", 1)[1]:
            raise ValueError("email must be a valid email address")
        return normalized


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            normalized = value.strip()
            if not normalized:
                raise ValueError("full_name cannot be empty")
            return normalized
        return value


class AuthUser(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: AuthUser


class LogoutResponse(BaseModel):
    message: str


class MeResponse(BaseModel):
    user: AuthUser
