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


# --- API request/response models --------------------------------------------

class FunctionalGradeRequest(BaseModel):
    """JSON body for POST /grade/functional."""

    category: str = "accessory"
    answers: List[bool] = Field(
        ..., description="Ordered yes/no inspection answers (true = yes / passes)."
    )


class HealthResponse(BaseModel):
    status: str
    model: str
    api_key_present: bool
