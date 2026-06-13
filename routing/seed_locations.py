"""RCC + FC coordinate tables for the routing demo.

Plain dicts so swapping the demo city (e.g. Bengaluru -> a tier-3 city) is a one-file edit.

# TODO: replace with exact geocoded coordinates — the lat/lng below are approximate area
# centroids, fine for a haversine demo but NOT survey-grade.
"""
from __future__ import annotations

# --- RCCs: Return / Buyer Consolidation Centers ------------------------------
RCCS = [
    {"name": "Mysore Road",       "pincode": "560026", "lat": 12.9456, "lng": 77.5236},
    {"name": "Sahakarnagar",      "pincode": "560092", "lat": 13.0586, "lng": 77.5806},
    {"name": "Chickpet",          "pincode": "560053", "lat": 12.9698, "lng": 77.5793},
    {"name": "Bannerghatta Road", "pincode": "560076", "lat": 12.8911, "lng": 77.5970},
    {"name": "BTM 1st Stage",     "pincode": "560029", "lat": 12.9166, "lng": 77.6101},
    {"name": "Indira Nagar",      "pincode": "560008", "lat": 12.9784, "lng": 77.6408},
    {"name": "Rajajinagar",       "pincode": "560010", "lat": 12.9911, "lng": 77.5526},
    {"name": "Brigade Road",      "pincode": "560025", "lat": 12.9719, "lng": 77.6076},
]

# --- FCs: Fulfillment Centers ------------------------------------------------
FCS = [
    {"code": "BLR5",   "location": "Bommasandra/Hoskote", "pincode": "560067", "lat": 13.0707, "lng": 77.7796},
    {"code": "BLR7",   "location": "Hoskote",             "pincode": "560067", "lat": 13.0707, "lng": 77.7796},
    {"code": "BLR8",   "location": "Devanahalli",         "pincode": "562149", "lat": 13.2437, "lng": 77.7172},
    {"code": "Jigani", "location": "Jigani/Anekal",       "pincode": "560099", "lat": 12.7889, "lng": 77.6406},
]
