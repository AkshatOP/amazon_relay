"""Generate ~8000 synthetic rows of routing training data.

FRAMING: returns are treated as NEW units at full original_price. There is no age
depreciation and no resale-price computation here. The routing decision is logistics
arbitrage: is intercepting the return locally cheaper/greener than hauling it to the FC
and reshipping a fresh unit to the same nearby buyer?

The LABELS come from a rule engine (`rule_engine_decide`) that is the SAME engine imported
by `router.py` as its no-model fallback, so training labels and the fallback never drift.

Run: python -m routing.model.generate_training_data
"""
from __future__ import annotations

import csv
import random

from ..config import (
    CATEGORY_ORDER, NO_LOCAL_OPTION_SENTINEL, REFURB_COST_PER_ITEM, REFURB_RESALE_FRACTION,
    TRAINING_CSV, category_ordinal, profile_for,
)
from ..economics import (
    donate_or_liquidate, liquidation_net, logistics_cost_full_path,
    logistics_cost_local_intercept,
)

# Feature column order — shared contract between the CSV, the trainer, and the router.
# Removed from old version: age_months, resale_price, recovery_pct (deprecated resale pricing).
# Added: savings (true economic benefit of local intercept vs FC round-trip + reship).
FEATURE_COLUMNS = [
    "grade_ordinal", "score", "defect_count", "confidence", "resale_eligible",
    "refurbish_recommended", "original_price",
    "category_ordinal", "nearby_demand", "demand_distance_km",
    "logistics_full_cost", "logistics_local_cost", "savings",
]
LABEL_COLUMN = "decision"

GRADE_BY_ORDINAL = {3: "A", 2: "B", 1: "C", 0: "D"}
SCORE_BAND = {"A": (8, 10), "B": (5, 7), "C": (3, 4), "D": (1, 2)}
DEFECTS_BY_GRADE = {"A": (0, 0), "B": (0, 2), "C": (1, 4), "D": (3, 7)}

# Original-price ranges per category (Rs).
PRICE_RANGE = {
    "footwear": (800, 4000), "shoes": (1000, 6000), "watch": (1000, 15000),
    "phonecase": (200, 1200), "toy": (300, 3000), "book": (150, 900),
    "backpack": (700, 4500), "bag": (600, 4000),
}


def rule_engine_decide(f: dict) -> tuple[str, bool]:
    """Decide a route from a feature dict. Returns (decision, decided_by_hard_gate).

    Returns are treated as NEW units: item_value = original_price, no depreciation.
    The gates implement logistics arbitrage, not resale-margin analysis.

    Hard gates (deterministic, auditable):
      Gate 1 — grade D OR (not resale-eligible AND not refurbishable) → donate/liquidate
      Gate 2 — not resale-eligible AS NEW but fixable → REFURBISH (goes to FC for repair)
      Gate 3 — good unit + real nearby buyer + local intercept saves money → RESELL_LOCAL

    Fuzzy zone (no gate fires): good item, no nearby buyer, or savings ≤ 0 → XGBoost decides.
    Rule-fallback for fuzzy zone: decent score → REFURBISH (send to FC as standard stock),
    else donate_or_liquidate.
    """
    cat = f["category"]
    haul = f["logistics_full_cost"]
    item_value = f["original_price"]

    # --- Gate 1: too damaged, OR eligible for neither resale nor refurb ------
    if f["grade_ordinal"] == 0 or (not f["resale_eligible"] and not f["refurbish_recommended"]):
        return donate_or_liquidate(item_value, cat, haul), True

    # --- Gate 2: not resale-eligible as new, but fixable ---------------------
    # Goes to FC as a refurb unit (cannot fulfill a "new order" in current state).
    if (not f["resale_eligible"]) and f["refurbish_recommended"]:
        refurb_net = item_value * REFURB_RESALE_FRACTION - REFURB_COST_PER_ITEM - haul
        if refurb_net > 0:
            return "REFURBISH", True
        return donate_or_liquidate(item_value, cat, haul), True

    # --- Gate 3: good unit + real local buyer + intercept saves money --------
    # savings > 0 means intercepting locally is cheaper than FC haul + fresh-unit reship.
    if (f["grade_ordinal"] >= 2 and f["score"] >= 6 and f["resale_eligible"]
            and f["nearby_demand"] == 1 and f["savings"] > 0):
        return "RESELL_LOCAL", True

    # --- Fuzzy zone (XGBoost earns its keep here) ----------------------------
    # Typical case: good item but no nearby buyer → send to FC as standard restock.
    # Rule-engine fallback for when .pkl is absent:
    refurb_net = item_value * REFURB_RESALE_FRACTION - REFURB_COST_PER_ITEM - haul
    if f["score"] >= 5 and refurb_net > 0:
        return "REFURBISH", False  # standard FC inbound / restock
    return donate_or_liquidate(item_value, cat, haul), False


