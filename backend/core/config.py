"""The single settings loader for Amazon Relay.

Loads ONE root .env and exposes the SHARED infrastructure settings every domain needs:
the Gemini key/model and the path to the one consolidated SQLite database.

Domain-specific constants do NOT live here — each domain keeps its own scoped config.py
(grading retry params, routing fuel/vehicle/radius, p2p vehicles/credit rate). Only the
truly shared things (Gemini key/model, DB path, project paths, .env) are centralized here.
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
# This file is backend/core/config.py, so the project root is three levels up.
CORE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CORE_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

# The ONE consolidated database. Every domain + every seeder points here.
DATA_DIR = BACKEND_DIR / "data"
DB_PATH = DATA_DIR / "relay.db"

# Static demo-UI directories (served / referenced by the single app).
FRONTEND_DIR = PROJECT_ROOT / "frontend"
FRONTEND_ROUTING_DIR = PROJECT_ROOT / "frontend_routing"
FRONTEND_P2P_DIR = PROJECT_ROOT / "frontend_p2p"

# Grading skill / rubric (loaded by the grading agent as a system instruction).
SKILL_PATH = PROJECT_ROOT / "skills" / "grading_skill.yaml"

# --- Gemini (shared by grading agent + routing explainer) --------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Current vision-capable Gemini model. Swap here to change everywhere.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
REQUEST_TIMEOUT_SECONDS = int(os.getenv("GEMINI_TIMEOUT", "60"))


def has_api_key() -> bool:
    return bool(GEMINI_API_KEY.strip())
