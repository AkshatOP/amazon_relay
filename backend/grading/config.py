"""Grading-scoped configuration.

Shared infra (Gemini key/model, .env, project paths) comes from backend.core.config — this
file only holds grading-specific settings. The grading agent imports the Gemini CLIENT from
backend.core.gemini; it reads the model name and skill path from here / core.
"""
from __future__ import annotations

from backend.core.config import (  # re-exported for callers that do `config.X`
    GEMINI_API_KEY,
    GEMINI_MODEL,
    REQUEST_TIMEOUT_SECONDS,
    SKILL_PATH,
    FRONTEND_DIR,
    BACKEND_DIR,
    has_api_key,
)

# Grading-scoped knobs (retry/backoff live in grading_agent.py; add tunables here as needed).
MAX_GRADE_RETRIES = 3

# Catalog reference images live here. Files are keyed by ASIN: catalog_images/<asin>.jpg
# (drop the studio/catalog photo in by hand for the demo; in prod this comes from the
# Amazon catalog CDN keyed by the order-history SKU). See catalog.py + seed/seed_catalog.py.
CATALOG_DIR = BACKEND_DIR / "catalog_images"

__all__ = [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "REQUEST_TIMEOUT_SECONDS",
    "SKILL_PATH",
    "FRONTEND_DIR",
    "BACKEND_DIR",
    "CATALOG_DIR",
    "has_api_key",
    "MAX_GRADE_RETRIES",
]
