# Amazon Relay — Architecture

## End-to-end pipeline (vision)

```
Return initiated
      │
      ▼
┌─────────────────────┐
│  Path selection      │  category ──► get_path(category)
│  (category_map.py)   │     │
└─────────────────────┘     ├── "visual"  ─► Condition Grading Agent (Gemini VLM)   ◄── THIS MVP
                            ├── "functional" ─► Functional Grader (yes/no rules)
                            └── "hybrid"  ─► both, combined
      │
      ▼
┌─────────────────────┐
│  Grade JSON          │  { grade, score, confidence, defects, resale_eligible, ... }
│  (uniform schema)    │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│  Routing Agent       │  XGBoost ─► RESELL_LOCAL / REFURBISH / DONATE / LIQUIDATE   (Phase 3)
│  (routing-agent)     │
└─────────────────────┘
      │
      ▼
┌─────────────────────┐
│  Trust + Matching    │  Product Health Card + nearby-buyer match                  (Phase 4)
└─────────────────────┘
```

## Components in this MVP

### Path selection — `backend/category_map.py`
A `GRADING_PATH` dict maps product category → `"visual" | "functional" | "hybrid"`.
`get_path(category)` defaults unknown categories to `"visual"`. In production the category
is derived from the order-history SKU; in the demo it comes from a dropdown.

### Condition Grading Agent (visual) — `backend/grading_agent.py`
The hero. `grade_visual(reference_image_paths, inspection_image_paths, category)`:
1. Loads `skills/grading_skill.md` as the Gemini **system instruction**.
2. Reads image bytes; builds a multimodal request with **clearly labelled groups** — a text
   part announcing the category and the "reference (good)" group, then the reference image
   parts, then a text part announcing the "inspection (returned)" group, then those parts.
3. Calls Gemini (`response_mime_type="application/json"`), gets text back.
4. **Defensively strips** any ```json fences / whitespace, then `json.loads`.
5. Validates against the pydantic schema. On parse/validation failure, **retries once** with
   a stricter "return ONLY valid JSON" nudge; if it still fails, returns a structured
   `grade: "ERROR"` dict (low confidence, raw text preserved) — **never throws**, so the API
   never 500s on a model formatting hiccup.
6. Gemini API errors (timeout, bad key, rate limit) are caught and returned as clear
   structured errors.

### Functional Grader (stub) — `backend/functional_grader.py`
`grade_functional(answers: list[bool])` applies simple rules (all yes → B/7; majority yes →
C/4; mostly no → D/2) and emits the **same** JSON schema.

### Schema — `backend/schemas.py`
Pydantic models enforce `grade ∈ {A,B,C,D}`, the score band matching the grade,
`confidence ∈ [0,1]`, and the rubric-derived booleans. The uniform `GradeResult` is what
every path returns and what downstream consumes.

### API — `backend/main.py`
- `GET /` serves `frontend/index.html`.
- `POST /grade` — multipart (`category`, `reference_images[]`, `inspection_images[]`); saves
  uploads to a temp dir, looks up the path, calls `grade_visual` for visual/hybrid.
- `POST /grade/functional` — JSON yes/no answers → `grade_functional`.
- `GET /health`; CORS enabled for local dev.

### Config — `backend/config.py`
Centralizes the Gemini model name (`GEMINI_MODEL`, default `gemini-2.5-flash`) and loads
`GEMINI_API_KEY` from the environment / `.env`. Swap the model in one place.

## Why a uniform output schema

The two paths produce condition grades in completely different ways (a VLM vs a rule table),
but they emit identical JSON. This decouples grading from routing: the Phase 3 XGBoost router
consumes `score` + `defects` length + `grade` without knowing or caring how they were derived.

## Path-selection logic (detail)

| Category examples                         | Path        | Rationale                                  |
|-------------------------------------------|-------------|--------------------------------------------|
| shoes, clothing, phone case, bag, watch   | visual      | condition = visible wear                   |
| charger, speaker, power bank, cable, mouse| functional  | a photo can't reveal if it works           |
| laptop, headphones, camera                | hybrid      | looks **and** function both matter         |
| (unknown)                                 | visual      | safe default — at least inspect the photos |
