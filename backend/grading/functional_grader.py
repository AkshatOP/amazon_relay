"""Functional grading path — weighted, category-aware, strict-resale.

For products where a photo is useless (chargers, power banks, smartphones…). Graded from
ordered yes/no checks, each carrying a WEIGHT (3 critical/primary/safety, 2 important,
1 minor). Emits the SAME uniform GradeResult schema as the visual path.

Scoring: weighted_ratio = (weight of PASSED checks) / (weight of ALL checks).

Resale rules (strict — any meaningful functional/structural failure blocks resale):
  - all checks pass                          → A / 9, resale_eligible
  - only weight-1 checks fail                → B / 6-7, resale_eligible
  - any weight-2 check fails                 → C / 3-4, NOT resale-eligible
  - any weight-3 check fails (non-primary)   → C / 3-4, NOT resale-eligible
  - PRIMARY (first) check fails              → D / 2, NOT resale-eligible
  - weighted_ratio < 0.55                    → D / 2, NOT resale-eligible

Optional: when a free-text `description` is supplied, a single Gemini call (the CENTRAL
gemini-2.5-flash client) cross-checks the rule grade against the prose and the two are MERGED
(the more conservative grade wins; defects unioned; confidence averaged). Never throws — any
Gemini/parse failure falls back to the pure rule-based result.
"""
from __future__ import annotations

import json

from . import config
from .schemas import GradeResult, make_error_result, get_definitions
from backend.core import gemini as gemini_core

_RANK = {"A": 3, "B": 2, "C": 1, "D": 0}
_DEFAULT_SCORE = {"A": 9, "B": 6, "C": 3, "D": 2}


def _rule_grade(answers: list[bool], category: str) -> dict:
    """Pure weighted rule grade (no LLM). Returns a validated GradeResult dict."""
    defs = get_definitions(category)
    n = len(defs)
    # Align answers to the checks: extra answers ignored, missing ones treated as pass.
    ans = [bool(a) for a in answers[:n]] + [True] * max(0, n - len(answers))

    total_weight = sum(d["weight"] for d in defs) or 1
    passed_weight = sum(d["weight"] for d, a in zip(defs, ans) if a)
    ratio = passed_weight / total_weight

    failed = [(d, a) for d, a in zip(defs, ans) if not a]
    failed_weights = {d["weight"] for d, _ in failed}
    primary_failed = bool(defs) and not ans[0]
    defects = [f'FAILED (w{d["weight"]}): {d["label"]}' for d, _ in failed]

    if primary_failed or ratio < 0.55:
        grade, score = "D", 2
        notes = "Primary function fails — not usable as-is; donate or liquidate."
    elif 2 in failed_weights or 3 in failed_weights:
        grade, score = "C", (4 if ratio >= 0.7 else 3)
        notes = "Significant functional issue — refurbish recommended, not resale-ready."
    elif 1 in failed_weights:
        grade, score = "B", (7 if ratio >= 0.9 else 6)
        notes = "Minor convenience/cosmetic issue only — eligible for resale."
    else:
        grade, score = "A", 9
        notes = "All functional checks passed — fully resale-ready."

    if not failed:
        reasoning = f"All {n} functional checks for '{category}' passed (weighted score {ratio:.0%})."
    else:
        reasoning = (f"{len(failed)} of {n} functional checks failed for '{category}' "
                     f"(weighted score {ratio:.0%}). Worst-weight failure drives the grade.")

    # decisiveness 0 (coin-flip) .. 0.5 (unanimous) → confidence 0.55 .. 0.95
    confidence = min(0.55 + abs(ratio - 0.5) * 0.7, 0.95)

    result = {
        "grade": grade, "score": score, "confidence": round(confidence, 3),
        "defects": defects, "resale_eligible": grade in ("A", "B"),
        "refurbish_recommended": grade == "C", "reasoning": reasoning, "notes": notes,
    }
    return GradeResult(**result).model_dump()


