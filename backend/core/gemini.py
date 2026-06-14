"""The ONE Gemini client / key loader.

Grading (backend/grading/grading_agent.py) and the routing explainer
(backend/routing/explainer.py) both build their Gemini calls through this module — there is
no per-module key loading anymore. The SDK objects (`genai`, `types`) are re-exported so
callers don't import google-genai directly.

Never raises at import time: if the SDK is missing, `genai`/`types` are None and callers fall
back to their structured-error / templated paths.
"""
from __future__ import annotations

from functools import lru_cache

from . import config

try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover - surfaced as a clear runtime error by get_client()
    genai = None
    types = None

# Re-export the configured model name for convenience.
MODEL = config.GEMINI_MODEL


def has_api_key() -> bool:
    return config.has_api_key()


def sdk_available() -> bool:
    return genai is not None


@lru_cache(maxsize=1)
def get_client():
    """Build a cached google-genai client. Raises RuntimeError if SDK/key unavailable."""
    if genai is None:
        raise RuntimeError(
            "google-genai SDK not installed. Run: pip install -r requirements.txt"
        )
    if not config.has_api_key():
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Export it or put it in a .env file."
        )
    # The client also reads GEMINI_API_KEY from the env; pass explicitly to be safe.
    return genai.Client(api_key=config.GEMINI_API_KEY)
