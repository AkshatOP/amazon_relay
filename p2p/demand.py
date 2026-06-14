"""Find nearby demand (buyers) for a P2P listing.

'Nearby' is defined as within P2P_DEMAND_RADIUS_KM road distance from the listing's
delivery station. We stay within the same Udupi town cluster — no shipping across regions.

generate_demand() is a demo convenience: seeds synthetic buyer interest directly into
p2p_demand so the step-3 flow has something to match against during a hackathon demo.
"""
from __future__ import annotations

import math
import sqlite3

from . import config


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(a)), 3)


def _road_km_approx(lat1: float, lng1: float, lat2: float, lng2: float,
                    circuity: float = 1.4) -> float:
    """Approximate road distance without OSRM (avoids coupling to routing package)."""
    return round(_haversine_km(lat1, lng1, lat2, lng2) * circuity, 2)


def _get_conn(db_path=None) -> sqlite3.Connection:
    path = db_path or config.P2P_DB_PATH
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    return conn


# Station coordinates — same-town Udupi cluster (mirrors routing/seed_locations.py).
# Copied to keep p2p fully decoupled from routing.
_STATION_COORDS: dict[str, tuple[float, float]] = {
    "UDUPI_CITY":  (13.3409, 74.7421),
    "MANIPAL":     (13.3502, 74.7876),
    "MALPE":       (13.3600, 74.7073),
    "KUNDAPURA":   (13.6260, 74.6920),
    "KARKALA":     (13.2048, 74.9860),
    "BRAHMAVAR":   (13.4233, 74.7494),
}


def _station_coords(station_id: str) -> tuple[float, float] | None:
    return _STATION_COORDS.get((station_id or "").upper())


def find_nearby_demand(listing_id: int, db_path=None) -> dict:
    """Find buyers in p2p_demand whose category/region match and who are within radius.

    Returns a structured dict with 'buyers' list and metadata.
    Never raises — returns {"error": "..."} on failure.
    """
    conn = _get_conn(db_path)
    try:
        listing = conn.execute(
            "SELECT * FROM listings WHERE id = ?", (listing_id,)
        ).fetchone()
        if listing is None:
            return {"error": f"listing_id {listing_id} not found"}

        lst = dict(listing)
        category = lst["category"]
        region = lst.get("region", config.DEFAULT_REGION)
        asking_price = float(lst["asking_price"])
        station_id = lst.get("station_id", "")

        station_coords = _station_coords(station_id)

        buyers_raw = conn.execute("""
            SELECT * FROM p2p_demand
            WHERE category = ? AND region = ? AND status = 'looking'
        """, (category, region)).fetchall()

        matched = []
        for b in buyers_raw:
            bd = dict(b)
            budget = float(bd.get("max_budget") or 0.0)
            if budget > 0 and budget < asking_price:
                continue  # outside budget

            road_km = None
            b_lat = bd.get("lat")
            b_lng = bd.get("lng")
            if station_coords and b_lat and b_lng:
                try:
                    road_km = _road_km_approx(
                        station_coords[0], station_coords[1],
                        float(b_lat), float(b_lng)
                    )
                except Exception:
                    road_km = None

            if road_km is not None and road_km > config.P2P_DEMAND_RADIUS_KM:
                continue

            matched.append({
                "demand_id": bd["id"],
                "buyer_name": bd.get("buyer_name", "Unknown"),
                "pincode": bd.get("pincode"),
                "lat": b_lat,
                "lng": b_lng,
                "max_budget": budget,
                "road_km": road_km,
                "note": bd.get("note", ""),
            })

        matched.sort(key=lambda x: x.get("road_km") or 999)

        return {
            "listing_id": listing_id,
            "category": category,
            "region": region,
            "station_id": station_id,
            "asking_price": asking_price,
            "buyers_found": len(matched),
            "buyers": matched,
            "radius_km": config.P2P_DEMAND_RADIUS_KM,
            "note": (
                "Demand matched within same-town radius. "
                "Road km is approx (haversine × 1.4 circuity factor)."
            ),
        }
    except Exception as exc:
        return {"error": str(exc)}
    finally:
        conn.close()


def generate_demand(listing_id: int, db_path=None) -> dict:
    """Demo helper: seed a synthetic buyer for this listing and return the match.

    Used by the 'Generate demand' button in the frontend. Idempotent — if a synthetic
    buyer for this category+region already exists, reuses it.
    """
    conn = _get_conn(db_path)
    try:
        listing = conn.execute(
            "SELECT * FROM listings WHERE id = ?", (listing_id,)
        ).fetchone()
        if listing is None:
            return {"error": f"listing_id {listing_id} not found"}

        lst = dict(listing)
        category = lst["category"]
        region = lst.get("region", config.DEFAULT_REGION)
        asking_price = float(lst["asking_price"])
        station_id = lst.get("station_id", "")
        station_coords = _station_coords(station_id)

        # Synthetic buyer: 2.2 km away (Udupi City → Manipal distance), budget = asking + margin
        buyer_lat = 13.3502
        buyer_lng = 74.7876
        max_budget = round(asking_price * 1.10, 2)  # buyer willing to pay up to 10% more

        existing = conn.execute("""
            SELECT id FROM p2p_demand
            WHERE category = ? AND region = ? AND buyer_name = 'Demo Buyer (Manipal)'
        """, (category, region)).fetchone()

        if existing:
            demand_id = existing["id"]
        else:
            conn.execute("""
                INSERT INTO p2p_demand
                  (buyer_name, category, region, pincode, lat, lng, max_budget, status, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'looking', 'Auto-generated for hackathon demo')
            """, ("Demo Buyer (Manipal)", category, region, "576104",
                  buyer_lat, buyer_lng, max_budget))
            conn.commit()
            demand_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        road_km = None
        if station_coords:
            road_km = _road_km_approx(
                station_coords[0], station_coords[1],
                buyer_lat, buyer_lng
            )

        return {
            "demand_id": demand_id,
            "generated": existing is None,
            "buyer_name": "Demo Buyer (Manipal)",
            "category": category,
            "region": region,
            "max_budget": max_budget,
            "road_km": road_km,
            "note": "Synthetic demand seeded for demo. Find demand again to confirm match.",
        }
    except Exception as exc:
        return {"error": str(exc)}
    finally:
        conn.close()
