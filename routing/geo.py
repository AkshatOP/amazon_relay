"""Geography math: road distance, nearest-RCC / nearest-FC lookups.

Road distances use the OSRM public routing engine (OpenStreetMap data, free, no key needed)
when available, and fall back to haversine × ROAD_CIRCUITY (1.4) if OSRM is unreachable.
All distances returned to callers are in km and represent actual road travel distance.
"""
from __future__ import annotations

import math

from .seed_locations import FCS, RCCS

# Fallback road-distance estimate when OSRM is unreachable.
# Real road distance in Indian cities is ~1.4× the straight-line distance.
ROAD_CIRCUITY = 1.4

_EARTH_RADIUS_KM = 6371.0088
_OSRM_BASE = "http://router.project-osrm.org/route/v1/driving"
_OSRM_TIMEOUT = 5.0  # seconds; if OSRM doesn't respond, fall back to haversine


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle (straight-line) distance between two lat/lng points, in km."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * _EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _osrm_road_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float | None:
    """Real road distance via OSRM (OpenStreetMap routing). Returns km, or None on failure.

    OSRM expects coordinates as lng,lat (NOT lat,lng).
    Uses the public demo server — reliable for a hackathon demo; swap to a self-hosted instance
    for production. Never throws: returns None on any error so callers can use the haversine
    fallback.
    """
    try:
        import httpx
        url = f"{_OSRM_BASE}/{lng1},{lat1};{lng2},{lat2}?overview=false"
        resp = httpx.get(url, timeout=_OSRM_TIMEOUT)
        data = resp.json()
        if data.get("code") == "Ok":
            metres = data["routes"][0]["distance"]
            return round(metres / 1000.0, 2)
    except Exception:
        pass
    return None


def road_km_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Road distance in km between two points.

    Uses OSRM (real road routing via OpenStreetMap) when reachable; falls back to
    haversine × 1.4 if OSRM is down or times out.
    """
    real = _osrm_road_km(lat1, lng1, lat2, lng2)
    if real is not None:
        return real
    return round(haversine(lat1, lng1, lat2, lng2) * ROAD_CIRCUITY, 2)


def nearest_rcc(lat: float, lng: float) -> tuple[str, str, float]:
    """Nearest RCC to a point. Returns (name, pincode, road_km).

    Uses haversine for candidate selection (fast, no API calls), then OSRM for the final
    reported distance so it reflects the actual road path a vehicle would travel.
    """
    best = min(RCCS, key=lambda r: haversine(lat, lng, r["lat"], r["lng"]))
    km = road_km_between(lat, lng, best["lat"], best["lng"])
    return best["name"], best["pincode"], round(km, 2)


def _rcc_by_name(name: str) -> dict:
    for r in RCCS:
        if r["name"] == name:
            return r
    raise KeyError(f"Unknown RCC: {name}")


def nearest_fc_from_rcc(rcc_name: str) -> tuple[str, float]:
    """Nearest FC to a given RCC. Returns (code, road_km)."""
    rcc = _rcc_by_name(rcc_name)
    best = min(FCS, key=lambda f: haversine(rcc["lat"], rcc["lng"], f["lat"], f["lng"]))
    km = road_km_between(rcc["lat"], rcc["lng"], best["lat"], best["lng"])
    return best["code"], round(km, 2)


def customer_path(customer_lat: float, customer_lng: float) -> dict:
    """Full reverse-path geography for a pickup location.

    Returns the nearest RCC (leg 1 road km) and, from that RCC, the nearest FC (leg 2 road km).
    Both distances are OSRM road distances when available, haversine × 1.4 as fallback.
    """
    rcc_name, rcc_pin, leg1_km = nearest_rcc(customer_lat, customer_lng)
    fc_code, leg2_km = nearest_fc_from_rcc(rcc_name)
    return {
        "rcc": rcc_name,
        "rcc_pincode": rcc_pin,
        "leg1_km": leg1_km,
        "fc": fc_code,
        "leg2_km": leg2_km,
        "total_km": round(leg1_km + leg2_km, 2),
    }
