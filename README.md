# Amazon Relay

Amazon HackOn 2026 submission. An intelligent reverse-logistics system that gives
returned/unused products a meaningful second life — **grade → route → resell/refurbish/donate/
liquidate**, plus a proactive **P2P resale exchange** for items a customer still owns.

> - Structure / file map → [`backend/README.md`](backend/README.md) (read this first)
> - Problem statement + solution → [`docs/CONTEXT.md`](docs/CONTEXT.md)
> - How it fits together → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
> - Build tracker → [`docs/TODO.md`](docs/TODO.md)

## What it does

Three domains, one FastAPI backend on a single port (`:8000`):

1. **Grading** (Gemini VLM) — given **reference** photos (catalog, design context only) and
   **inspection** photos (the returned item), grades real damage on the returned unit and emits
   strict JSON (grade A–D, score, defects, resale eligibility). Visual (hero) + functional (stub)
   paths, auto-selected by category.
2. **Routing** (XGBoost + hard economic gates) — decides `RESELL_LOCAL / REFURBISH / DONATE /
   LIQUIDATE` by logistics arbitrage (returns treated as NEW units at full price). Two regions:
   Bengaluru metro and Udupi tier-3.
3. **P2P resale exchange** — a time-triggered nudge when an owned item enters its resale window,
   two-stage pricing, a Product Health Card, same-town buyer matching, and handoff logistics.

## Run it

```bash
# 1. Install deps (use a virtualenv if you like)
pip install -r requirements.txt

# 2. Set your Gemini API key (get one at https://aistudio.google.com/apikey)
export GEMINI_API_KEY="your-key-here"
#   ...or: cp .env.example .env  and fill it in

# 3. Seed the one consolidated database
python -m backend.seed.seed_all

# 4. Start the single backend (from the amazon-relay/ root)
uvicorn backend.main:app --reload          # :8000  ·  /docs has every endpoint

# 5. Start the frontend (primary UI: React)
cd frontend_react && npm install && npm run dev    # → http://localhost:5173
#    (the backend also serves a small static grading demo at http://localhost:8000/ )
```

## API (single port)

| Method | Path | Body / purpose |
|--------|------|----------------|
| GET  | `/` | serves the legacy grading demo UI |
| GET  | `/health` · `/metrics` | aggregate status · lifetime CO₂/₹ saved + active listings |
| POST | `/grade` | multipart: `category`, optional `asin` (auto-loads catalog ref), `reference_images[]`, `inspection_images[]` |
| POST | `/grade/functional` | JSON: `{"category": "...", "answers": [true, false, ...]}` |
| GET  | `/catalog/image/{asin}` | serves the product's catalog reference photo |
| POST | `/route` | route a graded return |
| POST | `/grade-and-route` | route a supplied `grade_json` (in-process) |
| POST | `/route/intercept` | held-at-RCC unit + chosen buyer → intercept vs FC (dynamic) |
| GET/POST | `/p2p/*` | nudge · list · listing · demand/find · demand/generate · handoff · purchases |

`/docs` covers everything.

## Layout

```
amazon-relay/
├── backend/         # THE app
│   ├── main.py      #   single FastAPI app (one port)
│   ├── core/        #   shared config, db, gemini
│   ├── grading/     #   Phase 1 — Gemini VLM grading
│   ├── routing/     #   Phase 3/3b — geo-routing + XGBoost
│   ├── p2p/         #   Phase 5 — resale exchange
│   ├── catalog_images/ # reference photos by ASIN (gitignored)
│   ├── data/        #   relay.db (generated, gitignored)
│   └── seed/        #   seed_routing / seed_p2p / seed_catalog / seed_all + README
├── frontend_react/      # PRIMARY UI — Vite + React + Tailwind + framer-motion + Leaflet (:5173)
├── frontend/            # small static grading demo served by the app at / (visual + functional checklist)
├── skills/          # grading_skill.yaml — the runtime rubric
├── docs/            # CONTEXT, ARCHITECTURE, TODO
└── sample_images/
```
