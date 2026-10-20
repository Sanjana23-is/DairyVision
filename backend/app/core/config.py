import os
import json
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _db_url_from_env(primary_name: str, fallback: str) -> str:
    return (
        os.getenv(primary_name)
        or os.getenv("SUPABASE_DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or fallback
    )


def _list_from_env(primary_name: str, fallback: str) -> list[str]:
    raw = os.getenv(primary_name, fallback)
    if not raw:
        return []
    raw = raw.strip()
    if raw.startswith("[") and raw.endswith("]"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings(BaseSettings):
    app_name: str = Field(default="DairyVision AI Backend")
    app_env: Literal["development", "testing", "production"] = Field(default="development")
    app_debug: bool = Field(default_factory=lambda: os.getenv("APP_ENV", "development").lower() != "production")
    app_port: int = Field(default=8000)
    database_url: str = Field(default_factory=lambda: _db_url_from_env("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/dairyvision"))
    alembic_database_url: str = Field(default_factory=lambda: _db_url_from_env("ALEMBIC_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/dairyvision"))
    cors_origins: list[str] = Field(
        default_factory=lambda: _list_from_env(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173,http://localhost",
        )
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        origins: list[str] = []
        if isinstance(value, list):
            origins = [str(item).strip() for item in value if str(item).strip()]
        elif isinstance(value, str):
            raw = value.strip()
            if raw.startswith("[") and raw.endswith("]"):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        origins = [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            if not origins:
                origins = [item.strip() for item in raw.split(",") if item.strip()]

        # Ensure localhost:3000 is always present as base development origin
        fallback_origin = "http://localhost:3000"
        if fallback_origin not in origins:
            origins.insert(0, fallback_origin)
        return origins
    log_level: str = Field(default="INFO")
    supabase_url: str = Field(default="")
    supabase_publishable_key: str = Field(default="")
    supabase_secret_key: str = Field(default="")
    supabase_jwt_secret: str = Field(default_factory=lambda: os.getenv("SUPABASE_JWT_SECRET", os.getenv("JWT_SECRET", "")))
    frontend_url: str = Field(default_factory=lambda: os.getenv("FRONTEND_URL", "http://localhost:3000"))

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
