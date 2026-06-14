"""Relay HUB — THE single FastAPI app.

One app, one port. Mounts every domain's APIRouter:
  grading  → POST /grade, POST /grade/functional
  routing  → POST /route, POST /grade-and-route
  p2p      → GET/POST /p2p/*

Run from the repo root:
    uvicorn backend.main:app --reload

Swagger (/docs) covers every endpoint across all three domains.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core import config as core_config
from backend.core import db as core_db
from backend.grading.router import router as grading_router
from backend.routing.router import router as routing_router
from backend.routing import config as routing_config
from backend.p2p.router import router as p2p_router

app = FastAPI(title="Relay HUB API", version="1.0.0")

# CORS wide open for local dev / demo (the React app on :5173 calls this).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the three domains. Routers are thin; all logic lives in the domain packages.
app.include_router(grading_router)
app.include_router(routing_router)
app.include_router(p2p_router)


@app.get("/")
def index():
    """API root — the UI is the React app in frontend_react/. See /docs for all endpoints."""
    return {"service": "Relay HUB API", "ui": "frontend_react (Vite/React)", "docs": "/docs"}


@app.get("/health")
def health():
    """Aggregate health across all three domains."""
    return {
        "status": "ok",
        "modules": ["grading", "routing", "p2p"],
        "model": core_config.GEMINI_MODEL,
        "api_key_present": core_config.has_api_key(),
        "db_ready": core_config.DB_PATH.exists(),
        "router_model_trained": routing_config.MODEL_PATH.exists(),
    }


@app.get("/metrics")
def metrics():
    """App-level aggregate for the dashboard — real lifetime figures from the one DB.

    Cross-domain read (returns_log + listings), so it lives at the app level, not in a
    single domain router. Never raises; returns zeros on an empty/missing DB.
    """
    out = {
        "co2_saved_kg": 0.0, "money_saved_inr": 0.0, "returns_routed": 0,
        "active_listings": 0, "active_listing_value_inr": 0.0,
        "decision_breakdown": {},
    }
    try:
        conn = core_db.get_connection(row_factory=False)
        row = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(savings_local),0), COALESCE(SUM(co2_saved_kg),0) FROM returns_log"
        ).fetchone()
        out["returns_routed"] = row[0] or 0
        out["money_saved_inr"] = round(row[1] or 0.0, 2)
        out["co2_saved_kg"] = round(row[2] or 0.0, 4)
        for d, n in conn.execute("SELECT decision, COUNT(*) FROM returns_log GROUP BY decision").fetchall():
            out["decision_breakdown"][d] = n
        lrow = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(asking_price),0) FROM listings WHERE status='active'"
        ).fetchone()
        out["active_listings"] = lrow[0] or 0
        out["active_listing_value_inr"] = round(lrow[1] or 0.0, 2)
        conn.close()
    except Exception as exc:
        out["error"] = str(exc)
    return out
