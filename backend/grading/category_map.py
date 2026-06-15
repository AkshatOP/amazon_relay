"""Category -> grading path lookup.

In production the category is derived from the order-history SKU. In this MVP it comes
from the dropdown in the UI.
"""
from __future__ import annotations

# Path per category: "visual" | "functional" | "hybrid".
GRADING_PATH: dict[str, str] = {
    # Visual — condition equals what you can see.
    "shoes": "visual",
    "footwear": "visual",
    "clothing": "visual",
    "phone_case": "visual",
    "bag": "visual",
    "watch": "visual",
    "baby_gear": "visual",
    "baby_walker": "visual",
    "toy": "visual",
    "book": "visual",
    # Functional — a photo is useless; graded by weighted yes/no checks.
    "smartphone": "functional",
    "charger": "functional",
    "power_bank": "functional",
    "speaker": "functional",
    "cable": "functional",
    "mouse": "functional",
    "keyboard": "functional",
    # Hybrid — both looks and function matter.
    "laptop": "hybrid",
    "headphones": "hybrid",
    "camera": "hybrid",
    "appliance": "hybrid",
}

# Human-friendly labels for the visual categories (used to populate the demo dropdown).
VISUAL_CATEGORY_LABELS: dict[str, str] = {
    "shoes": "Footwear / Shoes",
    "clothing": "Clothing",
    "phone_case": "Phone Case",
    "bag": "Bag / Backpack",
    "watch": "Watch",
    "baby_gear": "Baby Gear",
    "baby_walker": "Baby Walker",
    "toy": "Toy",
    "book": "Book",
}


def get_path(category: str) -> str:
    """Return the grading path for a category, defaulting to 'visual' for unknowns."""
    if not category:
        return "visual"
    return GRADING_PATH.get(category.strip().lower(), "visual")
