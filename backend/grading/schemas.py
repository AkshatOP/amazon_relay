"""Pydantic models for Amazon Relay grading.

The `GradeResult` is the single, uniform output shape emitted by EVERY grading path
(visual VLM or functional rules) so the downstream router is path-agnostic.
"""
from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# Score band for each grade (inclusive).
GRADE_BANDS: dict[str, tuple[int, int]] = {
    "A": (8, 10),
    "B": (5, 7),
    "C": (3, 4),
    "D": (1, 2),
}


class GradeResult(BaseModel):
    """The strict grade JSON. Same shape for every path."""

    grade: Literal["A", "B", "C", "D"]
    score: int = Field(..., ge=1, le=10)
    confidence: float = Field(..., ge=0.0, le=1.0)
    defects: List[str] = Field(default_factory=list)
    resale_eligible: bool
    refurbish_recommended: bool
    reasoning: str
    notes: str

    @field_validator("defects", mode="before")
    @classmethod
    def _coerce_defects(cls, v):
        # Tolerate a model returning null or a single string instead of a list.
        if v is None:
            return []
        if isinstance(v, str):
            return [v] if v.strip() else []
        return v

    @model_validator(mode="after")
    def _check_consistency(self) -> "GradeResult":
        low, high = GRADE_BANDS[self.grade]
        if not (low <= self.score <= high):
            raise ValueError(
                f"score {self.score} is outside band {low}-{high} for grade {self.grade}"
            )
        # Booleans are derived strictly from the rubric.
        if self.resale_eligible != (self.grade in ("A", "B")):
            raise ValueError("resale_eligible must be true iff grade is A or B")
        if self.refurbish_recommended != (self.grade == "C"):
            raise ValueError("refurbish_recommended must be true iff grade is C")
        return self


def make_error_result(reason: str, raw: str = "") -> dict:
    """A structured fallback so the API never 500s on a model/parse failure.

    Note: this intentionally bypasses GradeResult validation (grade='ERROR' is not a
    valid grade) — it is an out-of-band error envelope with the same familiar keys.
    """
    return {
        "grade": "ERROR",
        "score": 0,
        "confidence": 0.0,
        "defects": [],
        "resale_eligible": False,
        "refurbish_recommended": False,
        "reasoning": reason,
        "notes": "Grading could not be completed; see reasoning.",
        "raw_model_output": raw,
    }


