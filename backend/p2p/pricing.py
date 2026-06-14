"""P2P Resale Exchange — age + condition depreciation pricing.

THIS IS THE INTENDED HOME for the age-depreciation formula that routing/pricing.py was
stubbed/reserved for. The routing module treats every return as a NEW unit at full original
price (logistics arbitrage, no depreciation). P2P is the ONLY module where age matters.

Two-stage pricing:
  Stage 1 (pre-grade): age-based estimate only, assuming Grade C condition.
    pre_grade_price = original_price × age_factor(category, age_years) × CONDITION_MULTIPLIER["C"]
    Shown to seller A in the nudge notification — motivates the resale action.

  Stage 2 (post-grade): condition is known from the grading agent.
    post_grade_price = original_price × age_factor(category, age_years) × CONDITION_MULTIPLIER[grade]
    Because Stage 1 assumed C (0.40) and C is the midpoint:
      Grade A (0.85) → price RISES vs Stage 1  ✓
      Grade B (0.65) → price RISES vs Stage 1  ✓
      Grade C (0.40) → price UNCHANGED          ✓
      Grade D (0.15) → price FALLS vs Stage 1  ✓
    The "price almost always goes up after grading" promise is STRUCTURALLY TRUE, not claimed.

The CONDITION_MULTIPLIER values are illustrative (representative resale market fractions).
The AGE_VALUE_FLOOR values (retained fraction at max useful life) are similarly illustrative.
"""
from __future__ import annotations

from . import config
from .lifespan_table import resale_window

# Fraction of (original_price × age_factor) depending on condition grade.
# Stage 1 uses "C" = 0.40 as the conservative assumption.
# Grading to A or B structurally raises the price.
CONDITION_MULTIPLIER: dict[str, float] = {
    "A": 0.85,  # near-new quality; only cosmetic marks, fully functional
    "B": 0.65,  # light wear; fully functional, minor visible marks
    "C": 0.40,  # moderate wear; functional, noticeable marks/fading  ← Stage-1 assumption
    "D": 0.15,  # significant damage; may have functional issues
}

# Fraction of original_price the item retains at max_years (end of useful life).
# At avg_years and below, age_factor = 1.0 (peak resale window — no age penalty).
# Decay is linear from avg_years (1.0) to max_years (floor).
# Values are ILLUSTRATIVE / REPRESENTATIVE.
AGE_VALUE_FLOOR: dict[str, float] = {
    # --- Grading API: visual path ---
    "shoes":        0.35,   # fashion cycle; condition matters more than age
    "footwear":     0.35,
    "clothing":     0.20,   # steep drop; fashion/season sensitivity
    "phone_case":   0.20,   # value tied to compatible phone model
    "bag":          0.55,
    "watch":        0.70,   # durable; mechanical holds value especially well
    "baby_gear":    0.50,   # functional items; safety recall risk caps value
    "toy":          0.25,   # safety + fashion cycle; steep after child's window
    "book":         0.70,   # holds value; edition matters more than age

    # --- Grading API: functional path ---
    "charger":      0.25,   # commodity; degrades with use
    "power_bank":   0.30,   # battery capacity loss is visible at end of life
    "speaker":      0.45,
    "cable":        0.20,   # commodity; near-worthless at end of window
    "mouse":        0.40,
    "keyboard":     0.50,   # mechanical keyboards retain value well

    # --- Grading API: hybrid path ---
    "laptop":       0.40,
    "headphones":   0.45,
    "camera":       0.55,   # sensor quality is timeless
    "appliance":    0.45,

    # --- Extra categories ---
    "baby_monitor": 0.60,   # safety category; still works well at end of life
    "smartphone":   0.20,   # fast tech cycle; steep drop at end of support window
    "backpack":     0.55,
}
_DEFAULT_FLOOR = 0.45


