"""All tunable P2P constants in one place.

P2P Resale Exchange — the ONLY module where age + condition depreciation lives.
Routing treats every return as a NEW unit (full original_price, no depreciation).
That distinction is load-bearing; do not blur it.

The DATABASE path comes from backend.core.config (the ONE consolidated relay.db); P2P_DB_PATH
is an alias kept so the existing p2p modules keep working unchanged.
"""
from __future__ import annotations

from backend.core.config import DB_PATH

# --- Paths -------------------------------------------------------------------
# The p2p tables (users, purchases, listings, p2p_demand) live in the one shared DB.
P2P_DB_PATH = DB_PATH

# --- Delivery vehicle (individual P2P pickup / drop) -------------------------
DELIVERY_BIKE = {
    "name": "Delivery motorbike (individual P2P)",
    "mileage_kmpl": 35.0,
    "avg_items_per_trip": 1,
}

# --- Warranty residual bonus -------------------------------------------------
# Each remaining transferable warranty year adds a small trust uplift to the price.
# Increases buyer confidence AND seller payout. Illustrative — not contractual.
WARRANTY_BONUS_RATE = 0.02   # 2% of original_price per remaining warranty year

# --- Demand radius -----------------------------------------------------------
P2P_DEMAND_RADIUS_KM = 12.0  # max road-km from listing's station to buyer (same as routing)

# --- Region defaults ---------------------------------------------------------
DEFAULT_REGION = "udupi"
