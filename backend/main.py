"""Amazon Relay — THE single FastAPI app.

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
from fastapi.responses import FileResponse, JSONResponse

from backend.core import config as core_config
from backend.grading.router import router as grading_router
from backend.routing.router import router as routing_router
from backend.routing import config as routing_config
from backend.p2p.router import router as p2p_router

app = FastAPI(title="Amazon Relay API", version="1.0.0")

# CORS wide open for local dev / demo (the three static demo UIs call this from other ports).
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

INDEX_HTML = core_config.FRONTEND_DIR / "index.html"


@app.get("/")
def index():
    """Serve the grading demo UI for convenience (the other two UIs serve statically)."""
    if INDEX_HTML.exists():
        return FileResponse(INDEX_HTML)
    return JSONResponse({"error": "frontend/index.html not found"}, status_code=404)


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