def age_factor(category: str, age_years: float) -> float:
    """Fraction of original value retained based on age alone.

    Returns 1.0 for ages up to avg_years (peak resale window — no penalty).
    Decays linearly from 1.0 at avg_years to AGE_VALUE_FLOOR at max_years.
    Clamped to floor for items past max_years.
    """
    _, max_y, avg_y = resale_window(category)
    floor = AGE_VALUE_FLOOR.get((category or "").strip().lower(), _DEFAULT_FLOOR)
    if age_years <= avg_y:
        return 1.0
    window = max_y - avg_y
    if window <= 0:
        return floor
    fraction = min((age_years - avg_y) / window, 1.0)
    return round(1.0 - fraction * (1.0 - floor), 4)


def warranty_bonus(original_price: float, age_years: float, warranty_total_years: float) -> float:
    """Price uplift from transferable remaining warranty.

    Each remaining warranty year adds WARRANTY_BONUS_RATE × original_price.
    Raises buyer confidence (transferable warranty = real residual value) and
    seller payout. Returns 0.0 if warranty already expired.
    """
    remaining = max(0.0, warranty_total_years - age_years)
    return round(original_price * remaining * config.WARRANTY_BONUS_RATE, 2)


def price_estimate(
    original_price: float,
    category: str,
    age_years: float,
    grade: str = "C",
    warranty_total_years: float = 0.0,
) -> dict:
    """Compute the P2P resale price for a given grade and age.

    Returns a full breakdown dict. grade defaults to "C" for Stage-1 (pre-grade) estimates.
    """
    cat = (category or "").strip().lower()
    g = (grade or "C").upper()
    if g not in CONDITION_MULTIPLIER:
        g = "C"

    af = age_factor(cat, age_years)
    cond_mult = CONDITION_MULTIPLIER[g]
    base_price = round(original_price * af * cond_mult, 2)

    # Stage-1 baseline (assuming C) for comparison
    stage1_base = round(original_price * af * CONDITION_MULTIPLIER["C"], 2)

    wb = warranty_bonus(original_price, age_years, warranty_total_years)
    final = round(base_price + wb, 2)

    return {
        "original_price": original_price,
        "age_years": round(age_years, 2),
        "age_factor": af,
        "grade": g,
        "condition_multiplier": cond_mult,
        "base_price": base_price,
        "warranty_bonus": wb,
        "final_price": final,
        "stage1_baseline": stage1_base,
        "price_delta_vs_stage1": round(base_price - stage1_base, 2),
        "price_went_up": base_price > stage1_base,
        "breakdown": {
            "age": f"{original_price} × {af} (age factor at {age_years:.1f}yr) = {round(original_price * af, 2)}",
            "condition": f"× {cond_mult} (Grade {g}) = {base_price}",
            "warranty": f"+ {wb} ({max(0.0, warranty_total_years - age_years):.1f}yr remaining @ {config.WARRANTY_BONUS_RATE*100:.0f}% / yr)",
            "total": f"= Rs {final}",
        },
    }


def stage1_price(original_price: float, category: str, age_years: float,
                 warranty_total_years: float = 0.0) -> dict:
    """Pre-grade Stage-1 estimate. Assumes Grade C (conservative floor)."""
    result = price_estimate(original_price, category, age_years, grade="C",
                            warranty_total_years=warranty_total_years)
    result["stage"] = 1
    result["note"] = "Assumes Grade C (average condition). Grading to A/B raises this price."
    return result


def stage2_price(original_price: float, category: str, age_years: float,
                 grade: str, warranty_total_years: float = 0.0) -> dict:
    """Post-grade Stage-2 price. Uses the actual graded condition."""
    result = price_estimate(original_price, category, age_years, grade=grade,
                            warranty_total_years=warranty_total_years)
    result["stage"] = 2
    if result["price_went_up"]:
        result["note"] = (f"Grade {grade} is better than C assumption → price rose "
                          f"by Rs {result['price_delta_vs_stage1']} vs Stage-1 estimate.")
    elif result["price_delta_vs_stage1"] < 0:
        result["note"] = (f"Grade {grade} (damaged) is below C assumption → price fell "
                          f"by Rs {abs(result['price_delta_vs_stage1'])} vs estimate. "
                          f"Disclosed honestly to seller.")
    else:
        result["note"] = "Grade C confirmed — price matches Stage-1 estimate exactly."
    return result
