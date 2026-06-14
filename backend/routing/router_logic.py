"""The routing brain: hard economic gates + XGBoost orchestration -> routing JSON.

FRAMING: every return is a FRESH unit at full original_price — no age, no depreciation.
The decision is logistics arbitrage:

  Local intercept cost  vs  FC haul cost + fresh-unit reship cost

Decision order:
  1. item_value = original_price (unit is new; no pricing step)
  2. Geography: nearest RCC, nearest FC, leg distances
  3. Nearby-demand DB lookup
  4. Dual-path economics (full path WITH reship leg vs local intercept)
  5. Hard gates — if one fires, return with decided_by:"hard_gate"
  6. Else XGBoost over the feature vector
  7. Attach economics payload for the UI

No LLM here. If router_model.pkl is missing we fall back to the SAME rule engine that labelled
the training data (decided_by="rule_fallback"), so the API works before training. Never throws.
"""
from __future__ import annotations

import sqlite3
from functools import lru_cache

from . import config
from .economics import (
    logistics_cost_full_path, logistics_cost_local_intercept,
)
from .geo import customer_path, road_km_between
from .model.generate_training_data import FEATURE_COLUMNS, rule_engine_decide
from .seed_locations import ACTIVE_REGION, get_nodes, get_region

GRADE_ORDINAL = {"A": 3, "B": 2, "C": 1, "D": 0}


@lru_cache(maxsize=1)
def _load_model():
    """Load the trained XGBoost bundle once. Returns None if not trained yet."""
    if not config.MODEL_PATH.exists():
        return None
    try:
        import joblib
        return joblib.load(config.MODEL_PATH)
    except Exception:
        return None


def _find_nearby_buyer(category: str, asin: str, rcc_lat: float, rcc_lng: float,
                       region: str | None = None) -> dict | None:
    """Nearest pending buyer (same category, preferring same asin) within the demand radius.

    Distance is measured from the node where the item sits to the buyer. Filters by region
    so Udupi buyers are never matched to Bengaluru routes and vice versa.
    Returns None if the DB is missing or no buyer is in range.
    """
    if not config.DB_PATH.exists():
        return None
    active = (region or ACTIVE_REGION).strip().lower()
    try:
        conn = sqlite3.connect(config.DB_PATH)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT order_id, asin, buyer_lat, buyer_lng, buyer_pincode "
            "FROM pending_orders WHERE category = ? AND (region = ? OR region IS NULL)",
            (category.strip().lower(), active),
        ).fetchall()
        conn.close()
    except Exception:
        return None

    from .geo import haversine
    # ROAD_CIRCUITY (1.4) means road ≈ 1.4× haversine. Pre-filter using haversine * 1.5
    # (generous buffer) before calling OSRM, so we don't make API calls for clearly-far buyers.
    haversine_cutoff = config.NEARBY_DEMAND_RADIUS_KM / 1.2  # ~10 km haversine → 12 km road
    candidates = [r for r in rows
                  if haversine(rcc_lat, rcc_lng, r["buyer_lat"], r["buyer_lng"]) <= haversine_cutoff]

    best = None
    for r in candidates:
        dist = road_km_between(rcc_lat, rcc_lng, r["buyer_lat"], r["buyer_lng"])
        if dist > config.NEARBY_DEMAND_RADIUS_KM:
            continue
        # Prefer an exact-ASIN match: bias its effective distance slightly closer.
        rank = dist - (0.5 if asin and r["asin"] == asin else 0.0)
        if best is None or rank < best["_rank"]:
            best = {"_rank": rank, "distance_km": round(dist, 2),
                    "buyer_pincode": r["buyer_pincode"], "order_id": r["order_id"]}
    return best


def _rcc_coords(rcc_name: str, region: str | None = None) -> tuple[float, float]:
    nodes = get_nodes(region)
    for r in nodes:
        if r["name"] == rcc_name:
            return r["lat"], r["lng"]
    return nodes[0]["lat"], nodes[0]["lng"]


def _reason_for(decision: str, feat: dict, decided_by: str) -> str:
    cat = feat["category"]
    savings = feat.get("savings", 0)
    if decided_by == "hard_gate":
        if decision == "RESELL_LOCAL":
            return (f"Good condition + nearby buyer for this {cat}; local intercept saves "
                    f"Rs {savings:.0f}/item vs FC haul + reship — skip the warehouse entirely.")
        if decision == "REFURBISH":
            return f"Hard gate: not resale-eligible as new but refurbishable; routing to FC for repair."
        if decision in ("DONATE", "LIQUIDATE"):
            return (f"Hard gate: grade D or ineligible; category economics favour "
                    f"{'donation' if decision == 'DONATE' else 'liquidation'}.")
    base = {
        "RESELL_LOCAL": (f"Good condition for this {cat} with a nearby buyer; "
                         f"local intercept (Rs {savings:.0f} saved) beats FC haul + reship."),
        "REFURBISH": (f"No nearby buyer for this {cat} right now; routing to FC as standard "
                      f"inbound stock for refurb/restock — will fulfill a future order."),
        "DONATE": f"Low net recovery for this {cat}; donation books more social/ESG value than scrap.",
        "LIQUIDATE": f"No viable local or refurb path for this {cat}; liquidation recovers the most.",
    }
    return base.get(decision, f"Routed to {decision}.")


