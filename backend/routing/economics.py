"""Per-item fuel + CO2 + cost model, and the COMPUTED donate/liquidate boundary.

FRAMING (important): every return arrives inside the return window — it is a FRESH, current-
generation unit at full original value. There is no age depreciation here. Routing is purely
logistics arbitrage:

  Cost of local intercept  vs  Cost of hauling the return to the FC + shipping a FRESH unit
                                back out to fulfill the same nearby order.

The honest core: a truck's fuel burn and emissions are SHARED across everything it carries, so
every cost/CO2 figure here is *per item* (amortized over the vehicle's typical load). This is
why local-intercept savings are small in a metro (the middle-mile truck carries 250 items, so
its per-item haul cost is tiny) but large in a tier-3 city (where the FC is ~600 km away and
the fresh-unit reship from the distant FC adds another long-haul leg).

We do not fudge the metro numbers. The self-test at the bottom prints both a metro and a
tier-3 scenario so the model can be verified as honest before anyone trains on it.
"""
from __future__ import annotations

from . import config


# --- Per-item amortized leg physics ------------------------------------------

def leg_fuel_cost(distance_km: float, vehicle: dict) -> float:
    """Per-item fuel cost (Rs) for one leg: litres burned / items shared * diesel rate."""
    litres = distance_km / vehicle["mileage_kmpl"]
    return litres * config.DIESEL_RATE_PER_L / vehicle["avg_items_per_trip"]


def leg_co2(distance_km: float, vehicle: dict) -> float:
    """Per-item CO2 (kg) for one leg: litres burned / items shared * emission factor."""
    litres = distance_km / vehicle["mileage_kmpl"]
    return litres * config.DIESEL_CO2_KG_PER_L / vehicle["avg_items_per_trip"]


# --- The two cost paths ------------------------------------------------------

def logistics_cost_full_path(leg1_km: float, leg2_km: float,
                              fc_to_buyer_km: float = 0.0) -> dict:
    """True cost of NOT intercepting locally. Per item.

    Includes:
      leg1: customer → RCC (return comes in, mini-truck)
      leg2: RCC → FC (long middle-mile haul, container truck — the expensive bit we delete)
      reship: FC → nearby buyer (a FRESH unit goes back out to fulfill the same order)
              This is the hidden cost of the normal path: the FC must ship a new unit out to
              the same buyer who would have received the intercepted return. Omitting it
              understates the savings of local intercept.
      + inspection + RCC storage

    fc_to_buyer_km = 0 when there is no specific nearby order to compare against (the reship
    leg is omitted and this reduces to the plain inbound reverse-logistics cost).
    """
    # Reship vehicle: local last-mile (≤50 km) uses DELIVERY_VEHICLE (mini-truck, 18 items/trip);
    # long-haul from a distant FC uses LEG2_VEHICLE (container truck, 250 items/trip). This
    # matches spec: "LEG2_VEHICLE for long FC legs, LEG1_VEHICLE for local legs."
    reship_vehicle = (config.LEG2_VEHICLE if fc_to_buyer_km > 50 else config.DELIVERY_VEHICLE)
    leg1_fuel = leg_fuel_cost(leg1_km, config.LEG1_VEHICLE)
    leg2_fuel = leg_fuel_cost(leg2_km, config.LEG2_VEHICLE)
    reship_fuel = leg_fuel_cost(fc_to_buyer_km, reship_vehicle) if fc_to_buyer_km else 0.0
    storage = config.RCC_STORAGE_COST_PER_DAY * config.RCC_HOLD_DAYS
    inspection = config.INSPECTION_COST_PER_ITEM
    total = leg1_fuel + leg2_fuel + reship_fuel + inspection + storage
    co2 = (leg_co2(leg1_km, config.LEG1_VEHICLE)
           + leg_co2(leg2_km, config.LEG2_VEHICLE)
           + (leg_co2(fc_to_buyer_km, reship_vehicle) if fc_to_buyer_km else 0.0))
    return {
        "leg1_fuel": round(leg1_fuel, 2),
        "leg2_fuel": round(leg2_fuel, 2),
        "reship_fuel": round(reship_fuel, 2),
        "inspection": round(inspection, 2),
        "storage": round(storage, 2),
        "total": round(total, 2),
        "co2_kg": round(co2, 4),
    }


def logistics_cost_local_intercept(pickup_km: float, delivery_km: float) -> dict:
    """Local intercept: customer -> RCC (pickup) -> nearby buyer (delivery). Per item.

    The long FC haul AND the fresh-unit reship are both DELETED. The item turns around within
    the RCC's 1-2 day consolidation window and goes straight to the buyer who ordered it new.
    """
    pickup_fuel = leg_fuel_cost(pickup_km, config.LEG1_VEHICLE)
    delivery_fuel = leg_fuel_cost(delivery_km, config.DELIVERY_VEHICLE)
    inspection = config.INSPECTION_COST_PER_ITEM
    total = pickup_fuel + delivery_fuel + inspection
    co2 = leg_co2(pickup_km, config.LEG1_VEHICLE) + leg_co2(delivery_km, config.DELIVERY_VEHICLE)
    return {
        "pickup_fuel": round(pickup_fuel, 2),
        "delivery_fuel": round(delivery_fuel, 2),
        "inspection": round(inspection, 2),
        "total": round(total, 2),
        "co2_kg": round(co2, 4),
    }


