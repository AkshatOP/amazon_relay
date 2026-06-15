"""Time-triggered resale nudge notification builder.

The notifier is the ENTRY POINT of the P2P flow. It fires when:
  today - purchase_date  falls inside the category's resale window
  (e.g. baby_walker: 1.5 – 3.0 years from purchase)

'simulate_years' allows demo time-travel without altering the DB — pass 2.0 to pretend
the purchase happened 2 years ago even if purchase_date is today.

Returning a structured dict (never raises). If the item isn't in-window, still returns
a dict explaining why — the caller decides whether to show or suppress it.
"""
from __future__ import annotations

import datetime

from .lifespan_table import in_resale_window, window_position, resale_window
from .pricing import stage1_price


def _compute_age(purchase_date: str, simulate_years: float | None) -> float:
    """Age in years. simulate_years overrides the real calendar age for demos."""
    if simulate_years is not None:
        return max(0.0, float(simulate_years))
    try:
        d = datetime.date.fromisoformat(purchase_date)
        delta = datetime.date.today() - d
        return max(0.0, round(delta.days / 365.25, 3))
    except Exception:
        return 0.0


def build_resale_nudge(
    *,
    user_name: str,
    category: str,
    item_name: str,
    original_price: float,
    purchase_date: str,
    warranty_total_years: float = 0.0,
    simulate_years: float | None = None,
) -> dict:
    """Build the nudge payload for a single purchase.

    Returns a structured dict with:
      - in_window: bool — whether to actually show the nudge
      - age_years, window_position
      - stage1_pricing: pre-grade price estimate (assumes Grade C)
      - message: human-readable push-notification text
    """
    age_years = _compute_age(purchase_date, simulate_years)
    cat = (category or "").strip().lower()
    in_win = in_resale_window(cat, age_years)
    position = window_position(cat, age_years)
    min_y, max_y, avg_y = resale_window(cat)

    pricing = stage1_price(original_price, cat, age_years, warranty_total_years)

    est_price = pricing["final_price"]
    est_base = pricing["base_price"]

    if in_win:
        if age_years <= avg_y:
            urgency = "Prime resale window — best price right now."
        else:
            urgency = "Still a good window, but value decreases as time passes."
        message = (
            f"Hi {user_name}, your {item_name} is now {age_years:.1f} years old — "
            f"perfect timing to resell! {urgency} "
            f"Estimated value: Rs {est_price:,.0f} (pre-grade estimate). "
            f"Grade it to unlock the exact price — grading A or B raises this number."
        )
        call_to_action = "List for resale now"
    elif position == "before_window":
        message = (
            f"Your {item_name} is {age_years:.1f} years old. "
            f"The best resale window starts at {min_y:.1f} years."
        )
        call_to_action = None
    else:
        message = (
            f"Your {item_name} is {age_years:.1f} years old — past the typical resale window "
            f"({max_y:.1f} yr). You may still list it, but demand will be lower."
        )
        call_to_action = "List anyway"

    return {
        "in_window": in_win,
        "window_position": position,
        "age_years": round(age_years, 2),
        "resale_window": {"min_years": min_y, "max_years": max_y, "avg_years": avg_y},
        "simulate_years": simulate_years,
        "stage1_pricing": pricing,
        "estimated_price": est_price,
        "estimated_base_price": est_base,
        "message": message,
        "call_to_action": call_to_action,
        "note": (
            "Stage-1 estimate assumes Grade C condition. "
            "Grading to A/B will raise the price (B → +62.5%, A → +112.5% vs C)."
        ),
    }
