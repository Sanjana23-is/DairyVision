import os
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _db_url_from_env(primary_name: str, fallback: str) -> str:
    return (
        os.getenv(primary_name)
        or os.getenv("SUPABASE_DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or fallback
    )


class Settings(BaseSettings):
    app_name: str = Field(default="DairyVision AI Backend")
    app_env: Literal["development", "testing", "production"] = Field(default="development")
    app_debug: bool = Field(default=True)
    app_port: int = Field(default=8000)
    database_url: str = Field(default_factory=lambda: _db_url_from_env("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/dairyvision"))
    alembic_database_url: str = Field(default_factory=lambda: _db_url_from_env("ALEMBIC_DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/dairyvision"))
    log_level: str = Field(default="INFO")
    supabase_url: str = Field(default="")
    supabase_publishable_key: str = Field(default="")
    supabase_secret_key: str = Field(default="")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
