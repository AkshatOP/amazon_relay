# Amazon Relay — Unified Backend

**Read this first.** One FastAPI app, one port (`:8000`), one SQLite database, three
self-contained domains. This file is the map.

## Run

```bash
pip install -r requirements.txt            # from repo root (or use the existing .venv/)
export GEMINI_API_KEY="..."                # or put it in a root .env

python -m backend.seed.seed_all            # build backend/data/relay.db (routing + p2p)
uvicorn backend.main:app --reload          # → http://localhost:8000   (/docs has everything)
```

The three demo UIs are static; serve each on its own port (they call `:8000`):
```bash
python -m http.server 5500 --directory frontend_routing   # routing UI  → calls :8000
python -m http.server 5600 --directory frontend_p2p       # p2p UI      → calls :8000/p2p
# the grading UI is served by the app itself at http://localhost:8000/
```

## Structure

```
backend/
├── main.py            # THE single FastAPI app — CORS, includes 3 routers, GET / , GET /health
│
├── core/              # shared infra — the ONLY thing all domains import in common
│   ├── config.py      #   one settings loader: GEMINI_API_KEY/MODEL, DB_PATH, project paths, .env
│   ├── gemini.py      #   one Gemini client/key loader (grading + routing explainer reuse it)
│   └── db.py          #   one get_connection() → backend/data/relay.db
│
├── grading/           # Phase 1 — Gemini VLM condition grading
│   ├── config.py      #   grading-scoped settings (skill path, retries); pulls shared bits from core
│   ├── grading_agent.py / functional_grader.py / category_map.py / schemas.py   (logic, unchanged)
│   └── router.py      #   APIRouter: POST /grade, POST /grade/functional
│
├── routing/           # Phase 3 / 3b — RESELL_LOCAL / REFURBISH / DONATE / LIQUIDATE
│   ├── config.py      #   routing-scoped constants (fuel/vehicle/radius); DB_PATH from core
│   ├── seed_locations.py / geo.py / economics.py / pricing.py(stub)             (logic, unchanged)
│   ├── router_logic.py#   the decision brain (hard gates + XGBoost) — renamed from old router.py
│   ├── explainer.py   #   single Gemini narrative call (via core.gemini)
│   ├── model/         #   generate_training_data.py, train_router.py, *.csv, *.pkl
│   └── router.py      #   APIRouter: POST /route, POST /grade-and-route
│
├── p2p/               # Phase 5 — proactive resale exchange
│   ├── config.py      #   p2p-scoped constants; P2P_DB_PATH aliases core DB_PATH
│   ├── lifespan_table.py / pricing.py / notifier.py / listing.py / demand.py / handoff.py  (logic)
│   └── router.py      #   APIRouter (prefix /p2p): nudge, list, listing, demand, handoff, purchases
│
├── data/relay.db      # the ONE consolidated database (generated, gitignored)
└── seed/              # all seeding — writes to backend/data/relay.db (see seed/README.md)
    ├── seed_routing.py / seed_p2p.py / seed_all.py
```

## Route map (single port, namespaced)

| Method | Path | Domain |
|--------|------|--------|
| GET | `/health` | app (aggregates all three) |
| GET | `/` | serves the grading demo UI |
| POST | `/grade` | grading |
| POST | `/grade/functional` | grading |
| POST | `/route` | routing |
| POST | `/grade-and-route` | routing (in-process; no HTTP hop) |
| GET | `/p2p/purchases` | p2p |
| GET | `/p2p/nudge/{purchase_id}` | p2p |
| POST | `/p2p/list` | p2p |
| GET | `/p2p/listing/{listing_id}` | p2p |
| POST | `/p2p/demand/find` | p2p |
| POST | `/p2p/demand/generate` | p2p |
| POST | `/p2p/handoff` | p2p |

`/docs` (Swagger) covers all of them.

## MODULE BOUNDARIES (load-bearing — keep these true)

1. **Domains never import each other's business logic.** `grading ⊥ routing ⊥ p2p`.
   The only shared imports are from `backend/core/`. If p2p needs a geo helper, it copies the
   small function rather than importing routing — so either tool can be upgraded independently.
2. **Routers are thin.** An APIRouter only parses the request, calls a domain function, and
   shapes the response. No business logic in routers. → upgrade a tool by editing its domain
   package; routers and core usually stay untouched.
3. **Pricing separation is sacred.** Routing treats every return as a NEW unit at full
   `original_price` (logistics arbitrage, no depreciation). P2P is the ONLY place
   age + condition depreciation lives (`backend/p2p/pricing.py`). `backend/routing/pricing.py`
   stays a stub. Routing and p2p never share a pricing path.
4. **Each domain is independently importable** for tests (its functions work without spinning
   the whole app).
5. **Never throw across the API boundary.** Grading returns `grade:"ERROR"`; routing never
   500s (rule-fallback if the model `.pkl` is absent); p2p functions return `{"error": ...}`.

## How to upgrade ONE tool

Edit that tool's domain package (`backend/<domain>/`) and its scoped `config.py`. The router
and `core/` usually don't change. Example: to tune routing economics, edit
`backend/routing/economics.py` + `backend/routing/config.py` — grading and p2p are untouched.

## The XGBoost model

`backend/routing/model/router_model.pkl` is loaded by `router_logic.py`. If absent, routing
falls back to the rule engine (`decided_by="rule_fallback"`) and still works. To (re)train:
```bash
python -m backend.routing.model.generate_training_data
python -m backend.routing.model.train_router
```
The economic framing is final (returns = new units, full-path cost includes the reship leg).
