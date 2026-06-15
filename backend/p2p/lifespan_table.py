"""Category useful-life windows for the P2P resale time-trigger.

The notification fires when  today − purchase_date  falls in  [min_years, max_years].
At avg_years the item is in the PEAK resale window — highest age_factor, best value.

All values are ILLUSTRATIVE / REPRESENTATIVE — not official Amazon data. Sourced from
general consumer-electronics and lifestyle-goods market knowledge (June 2026).
Label clearly as such in any external-facing copy.
"""
from __future__ import annotations

# (min_years, max_years, avg_years)
# min  = earliest point it makes sense to resell (still has good residual)
# max  = end of typical useful life; items past this rarely find buyers
# avg  = peak resale window midpoint; age_factor = 1.0 here
LIFESPAN_YEARS: dict[str, tuple[float, float, float]] = {
    # --- Grading API: visual path ---
    "shoes":        (1.0, 2.0, 1.5),
    "footwear":     (1.0, 2.0, 1.5),   # alias for shoes
    "clothing":     (0.5, 2.0, 1.0),   # fast fashion cycle; season-sensitive
    "phone_case":   (1.0, 3.0, 2.0),   # tied to phone model lifespan
    "bag":          (2.0, 4.0, 3.0),
    "watch":        (4.0, 8.0, 5.0),   # durable; mechanical holds value
    "baby_gear":    (1.0, 4.0, 2.5),   # strollers/high chairs; safety-driven resale
    "toy":          (1.0, 3.0, 2.0),
    "book":         (5.0, 20.0, 10.0), # editions matter more than age

    # --- Grading API: functional path ---
    "charger":      (1.0, 3.0, 2.0),   # degrades with charge cycles
    "power_bank":   (1.5, 3.5, 2.5),   # battery capacity drops noticeably after ~2 yr
    "speaker":      (2.0, 5.0, 3.0),   # portable bluetooth speakers
    "cable":        (0.5, 2.0, 1.0),   # wear at connectors; short window
    "mouse":        (1.5, 4.0, 2.5),
    "keyboard":     (2.0, 5.0, 3.5),   # mechanical keyboards hold value longer

    # --- Grading API: hybrid path ---
    "laptop":       (3.0, 5.0, 4.0),
    "headphones":   (2.0, 4.0, 3.0),
    "camera":       (3.0, 6.0, 4.0),   # sensor quality is timeless
    "appliance":    (3.0, 8.0, 5.0),   # kitchen/home; depends heavily on brand

    # --- Extra categories (not in grading API but valid P2P items) ---
    "baby_walker":  (1.5, 3.0, 2.0),   # baby outgrows fast → strong used-market demand
    "smartphone":   (2.0, 3.5, 2.5),   # fast tech cycle
    "backpack":     (2.0, 4.0, 3.0),
}

_DEFAULT_LIFESPAN = (2.0, 4.0, 3.0)


def resale_window(category: str) -> tuple[float, float, float]:
    """(min_years, max_years, avg_years) for a category. Falls back to a safe default."""
    return LIFESPAN_YEARS.get((category or "").strip().lower(), _DEFAULT_LIFESPAN)


def in_resale_window(category: str, age_years: float) -> bool:
    """True if the item's age is within the category's resale window."""
    min_y, max_y, _ = resale_window(category)
    return min_y <= age_years <= max_y


def window_position(category: str, age_years: float) -> str:
    """Human-readable position: 'before_window', 'in_window', 'past_window'."""
    min_y, max_y, _ = resale_window(category)
    if age_years < min_y:
        return "before_window"
    if age_years > max_y:
        return "past_window"
    return "in_window"
