"""Geography math: road distance, nearest-node / nearest-FC lookups.

Road distances use the OSRM public routing engine (OpenStreetMap data, free, no key needed)
when available, and fall back to haversine × ROAD_CIRCUITY (1.4) if OSRM is unreachable.
All distances returned to callers are in km and represent actual road travel distance.

Multi-region: pass region="bengaluru" or region="udupi" to any function.
Defaults to seed_locations.ACTIVE_REGION when region=None.
"""
from __future__ import annotations

import math

from .seed_locations import REGIONS, get_external_fc, get_nodes, get_region

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
    for production. Never throws: returns None on any error so callers can use the fallback.
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


def road_km_between(lat1: float, lng1: float, lat2: float, lng2: float,
                    circuity: float = ROAD_CIRCUITY) -> float:
    """Road distance in km between two points.

    Uses OSRM (real road routing via OpenStreetMap) when reachable; falls back to
    haversine × circuity. Pass a higher circuity value (e.g. 1.55) for mountain routes.
    """
    real = _osrm_road_km(lat1, lng1, lat2, lng2)
    if real is not None:
        return real
    return round(haversine(lat1, lng1, lat2, lng2) * circuity, 2)


def nearest_rcc(lat: float, lng: float, region: str | None = None) -> tuple[str, str, float]:
    """Nearest node (RCC or Local Delivery Station) to a point. Returns (name, pincode, road_km).

    Uses haversine for candidate selection (fast, no API calls), then OSRM for the final
    reported distance so it reflects the actual road path a vehicle would travel.
    """
    nodes = get_nodes(region)
    best = min(nodes, key=lambda r: haversine(lat, lng, r["lat"], r["lng"]))
    km = road_km_between(lat, lng, best["lat"], best["lng"])
    return best["name"], best["pincode"], round(km, 2)


def _node_by_name(name: str, region: str | None = None) -> dict:
    for r in get_nodes(region):
        if r["name"] == name:
            return r
    raise KeyError(f"Unknown node: '{name}' in region '{region}'")


def nearest_fc_from_rcc(rcc_name: str, region: str | None = None) -> tuple[str, float]:
    """Nearest FC to a given node. Returns (code_or_name, road_km).

    Bengaluru: finds the nearest in-region FC from the FCS list via haversine, then OSRM.
    Udupi: uses the external FC with road_km_default; OSRM overrides when reachable.
           Falls back to road_km_default (not haversine×circuity) because the Ghats
           corridor's curvature makes haversine×factor unreliable over 330 km.
    """
    rdef = get_region(region)
    node = _node_by_name(rcc_name, region)

    ext = rdef.get("external_fc")
    in_region_fcs = rdef.get("fcs", [])

    if ext and not in_region_fcs:
        # Region has no in-region FC — use the external FC.
        osrm_km = _osrm_road_km(node["lat"], node["lng"], ext["lat"], ext["lng"])
        km = osrm_km if osrm_km is not None else ext["road_km_default"]
        return ext.get("code", ext["name"]), round(km, 2)

    # In-region FCs (bengaluru): haversine selection, OSRM final distance.
    best = min(in_region_fcs, key=lambda f: haversine(node["lat"], node["lng"], f["lat"], f["lng"]))
    km = road_km_between(node["lat"], node["lng"], best["lat"], best["lng"])
    return best["code"], round(km, 2)


def region_fc_distance_km(node_name: str, region: str | None = None) -> float:
    """Road distance from a named node to its serving FC. Convenience wrapper."""
    _, km = nearest_fc_from_rcc(node_name, region)
    return km


def customer_path(customer_lat: float, customer_lng: float, region: str | None = None) -> dict:
    """Full reverse-path geography for a pickup location.

    Returns the nearest node (RCC or Local Station) and the FC serving that node.
    Both distances are OSRM road distances when available, with safe fallbacks.
    Includes node_type and holding_capacity for UI labelling.
    """
    rcc_name, rcc_pin, leg1_km = nearest_rcc(customer_lat, customer_lng, region)
    fc_code, leg2_km = nearest_fc_from_rcc(rcc_name, region)

    rdef = get_region(region)
    node_data = next((n for n in rdef["nodes"] if n["name"] == rcc_name), {})

    return {
        "rcc": rcc_name,
        "rcc_pincode": rcc_pin,
        "leg1_km": leg1_km,
        "fc": fc_code,
        "leg2_km": leg2_km,
        "total_km": round(leg1_km + leg2_km, 2),
        "node_type": rdef["node_type"],
        "holding_capacity": node_data.get("holding_capacity"),  # None for bengaluru RCCs
    }


def measure_external_fc_osrm(region: str = "udupi") -> dict:
    """Attempt to measure the real OSRM road distance to the external FC for a region.

    Tries each node in the region and returns the min/max/avg. Useful at seed time to
    verify that road_km_default is reasonable.
    """
    rdef = get_region(region)
    ext = rdef.get("external_fc")
    if not ext:
        return {"error": f"Region '{region}' has no external_fc"}
    results = {}
    for node in rdef["nodes"]:
        km = _osrm_road_km(node["lat"], node["lng"], ext["lat"], ext["lng"])
        results[node["name"]] = {
            "osrm_km": km,
            "fallback_km": ext["road_km_default"],
            "used": km if km is not None else ext["road_km_default"],
        }
    measured = [v["osrm_km"] for v in results.values() if v["osrm_km"] is not None]
    summary = {
        "nodes": results,
        "osrm_reachable": bool(measured),
        "min_km": round(min(measured), 1) if measured else None,
        "max_km": round(max(measured), 1) if measured else None,
        "default_km": ext["road_km_default"],
    }
    return summary
