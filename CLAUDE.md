# CLAUDE.md — Amazon Relay

Project guidance for Claude Code working in this repo.

## What this is
Amazon Relay — Amazon HackOn 2026 submission. An intelligent reverse-logistics system that
gives returned products a second life (resell / refurbish / donate / liquidate).
**Phases 1 (grading) and 3 (geo-routing) are complete and live-tested.**

- Full problem statement + solution framing → [`docs/CONTEXT.md`](docs/CONTEXT.md)
- Phased build tracker / current status → [`docs/TODO.md`](docs/TODO.md)
- How pieces fit together → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Agent specs → [`.agents/`](.agents/)

## Core idea
A Google Gemini VLM inspects **inspection** photos (the returned product, captured by the
delivery rider) for real damage, using **reference** photos (catalog image) only as design
context — NOT as a similarity/pixel-delta target. Output is strict JSON (grade A–D, score,
defects, resale eligibility) — the same schema regardless of grading path, so the downstream
router is path-agnostic.

Two paths, auto-selected by category (`backend/category_map.py`):
- **visual** (hero) → `backend/grading_agent.py` (Gemini)
- **functional** (stub) → `backend/functional_grader.py` (yes/no rules)
- **hybrid** → visual now; answer-merge is a Phase 2 TODO

## Key files
| File | Role |
|------|------|
| `skills/grading_skill.md` | The runtime system prompt / rubric the VLM loads. Edit grading behavior here. |
| `backend/grading_agent.py` | Visual path: labelled image groups → Gemini → defensive JSON parse + retry. |
| `backend/schemas.py` | `GradeResult` strict schema (grade/score-band/boolean consistency). |
| `backend/config.py` | Model name (`GEMINI_MODEL`, default `gemini-2.5-flash`) + key loading. Swap model here. |
| `backend/main.py` | FastAPI: `GET /`, `GET /health`, `POST /grade`, `POST /grade/functional`. |
| `frontend/index.html` | Skeletal vanilla-JS demo UI. |

## Run / test
```bash
pip install -r requirements.txt   # or use the existing .venv/
export GEMINI_API_KEY="..."
uvicorn backend.main:app --reload  # from repo root → http://localhost:8000
```
A `.venv/` with deps already installed exists from the initial build.

## Conventions / guardrails
- **The grading agent must never throw.** Model/parse/API failures return a structured
  `{"grade": "ERROR", ...}` dict — the endpoints must never 500 on a formatting hiccup.
  Transient API errors (503/429/timeout) are retried with backoff before giving up.
- Gemini wraps JSON in ```json fences often → the parser strips fences defensively. Keep that.
- **Reference = design context only, never a similarity target.** Catalog-vs-phone differences
  (colour/angle/lighting/background/colourway) are NOT defects. Grade damage on the returned
  unit itself. Functional/closure defects (broken zipper etc.) block resale even if clean.
- Uniform output schema across all paths is load-bearing for downstream routing — don't diverge.
- Verify the `google-genai` SDK call shape against current docs before changing Gemini calls;
  don't rely on memory.
- This is a hackathon MVP: prefer a working vertical slice over polish. Don't over-engineer.

## Routing (Phase 3)

**Package:** `routing/`  **API port:** 8100  **Demo UI port:** 5500

The routing module is a **self-contained package** — do NOT add routes to `backend/main.py`
or scatter files into `backend/`. Port 8000 is reserved for grading and is never touched here.

Key files:
| File | Role |
|------|------|
| `routing/config.py` | All tunable constants — fuel price, vehicle mileage, demand radius, etc. |
| `routing/router.py` | Hard economic gates + XGBoost (or rule_fallback if .pkl absent). |
| `routing/route_api.py` | FastAPI on :8100. `POST /route`, `POST /grade-and-route`, `GET /health`. |
| `routing/economics.py` | Amortized per-item fuel + CO2; computed donate/liquidate break-even. |
| `routing/model/train_router.py` | XGBoost trainer CLI — **user runs this**, not Claude. |
| `frontend_routing/index.html` | Demo UI. Calls :8100. Shows decision + money-shot savings. |

**Key framing**: returns are NEW units (full original_price). Routing = logistics arbitrage:
local intercept cost vs FC haul + fresh-unit reship. `pricing.py` is stubbed — reserved for
the future P2P exchange product. Never import it in routing.

Run the routing API: `uvicorn routing.route_api:app --reload --port 8100` (from repo root, venv active).
**Economic framing changed** — old `.pkl` is stale. Retrain before demoing XGBoost path:
```bash
python -m routing.model.generate_training_data   # already done
python -m routing.model.train_router             # retrain with new features
```
Until retrained, `decided_by` will be `"rule_fallback"` — API still works fully.

## Status
Phase 1 (visual agent) is **complete and live-tested** against real photos: a backpack with a
separated zipper grades C (not resale-eligible, refurbish recommended) while a clean unit grades
A, and catalog-vs-phone differences are correctly ignored. Skill also covers stains/fading.
Drag-and-drop multi-file upload is in the UI.

Phase 3 (geo-routing) is **complete and API-tested**: :8100 routes returns to RESELL_LOCAL /
REFURBISH / DONATE / LIQUIDATE using hard economic gates + rule engine. XGBoost activates
after one `train_router.py` run. Demo UI on :5500 shows decision badge, scores, geography, and
the tier-3 money-shot (₹41/item, 1 kg CO2 saved vs 612 km warehouse haul).

Next: Phase 2 hybrid answer-merge; Phase 4 Product Health Card + buyer matching. See `docs/TODO.md`.