# --- The COMPUTED donate-vs-liquidate boundary (NOT hardcoded) ---------------

def liquidation_net(item_value: float, category: str, haul_cost: float) -> float:
    """Net Rs recovered by liquidating: scrap recovery minus the (weighted) haul to do it.

    Uses full original_price as item_value — returns are treated as new units at full value.
    Heavy/bulky categories (high weight_factor) cost more to haul to a liquidator, eroding
    the already-poor 15% scrap recovery.
    """
    gross = item_value * config.LIQUIDATION_RECOVERY_RATE
    weight = config.profile_for(category)["weight_factor"]
    return gross - haul_cost * weight


def donate_or_liquidate(item_value: float, category: str, haul_cost: float) -> str:
    """Choose DONATE vs LIQUIDATE from category economics — the boundary EMERGES, not hardcoded.

    A cheap heavy book (poor scrap recovery after a costly haul, decent donation ESG value)
    donates; a cheap but light/liquid watch (low haul cost, low donation value) may liquidate.
    No `if price < X` rule — the break-even is computed per category from full original value.
    """
    recoverable = liquidation_net(item_value, category, haul_cost)
    donation_benefit = config.profile_for(category)["donation_value"]
    return "DONATE" if recoverable <= donation_benefit else "LIQUIDATE"


# --- Self-test: prove the model is honest (metro vs tier-3) ------------------

def _print_scenario(title: str, leg1_km: float, leg2_km: float,
                    pickup_km: float, delivery_km: float,
                    fc_to_buyer_km: float) -> None:
    full = logistics_cost_full_path(leg1_km, leg2_km, fc_to_buyer_km)
    local = logistics_cost_local_intercept(pickup_km, delivery_km)
    rupees_saved = round(full["total"] - local["total"], 2)
    co2_saved = round(full["co2_kg"] - local["co2_kg"], 4)
    print(f"\n=== {title} ===")
    print(f"  geometry: leg1(cust->RCC)={leg1_km} km | leg2(RCC->FC)={leg2_km} km | "
          f"local delivery={delivery_km} km | FC->buyer reship={fc_to_buyer_km} km")
    print(f"  FULL PATH  (cust->RCC->FC + FC->buyer reship): Rs {full['total']:>7.2f}/item, "
          f"CO2 {full['co2_kg']:.4f} kg/item")
    print(f"             breakdown: leg1={full['leg1_fuel']}, leg2={full['leg2_fuel']}, "
          f"reship={full['reship_fuel']}, inspection={full['inspection']}, storage={full['storage']}")
    print(f"  LOCAL      (cust->RCC->buyer, zero FC legs): Rs {local['total']:>7.2f}/item, "
          f"CO2 {local['co2_kg']:.4f} kg/item")
    print(f"  ---> SAVINGS if local: Rs {rupees_saved}/item | CO2 saved {co2_saved} kg/item")
    if co2_saved < 0:
        print("       (note: CO2 saving is slightly NEGATIVE — honest: the shared middle-mile "
              "truck is so efficient per item in a metro that two local legs emit a touch more.)")


if __name__ == "__main__":
    print("Relay HUB routing — economics self-test (per-item, amortized).")
    print(f"diesel=Rs{config.DIESEL_RATE_PER_L}/L, CO2={config.DIESEL_CO2_KG_PER_L} kg/L, "
          f"leg2 truck shares {config.LEG2_VEHICLE['avg_items_per_trip']} items/trip.")
    print("Full-path cost now includes the FC->buyer RESHIP leg (the fresh unit Amazon must")
    print("send out to fulfill the same order the local intercept would have served).")

    # METRO: FC only ~22 km from RCC. Buyer is ~5 km from RCC, so FC->buyer ~27 km.
    _print_scenario(
        "METRO (Bengaluru, FC ~22 km from RCC)",
        leg1_km=6.0, leg2_km=22.0, pickup_km=6.0, delivery_km=5.0, fc_to_buyer_km=27.0,
    )
    # TIER-3: FC ~612 km from RCC. Buyer is local (~5 km from RCC), so FC->buyer ~617 km.
    # Both the inbound haul AND the fresh-unit reship are long — the intercept deletes BOTH.
    _print_scenario(
        "TIER-3 (FC ~612 km from RCC)",
        leg1_km=6.0, leg2_km=config.WAREHOUSE_EQUIVALENT_KM,
        pickup_km=6.0, delivery_km=5.0,
        fc_to_buyer_km=config.WAREHOUSE_EQUIVALENT_KM + 5.0,
    )
    print("\nTakeaway: the impact story lives in TIER-3 — local intercept deletes BOTH the long")
    print("inbound haul AND the long outbound reship. Metro savings are real but modest.")
