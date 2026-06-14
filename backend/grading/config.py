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
    has_api_key,
)

# Grading-scoped knobs (retry/backoff live in grading_agent.py; add tunables here as needed).
MAX_GRADE_RETRIES = 3

__all__ = [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "REQUEST_TIMEOUT_SECONDS",
    "SKILL_PATH",
    "FRONTEND_DIR",
    "has_api_key",
    "MAX_GRADE_RETRIES",
]
