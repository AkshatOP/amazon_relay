"""Visual grading agent (the hero path).

Loads the grading skill as a Gemini system instruction, sends labelled reference +
inspection image groups to the VLM, and parses strict JSON defensively so the API never
500s on a model formatting hiccup.
"""
from __future__ import annotations

import json
import mimetypes
from functools import lru_cache
from pathlib import Path

from . import config
from .schemas import GradeResult, make_error_result

# --- Gemini SDK (import lazily-friendly) -------------------------------------
try:
    from google import genai
    from google.genai import types
except Exception:  # pragma: no cover - surfaced as a clear runtime error instead
    genai = None
    types = None


@lru_cache(maxsize=1)
def _load_skill() -> str:
    """Read skills/grading_skill.md once and cache it."""
    try:
        return config.SKILL_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return (
            "You are the Amazon Relay condition grading agent. Compare the reference "
            "(good) images to the inspection (returned) images and output ONLY a JSON "
            "object with keys: grade, score, confidence, defects, resale_eligible, "
            "refurbish_recommended, reasoning, notes. No code fences, no prose."
        )


@lru_cache(maxsize=1)
def _client():
    """Build a cached google-genai client. Raises if the SDK/key is unavailable."""
    if genai is None:
        raise RuntimeError(
            "google-genai SDK not installed. Run: pip install -r requirements.txt"
        )
    if not config.has_api_key():
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Export it or put it in a .env file."
        )
    # The client reads GEMINI_API_KEY from the env; pass explicitly to be safe.
    return genai.Client(api_key=config.GEMINI_API_KEY)


def _image_part(path: str):
    """Read an image file into a Gemini inline image Part."""
    data = Path(path).read_bytes()
    mime, _ = mimetypes.guess_type(path)
    if not mime or not mime.startswith("image/"):
        mime = "image/jpeg"
    return types.Part.from_bytes(data=data, mime_type=mime)


def _build_contents(
    reference_image_paths: list[str],
    inspection_image_paths: list[str],
    category: str,
    strict_nudge: bool = False,
) -> list:
    """Assemble the multimodal request: labelled reference group, then inspection group."""
    contents: list = []
    contents.append(
        f"Product category: {category}.\n"
        f"The first group of {len(reference_image_paths)} image(s) below are the "
        f"REFERENCE images — the GOOD product (what it should look like).\n"
        f"--- REFERENCE (GOOD) IMAGES ---"
    )
    for p in reference_image_paths:
        contents.append(_image_part(p))

    contents.append(
        f"The next group of {len(inspection_image_paths)} image(s) are the INSPECTION "
        f"images — the RETURNED product captured by the rider. Grade the condition "
        f"delta of this returned item versus the reference above.\n"
        f"--- INSPECTION (RETURNED) IMAGES ---"
    )
    for p in inspection_image_paths:
        contents.append(_image_part(p))

    if strict_nudge:
        contents.append(
            "REMINDER: Return ONLY a single valid JSON object. No code fences, no ```json, "
            "no text before or after. First character '{', last character '}'."
        )
    return contents


def _strip_fences(text: str) -> str:
    """Defensively strip ```json ... ``` fences and surrounding whitespace."""
    t = (text or "").strip()
    if t.startswith("```"):
        # Drop the opening fence line (``` or ```json) ...
        first_newline = t.find("\n")
        if first_newline != -1:
            t = t[first_newline + 1 :]
        # ... and the trailing fence.
        if t.rstrip().endswith("```"):
            t = t.rstrip()[: -3]
    t = t.strip()
    # Last resort: carve out the outermost { ... } if extra prose slipped in.
    if not t.startswith("{"):
        start, end = t.find("{"), t.rfind("}")
        if start != -1 and end != -1 and end > start:
            t = t[start : end + 1]
    return t.strip()


def _parse_and_validate(text: str) -> dict | None:
    """Strip fences, json.loads, validate against GradeResult. None on failure."""
    cleaned = _strip_fences(text)
    try:
        data = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError):
        return None
    try:
        return GradeResult(**data).model_dump()
    except Exception:
        return None


def _call_gemini(contents: list) -> str:
    """Single Gemini call returning raw text. Raises on API errors."""
    client = _client()
    resp = client.models.generate_content(
        model=config.GEMINI_MODEL,
        config=types.GenerateContentConfig(
            system_instruction=_load_skill(),
            response_mime_type="application/json",
        ),
        contents=contents,
    )
    return resp.text or ""


def grade_visual(
    reference_image_paths: list[str],
    inspection_image_paths: list[str],
    category: str,
) -> dict:
    """Grade a returned item visually against its reference. Never raises.

    Returns a validated GradeResult dict, or a structured error dict on any failure.
    """
    if not inspection_image_paths:
        return make_error_result("No inspection images were provided.")

    # Attempt 1
    try:
        raw = _call_gemini(
            _build_contents(reference_image_paths, inspection_image_paths, category)
        )
    except RuntimeError as e:
        # Config/SDK problems (missing key, SDK not installed).
        return make_error_result(str(e))
    except Exception as e:
        # API errors: timeout, bad key, rate limit, etc.
        return make_error_result(f"Gemini API error: {e}")

    result = _parse_and_validate(raw)
    if result is not None:
        return result

    # Attempt 2 — stricter "JSON only" nudge.
    try:
        raw2 = _call_gemini(
            _build_contents(
                reference_image_paths,
                inspection_image_paths,
                category,
                strict_nudge=True,
            )
        )
    except Exception as e:
        return make_error_result(
            f"Model returned unparseable JSON; retry failed with API error: {e}",
            raw=raw,
        )

    result2 = _parse_and_validate(raw2)
    if result2 is not None:
        return result2

    # Both attempts failed to produce valid JSON — return structured error, never throw.
    return make_error_result(
        "Model did not return valid JSON matching the grade schema after one retry.",
        raw=raw2 or raw,
    )
