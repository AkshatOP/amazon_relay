"""Build a P2P listing with Health Card for a graded item.

The Health Card is assembled here because Phase 4 (Product Health Card) was never built as a
separate module. All information needed for the buyer-facing card is available to P2P at the
point of listing creation — original bill, grading result, warranty, and age.

A listing in the consolidated relay.db `listings` table is the authoritative record that
demand matching and handoff logistics both operate against.
"""
from __future__ import annotations

import datetime
import sqlite3

from . import config
from .lifespan_table import window_position, resale_window
from .pricing import stage1_price, stage2_price, CONDITION_MULTIPLIER


# ---------------------------------------------------------------------------
# Health Card
# ---------------------------------------------------------------------------

def build_health_card(
    *,
    item_name: str,
    category: str,
    original_price: float,
    purchase_date: str,
    warranty_total_years: float,
    age_years: float,
    grade: str,
    condition_score: int,
    defects: list[str],
    has_original_bill: bool,
    has_original_box: bool,
    stage2: dict,
) -> dict:
    """Buyer-facing health card for the listing.

    Synthesises everything the buyer needs to make an informed decision.
    Returned as a plain dict — serialisable to JSON.
    """
    min_y, max_y, avg_y = resale_window(category)
    remaining_warranty = max(0.0, round(warranty_total_years - age_years, 2))
    warranty_display = (
        f"{remaining_warranty:.1f} years remaining (transferable)"
        if remaining_warranty > 0 else "No warranty remaining"
    )

    trust_anchors = []
    if has_original_bill:
        trust_anchors.append("Original purchase bill (price & date verified)")
    if has_original_box:
        trust_anchors.append("Original box included")
    if remaining_warranty > 0:
        trust_anchors.append(f"Transferable warranty: {remaining_warranty:.1f} yr")

    grade_label = {
        "A": "Excellent — near-new quality, cosmetic marks only",
        "B": "Good — light wear, fully functional",
        "C": "Fair — moderate wear, functional",
        "D": "Poor — significant wear/damage",
    }.get(grade.upper(), "Unknown")

    condition_summary = f"Grade {grade.upper()} — {grade_label}"
    defect_summary = defects if defects else ["None reported"]

    return {
        "item_name": item_name,
        "category": category,
        "original_price": original_price,
        "purchase_date": purchase_date,
        "age_years": round(age_years, 2),
        "age_display": f"{age_years:.1f} years old",
        "condition_grade": grade.upper(),
        "condition_score": condition_score,
        "condition_summary": condition_summary,
        "defects": defect_summary,
        "warranty": warranty_display,
        "remaining_warranty_years": remaining_warranty,
        "has_original_bill": has_original_bill,
        "has_original_box": has_original_box,
        "trust_anchors": trust_anchors,
        "resale_window": {
            "min_years": min_y, "max_years": max_y, "avg_years": avg_y,
            "position": window_position(category, age_years),
        },
        "asking_price": stage2["final_price"],
        "price_breakdown": stage2["breakdown"],
        "price_note": stage2.get("note", ""),
        "verified_by": "Relay HUB grading agent",
    }


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def _get_conn(db_path=None) -> sqlite3.Connection:
    path = db_path or config.P2P_DB_PATH
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


def create_listing(
    *,
    purchase_id: int,
    grade: str,
    condition_score: int,
    defects: list[str],
    age_years: float,
    simulate_years: float | None = None,
    db_path=None,
) -> dict:
    """Promote a purchase to an active P2P listing once it's been graded.

    Reads purchase details from the DB, computes Stage-2 price, builds Health Card,
    writes a row to `listings`, returns the full listing payload.

    Never raises — returns {"error": "..."} on any DB/key failure.
    """
    conn = _get_conn(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM purchases WHERE id = ?", (purchase_id,)
        ).fetchone()
        if row is None:
            return {"error": f"purchase_id {purchase_id} not found"}

        p = dict(row)
        original_price = float(p["original_price"])
        category = p["category"]
        warranty_total = float(p.get("warranty_total_years") or 0.0)
        has_bill = bool(p.get("has_original_bill", 0))
        has_box = bool(p.get("has_original_box", 0))
        item_name = p.get("item_name", category)
        purchase_date = p.get("purchase_date", "")
        station_id = p.get("station_id", "")
        region = p.get("region", config.DEFAULT_REGION)

        s1 = stage1_price(original_price, category, age_years, warranty_total)
        s2 = stage2_price(original_price, category, age_years, grade, warranty_total)

        defect_str = "|".join(defects) if defects else ""
        health_card = build_health_card(
            item_name=item_name,
            category=category,
            original_price=original_price,
            purchase_date=purchase_date,
            warranty_total_years=warranty_total,
            age_years=age_years,
            grade=grade.upper(),
            condition_score=condition_score,
            defects=defects,
            has_original_bill=has_bill,
            has_original_box=has_box,
            stage2=s2,
        )

        now = datetime.datetime.utcnow().isoformat()
        conn.execute("""
            INSERT OR REPLACE INTO listings
              (purchase_id, seller_id, category, item_name, original_price,
               grade, condition_score, defects, asking_price,
               station_id, region, has_original_bill, has_original_box,
               warranty_total_years, age_years, status, created_at)
            VALUES
              (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',?)
        """, (
            purchase_id, p.get("user_id"), category, item_name, original_price,
            grade.upper(), condition_score, defect_str, s2["final_price"],
            station_id, region, int(has_bill), int(has_box),
            warranty_total, round(age_years, 2), now,
        ))
        conn.commit()

        listing_id = conn.execute(
            "SELECT id FROM listings WHERE purchase_id = ? AND status = 'active'",
            (purchase_id,)
        ).fetchone()
        lid = listing_id["id"] if listing_id else None

        return {
            "listing_id": lid,
            "purchase_id": purchase_id,
            "item_name": item_name,
            "category": category,
            "region": region,
            "station_id": station_id,
            "grade": grade.upper(),
            "asking_price": s2["final_price"],
            "stage1_price": s1["final_price"],
            "price_went_up": s2["price_went_up"],
            "price_note": s2.get("note", ""),
            "health_card": health_card,
            "simulate_years": simulate_years,
            "created_at": now,
        }
    except Exception as exc:
        return {"error": str(exc)}
    finally:
        conn.close()
