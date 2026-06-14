"""P2P Resale Exchange — FastAPI on port 8200.

Endpoints (all read-through, never raise):
  GET  /health
  GET  /nudge/{purchase_id}?simulate_years=2.0     → resale nudge notification
  POST /list                                         → create/update listing (post-grade)
  GET  /listing/{listing_id}                         → get listing + health card
  POST /demand/find                                  → find nearby buyers for listing
  POST /demand/generate                              → seed synthetic demand (demo button)
  POST /handoff                                      → compute A→station→B logistics + green credits
  GET  /purchases                                    → list all purchases (for demo picker)

Run: uvicorn p2p.p2p_api:app --reload --port 8200
"""
from __future__ import annotations

import datetime
import sqlite3
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import P2P_DB_PATH
from .notifier import build_resale_nudge
from .listing import create_listing
from .demand import find_nearby_demand, generate_demand
from .handoff import compute_handoff

app = FastAPI(title="Amazon Relay — P2P Resale Exchange", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(P2P_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ListRequest(BaseModel):
    purchase_id: int
    grade: str = Field(..., description="A / B / C / D from grading agent")
    condition_score: int = Field(..., ge=1, le=10)
    defects: list[str] = Field(default_factory=list)
    simulate_years: Optional[float] = Field(default=None, description="Demo time-travel")


class DemandFindRequest(BaseModel):
    listing_id: int


class DemandGenerateRequest(BaseModel):
    listing_id: int


class HandoffRequest(BaseModel):
    listing_id: int
    demand_id: int
    seller_lat: float
    seller_lng: float
    buyer_lat: float
    buyer_lng: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "p2p", "port": 8200}


@app.get("/purchases")
def list_purchases():
    """List all purchases for the demo picker UI."""
    try:
        conn = _get_conn()
        rows = conn.execute("""
            SELECT p.*, u.name as user_name, u.lat as user_lat, u.lng as user_lng
            FROM purchases p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.id
        """).fetchall()
        conn.close()
        return {"purchases": [dict(r) for r in rows]}
    except Exception as exc:
        return {"error": str(exc), "purchases": []}


@app.get("/nudge/{purchase_id}")
def get_nudge(
    purchase_id: int,
    simulate_years: Optional[float] = Query(default=None),
):
    """Step 1 — Time-triggered resale nudge for a purchase."""
    try:
        conn = _get_conn()
        row = conn.execute(
            "SELECT p.*, u.name as user_name FROM purchases p "
            "LEFT JOIN users u ON u.id = p.user_id "
            "WHERE p.id = ?", (purchase_id,)
        ).fetchone()
        conn.close()
    except Exception as exc:
        return {"error": str(exc)}

    if row is None:
        return {"error": f"purchase_id {purchase_id} not found"}

    p = dict(row)
    nudge = build_resale_nudge(
        user_name=p.get("user_name") or "Customer",
        category=p["category"],
        item_name=p["item_name"],
        original_price=float(p["original_price"]),
        purchase_date=p["purchase_date"],
        warranty_total_years=float(p.get("warranty_total_years") or 0.0),
        simulate_years=simulate_years,
    )
    nudge["purchase_id"] = purchase_id
    nudge["purchase_details"] = {
        "item_name": p["item_name"],
        "category": p["category"],
        "original_price": p["original_price"],
        "purchase_date": p["purchase_date"],
        "warranty_total_years": p.get("warranty_total_years"),
        "region": p.get("region"),
        "station_id": p.get("station_id"),
    }
    return nudge


@app.post("/list")
def post_listing(req: ListRequest):
    """Step 2 — Create/update listing after item has been graded.

    age_years is computed from purchase_date (or simulate_years for demo).
    """
    try:
        conn = _get_conn()
        row = conn.execute(
            "SELECT purchase_date FROM purchases WHERE id = ?", (req.purchase_id,)
        ).fetchone()
        conn.close()
    except Exception as exc:
        return {"error": str(exc)}

    if row is None:
        return {"error": f"purchase_id {req.purchase_id} not found"}

    if req.simulate_years is not None:
        age_years = max(0.0, float(req.simulate_years))
    else:
        try:
            d = datetime.date.fromisoformat(row["purchase_date"])
            age_years = max(0.0, (datetime.date.today() - d).days / 365.25)
        except Exception:
            age_years = 0.0

    return create_listing(
        purchase_id=req.purchase_id,
        grade=req.grade,
        condition_score=req.condition_score,
        defects=req.defects,
        age_years=age_years,
        simulate_years=req.simulate_years,
    )


@app.get("/listing/{listing_id}")
def get_listing(listing_id: int):
    """Get a listing with full health card data."""
    try:
        conn = _get_conn()
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        conn.close()
    except Exception as exc:
        return {"error": str(exc)}

    if row is None:
        return {"error": f"listing_id {listing_id} not found"}

    d = dict(row)
    d["defects"] = [x for x in (d.get("defects") or "").split("|") if x]
    return d


@app.post("/demand/find")
def post_demand_find(req: DemandFindRequest):
    """Step 3 — Find nearby buyers for a listing."""
    return find_nearby_demand(req.listing_id)


@app.post("/demand/generate")
def post_demand_generate(req: DemandGenerateRequest):
    """Demo button — seed synthetic demand and find buyers."""
    result = generate_demand(req.listing_id)
    if "error" in result:
        return result
    # Immediately return the match too
    match = find_nearby_demand(req.listing_id)
    result["match_result"] = match
    return result


@app.post("/handoff")
def post_handoff(req: HandoffRequest):
    """Step 4 — Compute A→station→B logistics + CO₂ + green credits."""
    try:
        conn = _get_conn()
        listing = conn.execute(
            "SELECT asking_price, station_id, region FROM listings WHERE id = ?",
            (req.listing_id,)
        ).fetchone()
        conn.close()
    except Exception as exc:
        return {"error": str(exc)}

    if listing is None:
        return {"error": f"listing_id {req.listing_id} not found"}

    return compute_handoff(
        seller_lat=req.seller_lat,
        seller_lng=req.seller_lng,
        buyer_lat=req.buyer_lat,
        buyer_lng=req.buyer_lng,
        station_id=listing["station_id"],
        region=listing["region"] or "udupi",
        asking_price=float(listing["asking_price"]),
    )
