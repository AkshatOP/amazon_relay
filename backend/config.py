"""Central configuration for Amazon Relay.

Loads the Gemini API key from the environment (or a local .env) and centralizes the
model name so it's swappable in one place.
"""
from __future__ import annotations

import os
from pathlib import Path

try:
    # Optional: load a local .env if python-dotenv is installed.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv is optional
    pass

# --- Paths -------------------------------------------------------------------
# config.py lives in backend/, so the project root is one level up.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SKILL_PATH = PROJECT_ROOT / "skills" / "grading_skill.md"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# --- Gemini ------------------------------------------------------------------
# Read the API key from env. The google-genai Client also reads GEMINI_API_KEY
# automatically, but we expose it here for a clear startup error message.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Current vision-capable Gemini model. Swap here to change everywhere.
# (Verified against the google-genai docs; gemini-2.5-flash is a stable multimodal model.)
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Generation settings used by the grading agent.
REQUEST_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT", "60"))


def has_api_key() -> bool:
    return bool(GEMINI_API_KEY.strip())
