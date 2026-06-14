# CLAUDE.md — Amazon Relay

Project guidance for Claude Code working in this repo.

## What this is
Amazon Relay — Amazon HackOn 2026 submission. An intelligent reverse-logistics system that
gives returned products a second life (resell / refurbish / donate / liquidate / P2P resale).
**Phases 1 (grading), 3 (geo-routing), and 5 (P2P exchange) are complete and live-tested.**
As of Phase 6, all three run inside **ONE FastAPI backend on a single port (:8000)**.

- First file to read for structure → [`backend/README.md`](backend/README.md)
- Problem statement + solution framing → [`docs/CONTEXT.md`](docs/CONTEXT.md)
- Phased build tracker / current status → [`docs/TODO.md`](docs/TODO.md)
- How pieces fit together → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Seeding the one DB → [`backend/seed/README.md`](backend/seed/README.md)

## Unified backend (Phase 6)

ONE app, ONE port, ONE database, three self-contained domains under `backend/`:

```
backend/
├── main.py            # the single FastAPI app: CORS + includes 3 routers + GET / + GET /health
├── core/              # shared infra (the ONLY common import for all domains)
│   ├── config.py      #   GEMINI_API_KEY/MODEL, DB_PATH, project paths, one .env loader
│   ├── gemini.py      #   the one Gemini client/key loader
│   └── db.py          #   the one get_connection() → backend/data/relay.db
├── grading/  (Phase 1)   config.py · grading_agent.py · functional_grader.py · category_map.py · schemas.py · router.py
├── routing/  (Phase 3/3b) config.py · seed_locations.py · geo.py · economics.py · pricing.py(stub) · router_logic.py · explainer.py · model/ · router.py
├── p2p/      (Phase 5)   config.py · lifespan_table.py · pricing.py · notifier.py · listing.py · demand.py · handoff.py · router.py
├── data/relay.db      # the ONE consolidated db (generated, gitignored)
└── seed/              # seed_routing.py · seed_p2p.py · seed_all.py · README.md
```

### Run / seed
```bash
pip install -r requirements.txt    # or use the existing .venv/
export GEMINI_API_KEY="..."        # or a root .env
python -m backend.seed.seed_all    # build backend/data/relay.db
uvicorn backend.main:app --reload  # → http://localhost:8000  (/docs covers everything)
```
Demo UIs (static, each on its own port, all call :8000):
- grading UI served by the app at `/`
- `python -m http.server 5500 --directory frontend_routing`  (calls `:8000`)
- `python -m http.server 5600 --directory frontend_p2p`      (calls `:8000/p2p`)

### Route map (single port)
`GET /health` · `GET /` · `POST /grade` · `POST /grade/functional` · `POST /route` ·
`POST /grade-and-route` · `GET /p2p/purchases` · `GET /p2p/nudge/{id}` · `POST /p2p/list` ·
`GET /p2p/listing/{id}` · `POST /p2p/demand/find` · `POST /p2p/demand/generate` · `POST /p2p/handoff`

## MODULE BOUNDARIES (load-bearing — keep true)
1. **Domains never import each other's logic.** `grading ⊥ routing ⊥ p2p`. The only common
   import is `backend/core/`. Need a helper from another domain? Copy the small function.
2. **Routers are thin.** Parse → call domain function → shape response. No logic in routers.
   Upgrade a tool by editing its domain package; routers/core stay untouched.
3. **Pricing separation is sacred.** Routing = NEW unit, full `original_price`, no depreciation
   (logistics arbitrage). P2P = USED unit; `backend/p2p/pricing.py` is the ONLY depreciation
   home. `backend/routing/pricing.py` stays a stub. They never share a pricing path.
4. **Each domain is independently importable** for tests.
5. **Never throw across the API boundary.** grading → `grade:"ERROR"`; routing never 500s
   (rule-fallback if `.pkl` absent); p2p → `{"error": ...}`.

## Core idea (grading)
A Gemini VLM inspects **inspection** photos (the returned product) for real damage, using
**reference** photos (catalog image) only as design context — NOT a similarity/pixel-delta
target. Output is strict JSON (grade A–D, score, defects, resale eligibility) — the same schema
for every grading path, so the router is path-agnostic. Paths auto-selected by category
(`backend/grading/category_map.py`): visual (hero) / functional (stub) / hybrid (visual now).

## Conventions / guardrails
- **The grading agent must never throw.** Model/parse/API failures return a structured
  `{"grade": "ERROR", ...}` dict. Transient API errors (503/429/timeout) retry with backoff.
- Gemini wraps JSON in ```json fences often → the parser strips fences defensively. Keep that.
- **Reference = design context only, never a similarity target.** Catalog-vs-phone differences
  (colour/angle/lighting/background) are NOT defects. Grade damage on the returned unit itself.
  A broken functional part (zipper etc.) blocks resale even if cosmetically clean.
- Uniform grade schema across all paths is load-bearing for routing — don't diverge.
- The ONE Gemini client lives in `backend/core/gemini.py`. Grading agent + routing explainer
  both use it — don't reintroduce per-module key loaders.
- Verify the `google-genai` SDK call shape against current docs before changing Gemini calls.
- Hackathon MVP: prefer a working vertical slice over polish. Don't over-engineer.

## Routing notes
- **Framing**: returns are NEW units (full `original_price`). Decision = local intercept cost
  vs FC haul + fresh-unit reship. Hard economic gates fire before XGBoost; rule-fallback if the
  `.pkl` is absent. Decision logic is `backend/routing/router_logic.py`.
- **Multi-region**: `ACTIVE_REGION = "udupi"` in `backend/routing/seed_locations.py`. Pass
  `"region": "bengaluru"|"udupi"` in the `/route` body. Udupi has no in-region FC — nearest is
  the BLR cluster ~448 km over the Ghats (OSRM-verified). Real Udupi numbers: ₹59.82/item,
  1.58 kg CO₂ on a ₹400 shoe.
- **Retrain** (only if you change features): old `.pkl` is for the current 13-feature framing.
  `python -m backend.routing.model.generate_training_data && python -m backend.routing.model.train_router`

## P2P notes
- **Two-stage pricing**: Stage-1 (pre-grade) assumes Grade C (0.40); Stage-2 uses the real
  grade. A/B (0.85/0.65) > C → price STRUCTURALLY rises after grading (mechanical guarantee).
- **Lifespan table** (`backend/p2p/lifespan_table.py`): 22 categories (all 20 grading-API
  categories + baby_monitor, smartphone, backpack), each `(min, max, avg)` resale-window years.
- **Time trigger**: `notifier.build_resale_nudge()` fires when age ∈ resale window;
  `simulate_years` enables demo time-travel without touching the DB.
- **Same-town handoff**: demand matched within 12 km of the seller's station; platform fee 5%.

## Status
Phase 1 (visual agent) — complete, live-tested against real photos. Phase 3/3b (geo-routing) —
complete, API-tested; two regions (Bengaluru metro, Udupi tier-3). Phase 5 (P2P) — complete,
API-tested; full 4-step flow. **Phase 6 (consolidation) — complete**: one app on :8000, one
`relay.db`, one Gemini loader, thin routers, `grade-and-route` now in-process (no HTTP hop).
All endpoints verified on the unified app with identical numbers to the pre-merge services.

Next: Phase 2 hybrid answer-merge. See `docs/TODO.md`.