def _sample_row(rng: random.Random) -> dict:
    category = rng.choice(CATEGORY_ORDER)
    grade_ord = rng.choices([3, 2, 1, 0], weights=[30, 30, 25, 15])[0]
    grade = GRADE_BY_ORDINAL[grade_ord]
    score = rng.randint(*SCORE_BAND[grade])
    defect_count = rng.randint(*DEFECTS_BY_GRADE[grade])
    confidence = round(rng.uniform(0.6, 0.99), 2)
    resale_eligible = int(grade in ("A", "B"))
    # Grade C is the canonical refurbish candidate; occasionally a damaged B/D too.
    refurbish_recommended = int((grade == "C") or (grade == "D" and rng.random() < 0.15))

    lo, hi = PRICE_RANGE[category]
    original_price = rng.randint(lo, hi)
    # No age_months, no depreciation — item is treated as new (fresh return).

    # Geography: span metro (short FC haul) AND tier-3 (long FC haul) for generalization.
    leg1_km = round(rng.uniform(2, 12), 2)
    if rng.random() < 0.5:
        leg2_km = round(rng.uniform(12, 45), 2)    # metro FC
    else:
        leg2_km = round(rng.uniform(350, 650), 2)  # tier-3 FC

    # Nearby demand: ~50% of returns find a buyer within radius.
    nearby_demand = 1 if rng.random() < 0.5 else 0
    if nearby_demand:
        demand_distance_km = round(rng.uniform(0.3, 8.0), 2)
        # Approximate FC->buyer distance: FC is leg2_km from RCC; buyer is demand_distance_km
        # from RCC. Triangle inequality → FC->buyer ≈ leg2_km + demand_distance_km (upper bound,
        # reasonable approximation when FC is far from buyer).
        fc_to_buyer_km = round(leg2_km + demand_distance_km, 2)
        # Full path NOW INCLUDES the reship leg (FC -> buyer) — this is the honest comparison.
        full = logistics_cost_full_path(leg1_km, leg2_km, fc_to_buyer_km)
        local = logistics_cost_local_intercept(leg1_km, demand_distance_km)
        logistics_local_cost = local["total"]
        # savings: how much cheaper local intercept is vs FC haul + reship.
        # Positive savings → intercept wins economically.
        savings = round(full["total"] - local["total"], 2)
    else:
        demand_distance_km = 999.0
        # SENTINEL: no local option. NOT a real cost — a flag the model must learn means
        # "there is no resell-local path". Never a number to average over.
        full = logistics_cost_full_path(leg1_km, leg2_km, 0.0)  # no reship, no buyer
        logistics_local_cost = NO_LOCAL_OPTION_SENTINEL
        savings = 0.0  # no savings possible; model should learn this from nearby_demand=0

    logistics_full_cost = full["total"]

    return {
        "grade": grade,
        "grade_ordinal": grade_ord,
        "score": score,
        "defect_count": defect_count,
        "confidence": confidence,
        "resale_eligible": resale_eligible,
        "refurbish_recommended": refurbish_recommended,
        "original_price": original_price,
        "category": category,
        "category_ordinal": category_ordinal(category),
        "nearby_demand": nearby_demand,
        "demand_distance_km": demand_distance_km,
        "logistics_full_cost": logistics_full_cost,
        "logistics_local_cost": logistics_local_cost,
        "savings": savings,
    }


def generate(n_rows: int = 8000, seed: int = 7) -> None:
    rng = random.Random(seed)
    TRAINING_CSV.parent.mkdir(parents=True, exist_ok=True)

    label_counts: dict[str, int] = {}
    with TRAINING_CSV.open("w", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(FEATURE_COLUMNS + [LABEL_COLUMN])
        for _ in range(n_rows):
            row = _sample_row(rng)
            decision, by_hard_gate = rule_engine_decide(row)
            # ~5% label noise on borderline (fuzzy-zone) rows only.
            if (not by_hard_gate) and rng.random() < 0.05:
                decision = rng.choice([d for d in ["RESELL_LOCAL", "REFURBISH", "DONATE", "LIQUIDATE"]
                                       if d != decision])
            label_counts[decision] = label_counts.get(decision, 0) + 1
            writer.writerow([row[c] for c in FEATURE_COLUMNS] + [decision])

    print(f"Wrote {n_rows} rows -> {TRAINING_CSV}")
    print("Label distribution:", dict(sorted(label_counts.items())))


if __name__ == "__main__":
    generate()
