from __future__ import annotations

import logging
from typing import Any, Optional

from supabase import Client, create_client

from .config import get_settings

logger = logging.getLogger(__name__)


class _LazySupabaseClient:
    """A lazy proxy for the Supabase Client.

    Defers client initialization until an attribute is accessed, preventing
    import-time crashes when SUPABASE_URL / SUPABASE_SECRET_KEY are missing.
    In testing or offline environments, it falls back to safe dummy credentials
    so that unit tests and offline workflows run without network barriers.
    """

    def __init__(self) -> None:
        self._client: Optional[Client] = None

    def _init_client(self) -> Client:
        if self._client is None:
            settings = get_settings()
            url = (settings.supabase_url or "").strip()
            key = (settings.supabase_secret_key or settings.supabase_publishable_key or "").strip()

            if not url or not key:
                logger.debug(
                    "Supabase credentials not configured in environment. "
                    "Using local fallback client for offline/testing mode."
                )
                url = url or "https://offline-fallback.supabase.co"
                key = key or "dummy-secret-key-offline"

            self._client = create_client(url, key)
        return self._client

    def __getattr__(self, name: str) -> Any:
        return getattr(self._init_client(), name)

    def is_configured(self) -> bool:
        """Returns True if valid Supabase credentials exist in settings."""
        settings = get_settings()
        url = (settings.supabase_url or "").strip()
        key = (settings.supabase_secret_key or settings.supabase_publishable_key or "").strip()
        return bool(url and key and "offline-fallback" not in url)


def get_supabase_client() -> Client:
    """Helper function to obtain the underlying Supabase Client."""
    return supabase._init_client()


# Export lazy proxy singleton matching the original 'supabase' signature
supabase: Any = _LazySupabaseClient()