_DESC_SYSTEM = (
    "You are the Relay HUB functional condition grader. You are given a product category, "
    "the ordered functional checklist with each check's weight and the inspector's pass/fail "
    "answer, a preliminary rule-based grade, and the customer's free-text condition description. "
    "Cross-check the description against the checklist and refine the grade — do not grade the "
    "description in isolation. Be conservative: any real functional or structural problem blocks "
    "resale. Output ONLY a JSON object with keys grade (A|B|C|D), score (A:8-10, B:5-7, C:3-4, "
    "D:1-2), confidence (0-1), defects (array of short strings), resale_eligible (true only for "
    "A or B), refurbish_recommended (true only for C), reasoning, notes. No markdown, no code "
    "fences, no prose outside the JSON."
)


def _description_assessment(category: str, answers: list[bool], rule: dict, description: str) -> dict | None:
    """Single Gemini (central gemini-2.5-flash) text assessment using FULL context. Returns a
    parsed grade dict (grade/defects/confidence/reasoning) or None on any failure."""
    if not gemini_core.sdk_available() or not gemini_core.has_api_key():
        return None
    defs = get_definitions(category)
    ans = [bool(a) for a in answers[:len(defs)]] + [True] * max(0, len(defs) - len(answers))
    checklist = "\n".join(
        f"- [{'PASS' if a else 'FAIL'}] (w{d['weight']}) {d['label']}" for d, a in zip(defs, ans)
    )
    prompt = (
        f"Category: {category}\n"
        f"Functional checklist (inspector answers):\n{checklist}\n"
        f"Preliminary rule-based grade: {rule['grade']} (score {rule['score']}, "
        f"resale_eligible={rule['resale_eligible']}).\n"
        f"Customer condition description:\n\"\"\"{description.strip()}\"\"\"\n"
        f"Refine and return the grade JSON."
    )
    try:
        client = gemini_core.get_client()
        resp = client.models.generate_content(
            model=config.GEMINI_MODEL,
            config=gemini_core.types.GenerateContentConfig(
                system_instruction=_DESC_SYSTEM, response_mime_type="application/json",
            ),
            contents=[prompt],
        )
        text = (resp.text or "").strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0]
        data = json.loads(text)
        grade = str(data.get("grade", "")).strip().upper()
        if grade not in _RANK:
            return None
        defects = data.get("defects") or []
        if isinstance(defects, str):
            defects = [defects]
        return {
            "grade": grade,
            "defects": [str(d) for d in defects if str(d).strip()],
            "confidence": float(data.get("confidence", rule["confidence"]) or rule["confidence"]),
            "reasoning": str(data.get("reasoning", "")).strip(),
        }
    except Exception:
        return None


def _merge(rule: dict, desc: dict) -> dict:
    """Merge rule grade with the Gemini description assessment: the more conservative (lower)
    grade wins; defects de-duped union; confidence averaged; reasoning combined."""
    grade = rule["grade"] if _RANK[rule["grade"]] <= _RANK[desc["grade"]] else desc["grade"]
    score = rule["score"] if grade == rule["grade"] else _DEFAULT_SCORE[grade]
    # de-duped union, preserving order (rule defects first)
    seen, defects = set(), []
    for d in [*rule["defects"], *desc["defects"]]:
        if d not in seen:
            seen.add(d); defects.append(d)
    confidence = round(min(max((rule["confidence"] + desc["confidence"]) / 2, 0.0), 1.0), 3)
    reasoning = f"[Checks] {rule['reasoning']} [Description] {desc['reasoning']}".strip()
    merged = {
        "grade": grade, "score": score, "confidence": confidence, "defects": defects,
        "resale_eligible": grade in ("A", "B"), "refurbish_recommended": grade == "C",
        "reasoning": reasoning, "notes": rule["notes"],
    }
    return GradeResult(**merged).model_dump()


def grade_functional(answers: list[bool], category: str = "accessory", description: str = "") -> dict:
    """Weighted functional grade. Never raises.

    answers: ordered yes/no (True = check passes), aligned to the category's check list.
    description: optional free-text → triggers the Gemini cross-check + merge.
    """
    if not answers:
        return make_error_result("No functional answers were provided.")

    rule = _rule_grade(answers, category)

    if description and description.strip():
        try:
            desc = _description_assessment(category, answers, rule, description)
            if desc is not None:
                return _merge(rule, desc)
        except Exception:
            pass  # any failure → fall back to the rule-based grade

    return rule
