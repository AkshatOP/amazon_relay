# Agent: Condition Grading Agent

> Spec for the first-stage agent in the Amazon Relay pipeline. The runtime system prompt /
> rubric this agent loads lives in [`skills/grading_skill.md`](../skills/grading_skill.md).

## Role
A recommerce condition grader for Amazon Relay. It decides how worn a returned product is
so the pipeline can route it to its best second life.

## Model
Google Gemini (vision-capable VLM) via the `google-genai` SDK. Model name is centralized in
`backend/config.py` (default `gemini-2.5-flash`) and is swappable.

## Grading paths
| Path        | When                                              | Implementation              |
|-------------|---------------------------------------------------|-----------------------------|
| `visual`    | condition = visible (shoes, clothing, bags…)      | `grade_visual()` — Gemini   |
| `functional`| photo is useless (chargers, speakers…)            | `grade_functional()` — rules|
| `hybrid`    | looks **and** function matter (laptop, headphones)| both, combined (partial)    |

The path is chosen by `category_map.get_path(category)`.

## Inputs (visual path)
- `category: str` — product category (drives the inspection checklist).
- `reference_image_paths: list[str]` — photos of the **good** product.
  *MVP:* uploaded manually. *Production:* auto-pulled from the Amazon catalog by SKU.
- `inspection_image_paths: list[str]` — photos of the **returned** product, captured by the
  delivery rider on pickup.

## Task
Grade the **condition delta** between the reference and inspection images — i.e. what
*changed* — not the absolute condition. Glare, shadow, and background are not defects.

## Output (uniform across all paths)
Strict JSON only (no markdown, no code fences):

```json
{
  "grade": "A | B | C | D",
  "score": 1,
  "confidence": 0.0,
  "defects": ["short defect string", "..."],
  "resale_eligible": true,
  "refurbish_recommended": false,
  "reasoning": "2-3 sentences, no line breaks",
  "notes": "one-line buyer-facing summary"
}
```

Validated by `backend/schemas.py`. The same shape is emitted by every path so downstream
(the routing agent) is path-agnostic.

## Rubric (Amazon Renewed standard)
- **A** (8–10): like new, no visible damage vs reference.
- **B** (5–7): good, minor wear visible only on close inspection.
- **C** (3–4): fair, clearly visible wear, refurbish recommended.
- **D** (1–2): poor, heavy/structural damage, donate or liquidate.

## Robustness contract
- Defensively strips ```json fences before parsing.
- On parse/validation failure: retry once with a stricter nudge, then return a structured
  `grade: "ERROR"` object — **never throw**. The API must never 500 on a formatting hiccup.
- Gemini API errors (bad key, timeout, rate limit) → clear structured error.

## Downstream
Feeds `score`, `defects`, and `grade` into the **Routing Agent**
([`routing-agent.agent.md`](routing-agent.agent.md)).
