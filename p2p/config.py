"""All tunable P2P constants in one place.

P2P Resale Exchange — the ONLY module where age + condition depreciation lives.
Routing treats every return as a NEW unit (full original_price, no depreciation).
That distinction is load-bearing; do not blur it.
"""
from __future__ import annotations

from pathlib import Path

# --- Paths -------------------------------------------------------------------
P2P_DIR = Path(__file__).resolve().parent
P2P_DB_PATH = P2P_DIR / "db" / "relay_p2p.db"

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