# --- Functional check registry (weighted, category-aware) -------------------
# Each check carries a weight: 3 = CRITICAL (core function / safety), 2 = IMPORTANT
# (significant functional issue), 1 = MINOR (cosmetic / convenience). The FIRST check in
# every category is the PRIMARY-function check (always weight 3); failing it alone → Grade D.
FUNCTIONAL_CHECK_DEFINITIONS: dict[str, list[dict]] = {
    # smartphone: check #2 is a structural-integrity check so a cracked-but-working phone is
    # correctly blocked (a functional phone with a shattered screen must NOT grade A).
    "smartphone": [
        {"label": "Powers on and reaches the home screen", "weight": 3},
        {"label": "Screen and body free of cracks or structural damage", "weight": 3},
        {"label": "Touchscreen responds accurately across the full display", "weight": 3},
        {"label": "Battery charges and holds charge", "weight": 3},
        {"label": "Speaker, microphone, and cameras all work", "weight": 2},
        {"label": "All physical buttons and charging port functional", "weight": 2},
    ],
    "charger": [
        {"label": "Charges a connected device", "weight": 3},
        {"label": "Connectors and pins intact", "weight": 3},
        {"label": "Output stable under load (does not cut out)", "weight": 2},
        {"label": "Indicator lights work", "weight": 1},
        {"label": "Insulation and casing undamaged", "weight": 2},
    ],
    "power_bank": [
        {"label": "Charges from mains", "weight": 3},
        {"label": "Discharges correctly to a connected device", "weight": 3},
        {"label": "All output ports functional", "weight": 2},
        {"label": "LED charge indicators work", "weight": 2},
        {"label": "No swelling, excess heat, or smell", "weight": 3},
    ],
    "speaker": [
        {"label": "Powers on", "weight": 3},
        {"label": "Audio is clear and undistorted", "weight": 3},
        {"label": "Volume controls work", "weight": 2},
        {"label": "Bluetooth / AUX pairing works", "weight": 2},
        {"label": "Battery charges", "weight": 2},
    ],
    "cable": [
        {"label": "Connectors intact at both ends", "weight": 3},
        {"label": "Charging / power delivery works", "weight": 3},
        {"label": "Data transfer works", "weight": 2},
        {"label": "No exposed or frayed wire", "weight": 3},
        {"label": "Not kinked or sharply bent", "weight": 1},
    ],
    "mouse": [
        {"label": "Left and right buttons click reliably", "weight": 3},
        {"label": "Scroll wheel works", "weight": 2},
        {"label": "Sensor tracks accurately", "weight": 3},
        {"label": "USB / Bluetooth connects", "weight": 3},
        {"label": "Extra buttons work", "weight": 1},
    ],
    "keyboard": [
        {"label": "All keys register correctly", "weight": 3},
        {"label": "USB / Bluetooth connects", "weight": 3},
        {"label": "No keys missing or loose", "weight": 2},
        {"label": "Backlighting works", "weight": 1},
        {"label": "No liquid damage", "weight": 2},
    ],
    "laptop": [
        {"label": "Powers on to the operating system", "weight": 3},
        {"label": "Screen displays correctly (no cracks / dead pixels)", "weight": 3},
        {"label": "Battery charges and holds charge", "weight": 3},
        {"label": "Keyboard, trackpad, and ports work", "weight": 3},
        {"label": "Wi-Fi connects", "weight": 2},
    ],
    "headphones": [
        {"label": "Audio is clear in both ears", "weight": 3},
        {"label": "Controls respond", "weight": 2},
        {"label": "Bluetooth / cable connection works", "weight": 3},
        {"label": "Microphone works", "weight": 1},
        {"label": "Battery charges", "weight": 2},
    ],
    "camera": [
        {"label": "Powers on", "weight": 3},
        {"label": "Shutter and autofocus work", "weight": 3},
        {"label": "LCD / viewfinder works", "weight": 2},
        {"label": "Battery charges", "weight": 3},
        {"label": "Image / video quality is acceptable", "weight": 3},
    ],
    "appliance": [
        {"label": "Powers on", "weight": 3},
        {"label": "Primary function works", "weight": 3},
        {"label": "All controls respond", "weight": 2},
        {"label": "No unusual noise, smell, or sparking", "weight": 3},
        {"label": "Safety features intact", "weight": 3},
    ],
}

# Generic fallback for an unknown functional category.
DEFAULT_CHECK_DEFINITIONS: list[dict] = [
    {"label": "Powers on / performs its primary function", "weight": 3},
    {"label": "No visible physical or structural damage", "weight": 2},
    {"label": "All controls, ports, and connectors work", "weight": 2},
]

# Backward-compat shims (label-only), derived from the definitions.
FUNCTIONAL_CHECKS: dict[str, list[str]] = {
    cat: [d["label"] for d in defs] for cat, defs in FUNCTIONAL_CHECK_DEFINITIONS.items()
}
DEFAULT_CHECKS: list[str] = [d["label"] for d in DEFAULT_CHECK_DEFINITIONS]


def get_definitions(category: str) -> list[dict]:
    """Full [{label, weight}] list for a category (DEFAULT_CHECK_DEFINITIONS if unknown)."""
    return FUNCTIONAL_CHECK_DEFINITIONS.get((category or "").strip().lower(), DEFAULT_CHECK_DEFINITIONS)


def get_checks(category: str) -> list[str]:
    """Label-only list for a category (backward-compat; used by the router/UI)."""
    return [d["label"] for d in get_definitions(category)]


# --- API request/response models --------------------------------------------

class FunctionalGradeRequest(BaseModel):
    """JSON body for POST /grade/functional."""

    category: str = "accessory"
    answers: List[bool] = Field(
        ..., description="Ordered yes/no inspection answers (true = yes / passes)."
    )
    description: str = Field(
        default="", description="Optional free-text description of the item's condition."
    )


class HealthResponse(BaseModel):
    status: str
    model: str
    api_key_present: bool
