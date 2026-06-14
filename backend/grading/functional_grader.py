"""Functional grading path (stub).

For products where a photo is useless (chargers, speakers, power banks). Graded by simple
rules from a few yes/no inspection answers. Emits the SAME uniform schema as the visual
path so downstream routing is path-agnostic.

Convention: each answer is True = "yes, this check passes / is fine".
"""
from __future__ import annotations

from .schemas import GradeResult, make_error_result


def grade_functional(answers: list[bool], category: str = "accessory") -> dict:
    """Rule-based grade from yes/no answers. Never raises.

    Rules:
      - all yes        -> B / 7  (works, resale eligible)
      - majority yes   -> C / 4  (issues, refurbish recommended)
      - mostly no      -> D / 2  (failing, donate/liquidate)
    """
    if not answers:
        return make_error_result("No functional answers were provided.")

    total = len(answers)
    yes = sum(1 for a in answers if a)
    ratio = yes / total

    if yes == total:
        grade, score = "B", 7
        defects: list[str] = []
        reasoning = "All functional checks passed; the item appears to work as expected."
        notes = "Functionally sound — eligible for resale."
    elif ratio >= 0.5:
        grade, score = "C", 4
        defects = [f"{total - yes} of {total} functional checks failed"]
        reasoning = (
            "A minority of functional checks failed; the item has issues but is likely "
            "repairable."
        )
        notes = "Has functional issues — refurbish recommended."
    else:
        grade, score = "D", 2
        defects = [f"{total - yes} of {total} functional checks failed"]
        reasoning = (
            "Most functional checks failed; the item is not reliably usable as-is."
        )
        notes = "Largely non-functional — donate or liquidate."

    result = {
        "grade": grade,
        "score": score,
        "confidence": 0.6,  # rule-based, modest fixed confidence
        "defects": defects,
        "resale_eligible": grade in ("A", "B"),
        "refurbish_recommended": grade == "C",
        "reasoning": reasoning,
        "notes": notes,
    }
    # Validate through the same schema for consistency with the visual path.
    return GradeResult(**result).model_dump()