def route_return(grade_json: dict, order_meta: dict) -> dict:
    """Decide the best outcome for a graded return. Never raises."""
    grade = str(grade_json.get("grade", "C")).upper()
    if grade not in GRADE_ORDINAL:
        grade = "C"
    category = str(order_meta.get("category", "footwear")).strip().lower()
    asin = str(order_meta.get("asin", ""))
    # Item is treated as NEW — full original price, no age/depreciation.
    item_value = float(order_meta.get("original_price", 1000) or 1000)

    # Region: "bengaluru" or "udupi". Defaults to ACTIVE_REGION when absent or unknown.
    region_raw = str(order_meta.get("region") or "").strip().lower() or None
    region = region_raw if (region_raw in ("bengaluru", "udupi")) else None

    # 1. Geography
    cust_lat = float(order_meta.get("customer_lat", 12.9166))
    cust_lng = float(order_meta.get("customer_lng", 77.6101))
    path = customer_path(cust_lat, cust_lng, region)
    rcc_lat, rcc_lng = _rcc_coords(path["rcc"], region)

    # 2. Nearby demand
    buyer = _find_nearby_buyer(category, asin, rcc_lat, rcc_lng, region)
    nearby_demand = 1 if buyer else 0
    demand_distance_km = buyer["distance_km"] if buyer else 999.0

    # 3. Dual-path economics
    if buyer:
        # FC->buyer distance: FC is leg2_km from RCC; buyer is demand_distance_km from RCC.
        # Approximation: FC->buyer ≈ leg2_km + buyer_distance (upper bound; correct for tier-3
        # where FC and buyer are on opposite sides of the 600+ km gap).
        fc_to_buyer_km = round(path["leg2_km"] + buyer["distance_km"], 2)
        # Full path includes the reship leg — the honest apples-to-apples comparison.
        full = logistics_cost_full_path(path["leg1_km"], path["leg2_km"], fc_to_buyer_km)
        local = logistics_cost_local_intercept(path["leg1_km"], buyer["distance_km"])
        logistics_local_cost = local["total"]
        co2_local = local["co2_kg"]
        savings = round(full["total"] - local["total"], 2)
        co2_saved = round(full["co2_kg"] - co2_local, 4)

        # Tier-3 projection: only meaningful for metro regions where the FC is close.
        # For Udupi (external FC already ~400 km), the real leg2 IS the tier-3 story —
        # no synthetic 612 km projection needed; show the actual numbers instead.
        rdef = get_region(region)
        if rdef.get("external_fc"):
            tier3_projection = None  # real FC distance is the long-haul story
        else:
            t3_fc_to_buyer = round(config.WAREHOUSE_EQUIVALENT_KM + buyer["distance_km"], 2)
            full_t3 = logistics_cost_full_path(path["leg1_km"], config.WAREHOUSE_EQUIVALENT_KM,
                                               t3_fc_to_buyer)
            tier3_projection = {
                "warehouse_km": config.WAREHOUSE_EQUIVALENT_KM,
                "local_delivery_km": buyer["distance_km"],
                "savings_inr": round(full_t3["total"] - local["total"], 2),
                "co2_saved_kg": round(full_t3["co2_kg"] - co2_local, 4),
            }
    else:
        # No local option — base reverse-logistics cost only (no reship leg to add).
        full = logistics_cost_full_path(path["leg1_km"], path["leg2_km"], 0.0)
        logistics_local_cost = config.NO_LOCAL_OPTION_SENTINEL
        co2_local = None
        savings = 0.0
        co2_saved = 0.0
        tier3_projection = None

    # Feature dict shared by rule engine and XGBoost.
    feat = {
        "grade": grade,
        "grade_ordinal": GRADE_ORDINAL[grade],
        "score": int(grade_json.get("score", 5) or 5),
        "defect_count": len(grade_json.get("defects", []) or []),
        "confidence": float(grade_json.get("confidence", 0.7) or 0.7),
        "resale_eligible": int(bool(grade_json.get("resale_eligible", grade in ("A", "B")))),
        "refurbish_recommended": int(bool(grade_json.get("refurbish_recommended", grade == "C"))),
        "original_price": item_value,
        "category": category,
        "category_ordinal": config.category_ordinal(category),
        "nearby_demand": nearby_demand,
        "demand_distance_km": demand_distance_km,
        "logistics_full_cost": full["total"],
        "logistics_local_cost": logistics_local_cost,
        "savings": savings,
    }

    # 4. Hard gates (and canonical rule decision for fallback).
    rule_decision, by_hard_gate = rule_engine_decide(feat)

    if by_hard_gate:
        decision, decided_by = rule_decision, "hard_gate"
        confidence = 1.0
        scores = {d: (1.0 if d == decision else 0.0) for d in config.DECISIONS}
    else:
        model = _load_model()
        if model is None:
            decision, decided_by = rule_decision, "rule_fallback"
            confidence = 0.7
            scores = {d: (1.0 if d == decision else 0.0) for d in config.DECISIONS}
        else:
            # 5. XGBoost over the feature vector.
            import numpy as np
            vec = np.array([[float(feat[c]) for c in FEATURE_COLUMNS]], dtype=float)
            probs = model["model"].predict_proba(vec)[0]
            order = model["decisions"]
            scores = {order[i]: round(float(probs[i]), 4) for i in range(len(order))}
            decision = max(scores, key=scores.get)
            decided_by = "xgboost"
            confidence = round(float(max(probs)), 4)

    # 6. Assemble output.
    return {
        "decision": decision,
        "decided_by": decided_by,
        "reason": _reason_for(decision, feat, decided_by),
        "confidence": confidence,
        "scores": {d: scores.get(d, 0.0) for d in config.DECISIONS},
        "geography": {
            "nearest_rcc": path["rcc"],
            "rcc_distance_km": path["leg1_km"],
            "nearest_fc": path["fc"],
            "fc_distance_km": path["leg2_km"],
            "node_type": path.get("node_type", "RCC"),
            "holding_capacity": path.get("holding_capacity"),
            "region": region or ACTIVE_REGION,
        },
        "economics": {
            "original_price": item_value,
            "full_path_cost": full["total"],
            "local_intercept_cost": (None if logistics_local_cost == config.NO_LOCAL_OPTION_SENTINEL
                                     else logistics_local_cost),
            "savings_inr": savings,
            "co2_full_kg": full["co2_kg"],
            "co2_local_kg": co2_local,
            "co2_saved_kg": co2_saved,
            "warehouse_equivalent_km": config.WAREHOUSE_EQUIVALENT_KM,
            "tier3_projection": tier3_projection,
        },
        "match": {
            "buyer_found": bool(buyer),
            "buyer_distance_km": (buyer["distance_km"] if buyer else None),
            "buyer_pincode": (buyer["buyer_pincode"] if buyer else None),
        },
    }


