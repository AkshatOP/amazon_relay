"""P2P APIRouter — thin wrappers over the P2P resale-exchange domain functions.

Mounted under the /p2p prefix by backend/main.py. Endpoints (all read-through, never raise):
  GET  /p2p/purchases                       — list purchases (demo picker)
  GET  /p2p/nudge/{purchase_id}             — time-triggered resale nudge (?simulate_years=)
  POST /p2p/list                            — create/update listing (post-grade) + Health Card
  GET  /p2p/listing/{listing_id}            — fetch a listing
  POST /p2p/demand/find                     — find nearby buyers
  POST /p2p/demand/generate                 — seed synthetic demand (demo button)
  POST /p2p/handoff                         — A→station→B logistics + seller payout
"""
from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from backend.core import db as core_db
from .notifier import build_resale_nudge
from .listing import create_listing
from .demand import find_nearby_demand, generate_demand
from .handoff import compute_handoff

router = APIRouter(prefix="/p2p", tags=["p2p"])


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

@router.get("/purchases")
def list_purchases():
    """List all purchases for the demo picker UI."""
    try:
        conn = core_db.get_connection()
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


@router.get("/nudge/{purchase_id}")
def get_nudge(
    purchase_id: int,
    simulate_years: Optional[float] = Query(default=None),
):
    """Step 1 — Time-triggered resale nudge for a purchase."""
    try:
        conn = core_db.get_connection()
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


@router.post("/list")
def post_listing(req: ListRequest):
    """Step 2 — Create/update listing after item has been graded.

    age_years is computed from purchase_date (or simulate_years for demo).
    """
    try:
        conn = core_db.get_connection()
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


@router.get("/listing/{listing_id}")
def get_listing(listing_id: int):
    """Get a listing with full health card data."""
    try:
        conn = core_db.get_connection()
        row = conn.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
        conn.close()
    except Exception as exc:
        return {"error": str(exc)}

    if row is None:
        return {"error": f"listing_id {listing_id} not found"}

    d = dict(row)
    d["defects"] = [x for x in (d.get("defects") or "").split("|") if x]
    return d


@router.post("/demand/find")
def post_demand_find(req: DemandFindRequest):
    """Step 3 — Find nearby buyers for a listing."""
    return find_nearby_demand(req.listing_id)


@router.post("/demand/generate")
def post_demand_generate(req: DemandGenerateRequest):
    """Demo button — seed synthetic demand and find buyers."""
    result = generate_demand(req.listing_id)
    if "error" in result:
        return result
    # Immediately return the match too
    match = find_nearby_demand(req.listing_id)
    result["match_result"] = match
    return result


@router.post("/handoff")
def post_handoff(req: HandoffRequest):
    """Step 4 — Compute A→station→B logistics + seller payout."""
    try:
        conn = core_db.get_connection()
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
