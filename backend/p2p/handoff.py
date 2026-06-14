"""P2P handoff logistics: A → station → B within same-town cluster.

Computes:
  1. Pickup leg: seller's address → delivery station (haversine × circuity)
  2. Drop leg: delivery station → buyer's address (haversine × circuity)
  3. Platform fee + seller payout
  4. CO2 saved vs buying new from the distant FC → seller green credits
"""
from __future__ import annotations

import math

from . import config


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(a)), 3)


def _road_km(lat1: float, lng1: float, lat2: float, lng2: float,
             circuity: float = 1.4) -> float:
    return round(_haversine_km(lat1, lng1, lat2, lng2) * circuity, 2)


def _bike_co2(km: float) -> float:
    """CO2 (kg) for a single-item P2P motorbike delivery over given road km."""
    return round((km / config.DELIVERY_BIKE["mileage_kmpl"]) * config.DIESEL_CO2_KG_PER_L, 4)


def _truck_co2_per_item(km: float) -> float:
    """CO2 (kg) per item for a fresh unit shipped from the FC (amortized over the truck load)."""
    litres = km / config.FC_CONTAINER_TRUCK["mileage_kmpl"]
    return round(litres * config.DIESEL_CO2_KG_PER_L / config.FC_CONTAINER_TRUCK["avg_items_per_trip"], 4)


# Station coordinates — mirrors demand.py, both copied to avoid routing dependency.
_STATION_COORDS: dict[str, tuple[float, float]] = {
    "UDUPI_CITY":  (13.3409, 74.7421),
    "MANIPAL":     (13.3502, 74.7876),
    "MALPE":       (13.3600, 74.7073),
    "KUNDAPURA":   (13.6260, 74.6920),
    "KARKALA":     (13.2048, 74.9860),
    "BRAHMAVAR":   (13.4233, 74.7494),
}


def compute_handoff(
    *,
    seller_lat: float,
    seller_lng: float,
    buyer_lat: float,
    buyer_lng: float,
    station_id: str,
    region: str = "udupi",
    asking_price: float,
) -> dict:
    """Full P2P handoff logistics computation.

    Returns pickup_km, drop_km, total_km, platform fee, seller payout.
    Never raises — missing coords fall back to 0.0 km.
    """
    station_coords = _STATION_COORDS.get((station_id or "").upper())

    if station_coords:
        s_lat, s_lng = station_coords
        pickup_km = _road_km(seller_lat, seller_lng, s_lat, s_lng)
        drop_km = _road_km(s_lat, s_lng, buyer_lat, buyer_lng)
    else:
        pickup_km = 0.0
        drop_km = _road_km(seller_lat, seller_lng, buyer_lat, buyer_lng)

    total_p2p_km = round(pickup_km + drop_km, 2)

    # CO2: same-town P2P delivery vs shipping a fresh unit from the distant FC.
    fc_road_km = config.UDUPI_FC_ROAD_KM if region == "udupi" else config.BLR_FC_ROAD_KM
    co2_p2p = _bike_co2(total_p2p_km)
    co2_new_from_fc = _truck_co2_per_item(fc_road_km)
    co2_saved = round(max(0.0, co2_new_from_fc - co2_p2p), 4)
    green_credits = round(co2_saved * config.GREEN_CREDIT_RATE_PER_KG_CO2, 2)

    # Platform fee (illustrative, 5% of asking price)
    platform_fee = round(asking_price * 0.05, 2)
    seller_payout = round(asking_price - platform_fee, 2)

    return {
        "station_id": station_id,
        "region": region,
        "legs": {
            "pickup_km": pickup_km,
            "drop_km": drop_km,
            "total_km": total_p2p_km,
            "vehicle": config.DELIVERY_BIKE["name"],
        },
        "co2": {
            "p2p_kg": co2_p2p,
            "new_unit_from_fc_kg": co2_new_from_fc,
            "saved_kg": co2_saved,
            "fc_road_km_used": fc_road_km,
        },
        "green_credits": {
            "co2_saved_kg": co2_saved,
            "rate_per_kg": config.GREEN_CREDIT_RATE_PER_KG_CO2,
            "credits_rs": green_credits,
        },
        "financials": {
            "asking_price": asking_price,
            "platform_fee": platform_fee,
            "seller_payout": seller_payout,
            "green_credits_bonus": green_credits,
            "total_seller_value": round(seller_payout + green_credits, 2),
        },
        "logistics_note": (
            f"Pickup from seller → {station_id} ({pickup_km} km), "
            f"then station → buyer ({drop_km} km). "
            f"Same-town handoff avoids a {fc_road_km:.0f} km fresh-unit haul from the FC."
        ),
    }