def intercept_decision(*, region, category, original_price,
                       customer_lat, customer_lng, buyer_lat, buyer_lng) -> dict:
    """Dynamic 'hold at RCC then a buyer appears' decision for a resale-eligible held unit.

    The item is already collected and sitting at its nearest RCC/station. A new buyer is
    chosen on the map. We compare, fully dynamically from the real road distances:
      local intercept  = RCC -> buyer delivery (the held unit goes straight out)
      full FC path     = RCC -> FC haul  +  FC -> buyer reship (a fresh unit)
    If intercepting locally is cheaper/greener (savings > 0) -> RESELL_LOCAL to that buyer;
    otherwise it's cheaper to fulfil from the FC -> SHIP_TO_FC. Never raises.
    """
    region = region if (region in ("bengaluru", "udupi")) else None
    item_value = float(original_price or 1000)

    path = customer_path(float(customer_lat), float(customer_lng), region)
    rcc_lat, rcc_lng = _rcc_coords(path["rcc"], region)
    buyer_km = road_km_between(rcc_lat, rcc_lng, float(buyer_lat), float(buyer_lng))
    fc_to_buyer_km = round(path["leg2_km"] + buyer_km, 2)

    full = logistics_cost_full_path(path["leg1_km"], path["leg2_km"], fc_to_buyer_km)
    local = logistics_cost_local_intercept(path["leg1_km"], buyer_km)
    savings = round(full["total"] - local["total"], 2)
    co2_saved = round(full["co2_kg"] - local["co2_kg"], 4)
    intercept = savings > 0
    decision = "RESELL_LOCAL" if intercept else "SHIP_TO_FC"

    rcc = path["rcc"]
    if intercept:
        reason = (f"Buyer {buyer_km:.1f} km from {rcc}; routing the held unit straight to them "
                  f"saves Rs {savings:.0f}/item and {co2_saved:.2f} kg CO2 vs an FC haul + fresh-unit reship.")
    else:
        reason = (f"Buyer {buyer_km:.1f} km away; fulfilling from {path['fc']} is cheaper than "
                  f"intercepting locally (no positive savings). Ship the held unit to the FC.")

    return {
        "decision": decision,
        "decided_by": "intercept_calc",
        "reason": reason,
        "confidence": 1.0,
        "geography": {
            "nearest_rcc": rcc, "rcc_distance_km": path["leg1_km"],
            "nearest_fc": path["fc"], "fc_distance_km": path["leg2_km"],
            "node_type": path.get("node_type", "RCC"), "region": region or ACTIVE_REGION,
        },
        "economics": {
            "original_price": item_value,
            "full_path_cost": full["total"], "local_intercept_cost": local["total"],
            "savings_inr": savings, "co2_full_kg": full["co2_kg"],
            "co2_local_kg": local["co2_kg"], "co2_saved_kg": co2_saved,
        },
        "match": {
            "buyer_found": True, "buyer_distance_km": round(buyer_km, 2),
            "buyer_lat": float(buyer_lat), "buyer_lng": float(buyer_lng),
        },
    }
