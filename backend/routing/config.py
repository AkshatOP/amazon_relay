"""All tunable routing constants in ONE place — fuel, vehicles, costs, radius, categories.

Tune the reverse-logistics economics here; nothing downstream hardcodes these. Swapping the
demo from a metro to a tier-3 city is mostly a matter of editing seed_locations.py (distances)
— the cost/CO2 physics in this file stay the same.

The DATABASE path comes from backend.core.config (the ONE consolidated relay.db). The model
+ training-CSV artifacts stay package-local under backend/routing/model/.
"""
from __future__ import annotations

from pathlib import Path

from backend.core.config import DB_PATH  # the ONE consolidated database

# --- Paths -------------------------------------------------------------------
ROUTING_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = ROUTING_DIR.parent.parent
MODEL_PATH = ROUTING_DIR / "model" / "router_model.pkl"
TRAINING_CSV = ROUTING_DIR / "model" / "training_data.csv"

# --- Categories in scope (this phase) ----------------------------------------
# Canonical order defines category_ordinal (0-7) used in training + inference.
CATEGORY_ORDER = [
    "footwear", "shoes", "watch", "phonecase", "toy", "book", "backpack", "bag",
]


def category_ordinal(category: str) -> int:
    """Stable 0-7 ordinal for a category; unknown -> 0 (footwear)."""
    c = (category or "").strip().lower()
    return CATEGORY_ORDER.index(c) if c in CATEGORY_ORDER else 0


# --- Verified real constants (Bengaluru, June 2026) --------------------------
DIESEL_RATE_PER_L = 91.0      # Rs/litre, Bangalore pump price 13-Jun-2026 (tax-inclusive).
                             # Sources span Rs 91-98 by dealer; bump to 98.0 for conservative runs.
DIESEL_CO2_KG_PER_L = 2.68   # kg CO2e per litre diesel (standard emission factor)

LEG1_VEHICLE = {  # customer -> RCC : Tata Ace class mini-truck (diesel)
    "name": "Tata Ace (mini-truck)", "mileage_kmpl": 15.0, "avg_items_per_trip": 18,
}
LEG2_VEHICLE = {  # RCC -> FC : 14-ft Eicher class container truck
    "name": "14-ft Eicher (container)", "mileage_kmpl": 6.0, "avg_items_per_trip": 250,
}
# Local-intercept delivery (RCC -> nearby buyer) reuses the small mini-truck class.
DELIVERY_VEHICLE = LEG1_VEHICLE

INSPECTION_COST_PER_ITEM = 12.0     # Rs amortized handling + inspection per unit
RCC_STORAGE_COST_PER_DAY = 3.0      # Rs/day RCC holding
RCC_HOLD_DAYS = 2
LIQUIDATION_RECOVERY_RATE = 0.15    # liquidation recovers ~15% of item value (before haul)
NEARBY_DEMAND_RADIUS_KM = 12.0      # max road-km from RCC to buyer to count as local demand
                                    # (was 8 km for haversine; bumped to 12 km for real OSRM road distance)
WAREHOUSE_EQUIVALENT_KM = 612.0     # demo anchor: "X km local vs 612 km to warehouse"

# Sentinel meaning "there is NO local resell option" (no nearby buyer). The model must learn
# this is a *flag*, not a real cost to average over. See generate_training_data.py.
NO_LOCAL_OPTION_SENTINEL = 9999.0

# Refurbish economics (used by hard gates + training rule engine).
REFURB_COST_PER_ITEM = 80.0         # Rs avg cost to refurbish a grade-C item
# A refurbished grade-C return (fresh unit, just damaged) typically clears ~64% of original price
# after repair (roughly: grade-C condition ~40% of value, refurb lifts it ~60%). No age factor.
REFURB_RESALE_FRACTION = 0.64

# --- Per-category profiles + the COMPUTED donate/liquidate boundary ----------
# resale_velocity: local sell speed 0-1 ; weight_factor: haul-cost multiplier ;
# donation_value: Rs-equivalent social/ESG credit booked for donating.
CATEGORY_PROFILE = {
    "footwear":  {"resale_velocity": 0.75, "weight_factor": 1.0, "donation_value": 60},
    "shoes":     {"resale_velocity": 0.75, "weight_factor": 1.0, "donation_value": 60},
    "watch":     {"resale_velocity": 0.85, "weight_factor": 0.6, "donation_value": 40},
    "phonecase": {"resale_velocity": 0.55, "weight_factor": 0.4, "donation_value": 20},
    "toy":       {"resale_velocity": 0.65, "weight_factor": 1.1, "donation_value": 80},
    "book":      {"resale_velocity": 0.50, "weight_factor": 1.3, "donation_value": 50},
    "backpack":  {"resale_velocity": 0.70, "weight_factor": 1.0, "donation_value": 55},
    "bag":       {"resale_velocity": 0.70, "weight_factor": 0.9, "donation_value": 55},
}

# Decision labels (also the XGBoost class order, index 0-3).
DECISIONS = ["RESELL_LOCAL", "REFURBISH", "DONATE", "LIQUIDATE"]


def profile_for(category: str) -> dict:
    """Category profile with a safe default for unknown categories."""
    return CATEGORY_PROFILE.get(
        (category or "").strip().lower(),
        {"resale_velocity": 0.6, "weight_factor": 1.0, "donation_value": 50},
    )
