# CLAUDE.md — Amazon Relay

Project guidance for Claude Code working in this repo.

## What this is
Amazon Relay — Amazon HackOn 2026 submission. An intelligent reverse-logistics system that
gives returned products a second life (resell / refurbish / donate / liquidate / P2P resale).
**Phases 1 (grading), 3 (geo-routing), and 5 (P2P exchange) are complete and live-tested.**

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

## Key files — Grading (Phase 1)
| File | Role |
|------|------|
| `skills/grading_skill.md` | The runtime system prompt / rubric the VLM loads. Edit grading behavior here. |
| `backend/grading_agent.py` | Visual path: labelled image groups → Gemini → defensive JSON parse + retry. |
| `backend/schemas.py` | `GradeResult` strict schema (grade/score-band/boolean consistency). |
| `backend/config.py` | Model name (`GEMINI_MODEL`, default `gemini-2.5-flash`) + key loading. Swap model here. |
| `backend/main.py` | FastAPI: `GET /`, `GET /health`, `POST /grade`, `POST /grade/functional`. |
| `backend/category_map.py` | 20 categories → grading path. Visual/functional/hybrid. |
| `frontend/index.html` | Skeletal vanilla-JS demo UI. |

## Run / test — Grading
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
| `routing/seed_locations.py` | Multi-region node/FC data. `ACTIVE_REGION` switches the demo region. |
| `routing/router.py` | Hard economic gates + XGBoost (or rule_fallback if .pkl absent). |
| `routing/route_api.py` | FastAPI on :8100. `POST /route`, `POST /grade-and-route`, `GET /health`. |
| `routing/economics.py` | Amortized per-item fuel + CO2; computed donate/liquidate break-even. |
| `routing/geo.py` | OSRM road distances; nearest-node/FC; multi-region external-FC handling. |
| `routing/model/train_router.py` | XGBoost trainer CLI — **user runs this**, not Claude. |
| `routing/db/seed_db.py` | Seeds both Bengaluru (23 rows) + Udupi (15 rows) into SQLite. |
| `routing/db/README_udupi_demo.md` | Exact UI inputs + expected outputs for both Udupi demo scenarios. |
| `frontend_routing/index.html` | Demo UI. Region dropdown (Udupi/Bengaluru). Calls :8100. |

**Key framing**: returns are NEW units (full original_price). Routing = logistics arbitrage:
local intercept cost vs FC haul + fresh-unit reship. `pricing.py` is stubbed — reserved for
the P2P exchange. Never import it in routing.

**Multi-region**: `ACTIVE_REGION = "udupi"` in `seed_locations.py` (default). Pass
`"region": "bengaluru"` or `"region": "udupi"` in the `/route` request body to override.
Udupi has no in-region FC — nearest is BLR cluster ~448 km over Ghats (OSRM-verified).

Run the routing API: `uvicorn routing.route_api:app --reload --port 8100` (from repo root, venv active).
Seed the DB first: `python -m routing.db.seed_db`

**Economic framing changed** — old `.pkl` is stale. Retrain before demoing XGBoost path:
```bash
python -m routing.model.generate_training_data   # already done
python -m routing.model.train_router             # retrain with new features
```
Until retrained, `decided_by` will be `"rule_fallback"` — API still works fully.
Hard gates (decided_by=`"hard_gate"`) fire before XGBoost for clear-cut cases.

## P2P Resale Exchange (Phase 5)

**Package:** `p2p/`  **API port:** 8200  **Demo UI port:** 5600

Self-contained — **never imports from `routing/`** (and vice versa).

Key files:
| File | Role |
|------|------|
| `p2p/config.py` | All P2P constants — delivery vehicle, warranty bonus rate. |
| `p2p/lifespan_table.py` | 22 categories with `(min, max, avg)` resale window years. Covers all 20 grading-API categories + baby_monitor, smartphone, backpack. |
| `p2p/pricing.py` | **THE** age + condition depreciation module. CONDITION_MULTIPLIER A/B/C/D. Two-stage pricing. AGE_VALUE_FLOOR per category. |
| `p2p/notifier.py` | build_resale_nudge() — Stage-1 estimate + simulate_years demo time-travel. |
| `p2p/listing.py` | create_listing() — Stage-2 price + Health Card. Writes to listings table. |
| `p2p/demand.py` | find_nearby_demand() + generate_demand() (demo seed button). |
| `p2p/handoff.py` | A→station→B logistics + platform fee + seller payout. |
| `p2p/db/seed_p2p.py` | Seed relay_p2p.db. Run: `python -m p2p.db.seed_p2p` |
| `p2p/p2p_api.py` | FastAPI on :8200. 7 endpoints: /nudge, /list, /listing, /demand/find, /demand/generate, /handoff, /purchases |
| `frontend_p2p/index.html` | 4-step demo UI on :5600. |
| `p2p/README_p2p_demo.md` | Click-path + exact expected numbers. |

Run P2P stack:
```bash
python -m p2p.db.seed_p2p
uvicorn p2p.p2p_api:app --reload --port 8200
python -m http.server 5600 --directory frontend_p2p
```

**Pricing separation is load-bearing:**
- Routing = item is NEW, `original_price`, no depreciation. Logistics arbitrage only.
- P2P = item is USED. `original_price × age_factor × CONDITION_MULTIPLIER[grade]`. This is the ONLY place age/depreciation lives.

## Port map
| Port | Service |
|------|---------|
| 8000 | Grading API (`backend/main.py`) |
| 8100 | Routing API (`routing/route_api.py`) |
| 8200 | P2P Exchange API (`p2p/p2p_api.py`) |
| 5500 | Routing demo UI (`frontend_routing/index.html`) |
| 5600 | P2P demo UI (`frontend_p2p/index.html`) |

## Status
Phase 1 (visual agent) is **complete and live-tested** against real photos: a backpack with a
separated zipper grades C (not resale-eligible, refurbish recommended) while a clean unit grades
A, and catalog-vs-phone differences are correctly ignored. Skill also covers stains/fading.

Phase 3 (geo-routing) is **complete and API-tested**: :8100 routes returns to RESELL_LOCAL /
REFURBISH / DONATE / LIQUIDATE using hard economic gates + rule engine. XGBoost activates
after one `train_router.py` run. Demo UI on :5500 shows decision badge, scores, geography, and
money-shot savings. **Two regions live**: Bengaluru (FC ~22 km, modest savings) and Udupi
(FC ~448 km over Ghats, ₹59.82/item saved, 1.58 kg CO₂ avoided on a ₹400 shoe).

Phase 5 (P2P exchange) is **complete and API-tested**: :8200 handles the full 4-step flow —
time-triggered nudge → graded listing with Health Card → nearby buyer match → handoff logistics.
lifespan_table covers all 22 categories. Seed DB has 2 demo purchases (Udupi).

Next: Phase 2 hybrid answer-merge. See `docs/TODO.md`.
