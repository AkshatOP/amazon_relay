"""Routing APIRouter — thin wrappers over the routing decision logic.

Mounted at the app root by backend/main.py. Endpoints:
  POST /route            — route a pre-graded return
  POST /grade-and-route  — route a supplied grade_json (in-process; no HTTP hop)

The decision logic lives in router_logic.py (hard gates + XGBoost). This file only parses
the request, calls route_return(), attaches the explainer narrative, logs, and responds.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.core import db as core_db
from . import config
from .explainer import explain_decision
from .router_logic import route_return, intercept_decision
from .seed_locations import ACTIVE_REGION, REGIONS

router = APIRouter(tags=["routing"])


# --- Request models ----------------------------------------------------------

class OrderMeta(BaseModel):
    order_id: str = "ORD-DEMO"
    asin: str = ""
    product_name: str = "Demo Product"
    category: str = "footwear"
    original_price: float = 2000
    # age_months removed — returns are treated as new units at full original_price.
    # Age/depreciation pricing belongs in the P2P exchange product.
    customer_lat: float = 12.9166
    customer_lng: float = 77.6101
    # Optional region selector. "bengaluru" or "udupi". Defaults to ACTIVE_REGION when absent.
    region: Optional[str] = Field(default=None, description="Routing region: 'bengaluru' or 'udupi'")


class RouteRequest(BaseModel):
    grade_json: dict[str, Any]
    order_meta: OrderMeta


class GradeAndRouteRequest(BaseModel):
    order_meta: OrderMeta
    # Pre-supplied grade. Image grading goes through POST /grade (multipart) in the same app.
    grade_json: Optional[dict[str, Any]] = Field(default=None)


class InterceptRequest(BaseModel):
    """A held resale-eligible unit at the RCC + an explicit buyer location → intercept vs FC."""
    region: Optional[str] = None
    category: str = "footwear"
    original_price: float = 2000
    customer_lat: float
    customer_lng: float
    buyer_lat: float
    buyer_lng: float


# --- Decision logging --------------------------------------------------------

def _log_decision(order_meta: dict, grade_json: dict, routing: dict) -> None:
    if not core_db.db_exists():
        return
    try:
        econ = routing.get("economics", {})
        conn = core_db.get_connection(row_factory=False)
        conn.execute(
            "INSERT INTO returns_log (ts, order_id, asin, category, grade, decision, decided_by, "
            "resale_price, savings_local, co2_saved_kg, buyer_found) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                datetime.now(timezone.utc).isoformat(),
                order_meta.get("order_id"), order_meta.get("asin"), order_meta.get("category"),
                grade_json.get("grade"), routing.get("decision"), routing.get("decided_by"),
                econ.get("original_price"), econ.get("savings_inr"), econ.get("co2_saved_kg"),
                int(routing.get("match", {}).get("buyer_found", False)),
            ),
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # logging must never break a routing response


# --- Endpoints ---------------------------------------------------------------

@router.post("/route")
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


@router.post("/grade-and-route")
def grade_and_route(req: GradeAndRouteRequest):
    """Route a supplied grade_json. Grading + routing are now ONE process — to grade images,
    POST them to /grade (multipart) and pass the returned grade_json here (or wire the two
    calls client-side). No cross-service HTTP hop remains.
    """
    meta = req.order_meta.model_dump()
    grade_json = req.grade_json
    region_raw = (meta.get("region") or "").strip().lower()
    if region_raw and region_raw not in REGIONS:
        meta["region"] = None

    if grade_json is None:
        return {
            "error": "no grade_json supplied.",
            "hint": "POST multipart images to /grade, then send the result here as grade_json "
                    "(grading and routing are the same service now).",
        }

    routing = route_return(grade_json, meta)
    routing["explanation"] = explain_decision(routing)
    routing["grade_source"] = "supplied"
    _log_decision(meta, grade_json, routing)
    return routing


@router.post("/route/intercept")
def route_intercept(req: InterceptRequest):
    """A resale-eligible unit is held at the RCC; a buyer is chosen on the map. Decide
    dynamically (from real road distances) whether to intercept locally or ship to the FC."""
    region_raw = (req.region or "").strip().lower()
    region = region_raw if region_raw in REGIONS else None
    return intercept_decision(
        region=region, category=req.category, original_price=req.original_price,
        customer_lat=req.customer_lat, customer_lng=req.customer_lng,
        buyer_lat=req.buyer_lat, buyer_lng=req.buyer_lng,
    )
