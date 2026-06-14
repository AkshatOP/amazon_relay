"""RCC + FC coordinate tables for the routing demo, organized by region.

ACTIVE_REGION controls which region is used by default for all geo/DB lookups.
Backward-compatible shims RCCS and FCS point to the active region's nodes and FCs
so existing code that does `from .seed_locations import RCCS, FCS` continues to work.

# TODO: replace with exact geocoded coordinates — the lat/lng values are approximate
# area centroids, fine for a road-distance demo but NOT survey-grade.
"""
from __future__ import annotations

REGIONS: dict[str, dict] = {
    "bengaluru": {
        "label": "Bengaluru (metro — short FC haul, modest savings)",
        # Standalone Return Consolidation Centers that hold items until dispatched to FC.
        "node_type": "RCC",
        "nodes": [
            {"name": "Mysore Road",       "pincode": "560026", "lat": 12.9456, "lng": 77.5236},
            {"name": "Sahakarnagar",      "pincode": "560092", "lat": 13.0586, "lng": 77.5806},
            {"name": "Chickpet",          "pincode": "560053", "lat": 12.9698, "lng": 77.5793},
            {"name": "Bannerghatta Road", "pincode": "560076", "lat": 12.8911, "lng": 77.5970},
            {"name": "BTM 1st Stage",     "pincode": "560029", "lat": 12.9166, "lng": 77.6101},
            {"name": "Indira Nagar",      "pincode": "560008", "lat": 12.9784, "lng": 77.6408},
            {"name": "Rajajinagar",       "pincode": "560010", "lat": 12.9911, "lng": 77.5526},
            {"name": "Brigade Road",      "pincode": "560025", "lat": 12.9719, "lng": 77.6076},
        ],
        "fcs": [
            {"code": "BLR5",   "location": "Bommasandra/Hoskote", "pincode": "560067", "lat": 13.0707, "lng": 77.7796},
            {"code": "BLR7",   "location": "Hoskote",             "pincode": "560067", "lat": 13.0707, "lng": 77.7796},
            {"code": "BLR8",   "location": "Devanahalli",         "pincode": "562149", "lat": 13.2437, "lng": 77.7172},
            {"code": "Jigani", "location": "Jigani/Anekal",       "pincode": "560099", "lat": 12.7889, "lng": 77.6406},
        ],
        "external_fc": None,
    },
    "udupi": {
        "label": "Udupi (tier-3 coastal — no local FC, ~400 km Ghats haul to BLR)",
        # Udupi has NO dedicated RCCs. Local last-mile delivery stations (courier franchisees,
        # kirana-linked pickup points, India Post hubs) double as:
        #   • return collection / consolidation (the RCC's job)
        #   • 1–2 day holding buffer during the match window
        #   • intercept-delivery launch point
        # The same node handles pickup and local re-delivery — no separate RCC→FC hop inside town.
        "node_type": "LOCAL_STATION",
        "nodes": [
            # TODO: exact geocoding — coordinates are approximate area centroids
            {"name": "Udupi City (Service Bus Stand)", "pincode": "576101", "lat": 13.3409, "lng": 74.7421, "holding_capacity": 40},
            {"name": "Manipal",                        "pincode": "576104", "lat": 13.3490, "lng": 74.7869, "holding_capacity": 30},
            {"name": "Malpe",                          "pincode": "576103", "lat": 13.3494, "lng": 74.7039, "holding_capacity": 15},
            {"name": "Kundapura",                      "pincode": "576201", "lat": 13.6260, "lng": 74.6920, "holding_capacity": 20},
            {"name": "Karkala",                        "pincode": "574104", "lat": 13.2160, "lng": 74.9930, "holding_capacity": 15},
            {"name": "Brahmavar",                      "pincode": "576213", "lat": 13.4280, "lng": 74.7460, "holding_capacity": 10},
        ],
        "fcs": [],  # no in-region Fulfillment Centers
        "external_fc": {
            # The nearest Amazon FC is the Bengaluru cluster, reached via the Western Ghats
            # (NH 169 + NH 75 / Shiradi Ghats route). Low-volume small-brand FBA items that are
            # not pre-stocked at a regional hub travel this route, creating the 7-9 day delivery
            # window where a second order can arrive — exactly when local intercept wins.
            "name": "Bengaluru FC cluster (BLR, via Western Ghats)",
            "code": "BLR_CLUSTER",
            "lat": 13.0707, "lng": 77.7796, "pincode": "560067",
            # OSRM-verified (June 2026): Udupi City→BLR 448 km, Kundapura→BLR 455 km,
            # Karkala→BLR 423 km (NH 169 + NH 75 via Shiradi Ghats). Using 440 km as
            # the representative default for the Udupi central cluster. OSRM overrides
            # this at runtime with the per-node real distance.
            "road_km_default": 440.0,
            # Ghats mountain roads are significantly windier than the 1.4 urban circuity factor.
            # This coefficient is documented here for reference; the code prefers road_km_default
            # as the OSRM fallback because haversine × 1.55 overestimates this specific corridor.
            "ghats_circuity": 1.55,
        },
    },
}

# Controls which region is used by default. Change this to switch the demo.
ACTIVE_REGION = "udupi"


# --- Accessor functions -------------------------------------------------------

def get_region(name: str | None = None) -> dict:
    """Region config dict for `name`, falling back to ACTIVE_REGION, then bengaluru."""
    key = (name or ACTIVE_REGION).strip().lower()
    return REGIONS.get(key, REGIONS["bengaluru"])


def get_nodes(region: str | None = None) -> list[dict]:
    """Node list for a region — RCCs for bengaluru, Local Delivery Stations for udupi."""
    return get_region(region)["nodes"]


def get_node_type(region: str | None = None) -> str:
    """'RCC' or 'LOCAL_STATION'."""
    return get_region(region)["node_type"]


def get_external_fc(region: str | None = None) -> dict | None:
    """External FC config for regions without an in-region FC. None for bengaluru."""
    return get_region(region).get("external_fc")


# --- Backward-compatible shims -----------------------------------------------
# Code that does `from .seed_locations import RCCS, FCS` keeps working.
# These point to ACTIVE_REGION's data at import time.
RCCS = get_nodes()
FCS = get_region().get("fcs", [])
