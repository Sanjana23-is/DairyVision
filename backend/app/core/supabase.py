from __future__ import annotations

from supabase import Client, create_client

from .config import get_settings


def _create_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_secret_key)


supabase: Client = _create_supabase_client()
