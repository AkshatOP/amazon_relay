"""Amazon Relay — Routing API (Phase 3). SEPARATE FastAPI app on PORT 8100.

The grading API owns port 8000 and is untouched. Run:
    uvicorn routing.route_api:app --reload --port 8100
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config
from .explainer import explain_decision
from .router import route_return
from .seed_locations import ACTIVE_REGION, REGIONS

app = FastAPI(title="Amazon Relay — Routing API", version="0.1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

GRADING_URL = "http://localhost:8000/grade"


# --- Request models ----------------------------------------------------------

class OrderMeta(BaseModel):
    order_id: str = "ORD-DEMO"
    asin: str = ""
    product_name: str = "Demo Product"
    category: str = "footwear"
    original_price: float = 2000
    # age_months removed — returns are treated as new units at full original_price.
    # Age/depreciation pricing belongs in the future peer-to-peer exchange product.
    customer_lat: float = 12.9166
    customer_lng: float = 77.6101
    # Optional region selector. "bengaluru" or "udupi". Defaults to ACTIVE_REGION when absent.
    region: Optional[str] = Field(default=None, description="Routing region: 'bengaluru' or 'udupi'")


class RouteRequest(BaseModel):
    grade_json: dict[str, Any]
    order_meta: OrderMeta


class GradeAndRouteRequest(BaseModel):
    order_meta: OrderMeta
    # Optional pre-supplied grade, used if the grading service (:8000) is unreachable.
    grade_json: Optional[dict[str, Any]] = Field(default=None)


# --- Decision logging --------------------------------------------------------

def _log_decision(order_meta: dict, grade_json: dict, routing: dict) -> None:
    if not config.DB_PATH.exists():
        return
    try:
        econ = routing.get("economics", {})
        conn = sqlite3.connect(config.DB_PATH)
        conn.execute(
            "INSERT INTO returns_log (ts, order_id, asin, category, grade, decision, decided_by, "
            "resale_price, savings_local, co2_saved_kg, buyer_found) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                datetime.now(timezone.utc).isoformat(),
                order_meta.get("order_id"), order_meta.get("asin"), order_meta.get("category"),
                grade_json.get("grade"), routing.get("decision"), routing.get("decided_by"),
                econ.get("resale_price"), econ.get("savings_if_local"), econ.get("co2_saved_kg"),
                int(routing.get("match", {}).get("buyer_found", False)),
            ),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # logging must never break a routing response


# --- Endpoints ---------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "routing",
        "port": 8100,
        "model_trained": config.MODEL_PATH.exists(),
        "db_ready": config.DB_PATH.exists(),
    }


@app.post("/route")
def route(req: RouteRequest):
    meta = req.order_meta.model_dump()
    region_note = None
    region_raw = (meta.get("region") or "").strip().lower()
    if region_raw and region_raw not in REGIONS:
        region_note = f"Unknown region '{region_raw}'; defaulting to '{ACTIVE_REGION}'."
        meta["region"] = None
    routing = route_return(req.grade_json, meta)
    routing["explanation"] = explain_decision(routing)
    if region_note:
        routing["region_note"] = region_note
    _log_decision(meta, req.grade_json, routing)
    return routing


@app.post("/grade-and-route")
async def grade_and_route(req: GradeAndRouteRequest):
    """Proxy to the grading service (:8000), then route. Falls back to a supplied grade_json."""
    meta = req.order_meta.model_dump()
    grade_json = req.grade_json
    grade_source = "supplied"
    region_raw = (meta.get("region") or "").strip().lower()
    if region_raw and region_raw not in REGIONS:
        meta["region"] = None

    # We can only call the grading service if we actually have images; this JSON endpoint does
    # not carry image bytes, so it expects a pre-supplied grade_json. We still ping :8000/health
    # so the demo can show whether the grader is alive.
    if grade_json is None:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get("http://localhost:8000/health")
                alive = r.status_code == 200
        except Exception:
            alive = False
        return {
            "error": "no grade_json supplied and image grading must go through :8000/grade (multipart).",
            "grading_service_alive": alive,
            "hint": "POST multipart images to http://localhost:8000/grade, then send the result here as grade_json.",
        }

    routing = route_return(grade_json, meta)
    routing["explanation"] = explain_decision(routing)
    routing["grade_source"] = grade_source
    _log_decision(meta, grade_json, routing)
    return routing
