# Relay HUB — Architecture

> **Packaging (Phase 6):** all three domains run inside ONE FastAPI app on a single port
> (`:8000`), backed by ONE SQLite database (`backend/data/relay.db`), with shared infra in
> `backend/core/` (config, db, gemini). Each domain is a self-contained sub-package
> (`backend/grading`, `backend/routing`, `backend/p2p`) with a thin APIRouter
> (`<domain>/router.py`) in front of unchanged business logic. See
> [`backend/README.md`](../backend/README.md) for the file map and module-boundary rules.

## End-to-end pipeline (vision)

```
Return initiated                          Item still owned (not returned)
      │                                            │
      ▼                                            ▼
┌─────────────────────┐              ┌─────────────────────────┐
│  Path selection      │              │  P2P Time Trigger        │  age enters resale window
│  (category_map.py)   │              │  (p2p/notifier.py)       │  → nudge notification
└─────────────────────┘              └─────────────────────────┘      (Phase 5)
      │                                            │
      ├── "visual"  ─► Grading Agent (Gemini VLM)  │
      ├── "functional" ─► Functional Grader         │
      └── "hybrid"  ─► both                        ▼
      │                                  ┌──────────────────────┐
      ▼                                  │  P2P Listing          │  Stage-2 price + Health Card
┌─────────────────────┐                  │  (p2p/listing.py)     │
│  Grade JSON          │                  └──────────────────────┘
│  (uniform schema)    │                            │
└─────────────────────┘                            ▼
      │                                  ┌──────────────────────┐
      ▼                                  │  Demand Match         │  same-town, 12 km radius
┌─────────────────────┐                  │  (p2p/demand.py)      │
│  Routing Agent       │  XGBoost ──►    └──────────────────────┘
│  RESELL_LOCAL /      │  REFURBISH /               │
│  DONATE / LIQUIDATE  │  etc.                       ▼
└─────────────────────┘              ┌──────────────────────────┐
                                     │  Handoff Logistics        │  seller→station→buyer
                                     │  (p2p/handoff.py)         │
                                     └──────────────────────────┘
```

## Components

### Path selection — `backend/grading/category_map.py`
A `GRADING_PATH` dict maps 20 product categories → `"visual" | "functional" | "hybrid"`.
`get_path(category)` defaults unknown categories to `"visual"`. In production the category
is derived from the order-history SKU; in the demo it comes from a dropdown.

Categories: shoes/footwear/clothing/phone_case/bag/watch/baby_gear/toy/book (visual);
charger/power_bank/speaker/cable/mouse/keyboard (functional);
laptop/headphones/camera/appliance (hybrid).

### Condition Grading Agent (visual) — `backend/grading/grading_agent.py`
The hero. `grade_visual(reference_image_paths, inspection_image_paths, category)`
(builds its Gemini call via the shared `backend/core/gemini.py` client):
1. Loads `skills/grading_skill.yaml` as the Gemini **system instruction**.
2. Reads image bytes; builds a multimodal request with **clearly labelled groups** — a text
   part marking the reference set as **"catalog, context only"**, then the reference image
   parts, then a text part marking the inspection set as **"returned item — grade this"**,
   then those parts.
3. Calls Gemini (`response_mime_type="application/json"`), with **retry-and-backoff on
   transient API errors** (503 high-demand / 429 rate-limit / timeout) so a momentary spike
   doesn't break a live demo.
4. **Defensively strips** any ```json fences / whitespace, then `json.loads`.
5. Validates against the pydantic schema. On parse/validation failure, **retries once** with
   a stricter "return ONLY valid JSON" nudge; if it still fails, returns a structured
   `grade: "ERROR"` dict (low confidence, raw text preserved) — **never throws**, so the API
   never 500s on a model formatting hiccup.
6. Non-transient Gemini errors (bad key, exhausted retries) are caught and returned as clear
   structured errors.

**Grading philosophy (in `skills/grading_skill.yaml`):** the reference is *design context only*,
not a similarity target. Catalog-vs-phone differences (colour, angle, lighting, background,
colourway) are explicitly **not** defects. The agent inspects functional/closure components
first (a broken zipper blocks resale even on a cosmetically clean item), then surfaces for
stains / discolouration / uneven fading — judging fading by comparing one area of the returned
item to another, not to the catalog colour.

### Functional Grader (stub) — `backend/grading/functional_grader.py`
`grade_functional(answers: list[bool])` applies simple rules (all yes → B/7; majority yes →
C/4; mostly no → D/2) and emits the **same** JSON schema.

### Schema — `backend/grading/schemas.py`
Pydantic models enforce `grade ∈ {A,B,C,D}`, the score band matching the grade,
`confidence ∈ [0,1]`, and the rubric-derived booleans. The uniform `GradeResult` is what
every path returns and what downstream consumes.

### App + routers — `backend/main.py` + `<domain>/router.py`
`backend/main.py` is the single FastAPI app: CORS, `GET /`, aggregate `GET /health`, and
`include_router()` for the three thin domain routers. Grading's router
(`backend/grading/router.py`) exposes:
- `POST /grade` — multipart (`category`, `reference_images[]`, `inspection_images[]`); saves
  uploads to a temp dir, looks up the path, calls `grade_visual` for visual/hybrid.
- `POST /grade/functional` — JSON yes/no answers → `grade_functional`.

### Shared config — `backend/core/config.py` (+ scoped `<domain>/config.py`)
`core/config.py` loads ONE root `.env` and centralizes the Gemini model name (`GEMINI_MODEL`,
default `gemini-2.5-flash`), `GEMINI_API_KEY`, and `DB_PATH` (`backend/data/relay.db`). Each
domain keeps its own scoped `config.py` for domain-specific constants and pulls the shared
bits from core. The single Gemini client lives in `backend/core/gemini.py`.

## Why a uniform output schema

The two paths produce condition grades in completely different ways (a VLM vs a rule table),
but they emit identical JSON. This decouples grading from routing: the Phase 3 XGBoost router
consumes `score` + `defects` length + `grade` without knowing or caring how they were derived.

## Routing Agent (Phase 3) — `backend/routing/`

A self-contained, independently-importable sub-package mounted at the app root
(`POST /route`, `POST /grade-and-route`). Consumes the grading JSON and decides:
`RESELL_LOCAL | REFURBISH | DONATE | LIQUIDATE`. Decision logic is `router_logic.py`; the
thin APIRouter is `router.py`.

### Core framing: logistics arbitrage, not resale pricing

Every return arrives inside the return window — it is a **fresh, current-generation unit at
full original price**. There is no age depreciation in routing. The decision is purely:

> **"Is intercepting this return locally cheaper/greener than hauling it to the FC AND
> shipping a fresh unit FROM the FC back to the same nearby buyer?"**

Age/depreciation pricing belongs to the P2P exchange product
(`backend/routing/pricing.py` is stubbed with that note). It does NOT belong here.

### Decision pipeline (`backend/routing/router_logic.py`)

```
grade_json + order_meta (no age_months)
        │
        ▼
  1. item_value = original_price  (unit is new — no pricing step, no depreciation)
        │
        ▼
  2. Geography (backend/routing/geo.py)
     nearest_rcc ← haversine over 8 Bengaluru RCCs × 1.4 road-circuity factor
     nearest_fc  ← 4 FCs mapped from the chosen RCC
        │
        ▼
  3. Nearby-demand DB lookup (SQLite: pending_orders within NEARBY_DEMAND_RADIUS_KM=8)
     buyer_found, buyer_distance_km, buyer_pincode
        │
        ▼
  4. Dual-path economics (backend/routing/economics.py) — PER ITEM, amortized
     full_path  = leg1 (customer→RCC)              [mini-truck, 18 items/trip]
                + leg2 (RCC→FC)                    [container truck, 250 items/trip]
                + reship (FC→nearby buyer)          [container if >50 km, mini-truck if local]
                + inspection + storage
                ← this is the TRUE cost of NOT intercepting (FC also has to ship a fresh unit)
     local_path = leg1 + local delivery (RCC→buyer) — deletes BOTH FC legs entirely
     savings = full_path − local_path  (the money-shot: Rs 78.87/item, 2.15 kg CO₂ in tier-3)
        │
        ▼
  5. Hard gates (deterministic, auditable — always fire before XGBoost)
     Gate 1: grade D  OR  (!resale_eligible AND !refurbish_recommended)
                  → donate_or_liquidate(original_price, category, haul)
     Gate 2: !resale_eligible AND refurbish_recommended
                  → REFURBISH (FC inbound for repair; can't fulfill a "new" order as-is)
     Gate 3: grade A/B AND score≥6 AND resale_eligible AND nearby_demand AND savings>0
                  → RESELL_LOCAL  [decided_by: "hard_gate"]
     → if a gate fires: stop
        │
        ▼
  6. XGBoost (routing/model/router_model.pkl) — fuzzy zone (good item, no buyer, etc.)
     13-feature vector → 4-class softprob  [decided_by: "xgboost"]
     → fallback: decided_by="rule_fallback" if .pkl absent
        │
        ▼
  7. Explainer (backend/routing/explainer.py) — ONE Gemini call via core/gemini, never
     affects the decision. 2–3 sentence ops/buyer-facing narrative. Templated fallback if no key.
```

### Geography model — multi-region

**Bengaluru (metro):** 8 RCCs + 4 FCs, seeded from real area centroids. `ROAD_CIRCUITY = 1.4`
for haversine fallback. FC is ~22-28 km from any RCC; savings are real but modest.

**Udupi (tier-3 coastal):** No dedicated RCCs and no local FC. 6 local last-mile delivery
stations (courier franchisees / India Post hubs) double as mini-RCC + 1-2 day holding buffer
+ intercept-delivery launch point. The nearest FC is the Bengaluru cluster ~400 km over
the Western Ghats (NH 169 + NH 75 via Shiradi Ghats). OSRM measures the real road distance
at runtime; `road_km_default=400` is the fallback.

Path for Udupi:
```
Customer → Local Delivery Station (acts as mini-RCC + holding)
               ├── (intercept) → nearby buyer [deletes 400 km haul + 400 km reship]
               └── (no buyer)  → 400 km Ghats haul → BLR FC → reship fresh unit
```

Switch region by setting `ACTIVE_REGION` in `backend/routing/seed_locations.py` or by passing
`"region": "udupi"` / `"region": "bengaluru"` in the `/route` request body.
The tier-3 projection (612 km synthetic) is suppressed for Udupi — the real 448 km IS
the tier-3 story. See `backend/seed/README_udupi_demo.md` for exact demo inputs.

### Economics honesty

**Metro** (FC 20–22 km): savings ~₹14.75/item, CO₂ saved ~0.26 kg/item (real but modest).
**Tier-3** (FC ~612 km): savings ~₹78.87/item, CO₂ saved ~2.15 kg/item — local intercept
eliminates BOTH the 612 km inbound haul AND the 612 km fresh-unit reship. This is the
hackathon demo's impact story. Both numbers are reported honestly; the UI shows tier-3
projection clearly labelled alongside the metro reality.

### Donate-vs-liquidate boundary (computed, not hardcoded)

```python
liquidation_net = original_price * 0.15 - haul_cost * weight_factor[category]
donate_or_liquidate → "DONATE" if liquidation_net ≤ donation_value[category] else "LIQUIDATE"
```

Full original price is used (unit is new). A cheap heavy book (poor scrap recovery after a
costly haul, decent donation ESG credit) donates; a light watch may liquidate. The boundary
emerges from category economics — no hardcoded price thresholds.

### Single-port route map (Phase 6)

All endpoints are served by one app (`uvicorn backend.main:app`) on **:8000**:

| Method | Path | Domain |
|--------|------|--------|
| GET  | `/health` · `/metrics` | app (aggregates all three; metrics = lifetime CO₂/₹ saved + active listings) |
| GET  | `/` | serves the legacy grading demo UI |
| POST | `/grade` (+`asin`), `/grade/functional` · GET `/catalog/image/{asin}` | grading |
| POST | `/route` | routing |
| POST | `/grade-and-route` | routing — **in-process** grade→route (no HTTP hop) |
| POST | `/route/intercept` | routing — held unit + chosen buyer → intercept vs FC (dynamic) |
| GET  | `/p2p/purchases`, `/p2p/nudge/{id}`, `/p2p/listing/{id}` | p2p |
| POST | `/p2p/list`, `/p2p/demand/find`, `/p2p/demand/generate`, `/p2p/handoff` | p2p |

Previously these ran as three apps on :8000/:8100/:8200 and `/grade-and-route` proxied to the
grading service over HTTP. That HTTP hop is gone — everything is one process now.

### Frontend (Phase 7)
The primary UI is **`frontend_react/`** — a Vite + React 18 + Tailwind + framer-motion + Leaflet
app (one mobile-first shell, 9 screens incl. the buyer Shop, animated transitions). It calls
`:8000` (CORS open). A small static `frontend/index.html` is also served by the app at `GET /`
(the grading demo + the weighted functional-grading checklist UI). The earlier per-domain
static demos (`frontend_app/`, `frontend_routing/`, `frontend_p2p/`) were removed in cleanup.
See `frontend_react/README.md`.

### Catalog auto-reference (grading)
`POST /grade` takes an optional `asin`; with no uploaded reference image the backend loads the
catalog (good-product) photo for that ASIN — `backend/grading/catalog.py` resolves the
`catalog` table (seeded by `seed_catalog.py`) to a file under `backend/catalog_images/<asin>.jpg`
or an https URL. `GET /catalog/image/{asin}` serves it for the UI (404 → icon fallback); a
missing file means grading runs reference-less. The response carries `reference_source`.

### Hold-at-RCC + dynamic intercept (routing)
A resale-eligible item (grade A/B) with no DB buyer is HELD at its nearest RCC for the 1–2 day
window instead of going straight to the FC. `POST /route/intercept`
(`router_logic.intercept_decision`) takes an explicit buyer location and compares, purely from
real road distances: local intercept (RCC→buyer) vs the FC round-trip (RCC→FC + FC→buyer
reship). `savings>0` → `RESELL_LOCAL` (reroute the held unit), else `SHIP_TO_FC`. The UI region
is auto-detected from the picked pickup pin, so the "nearest RCC" is genuinely nearest, not fixed.

## P2P Resale Exchange (Phase 5) — `backend/p2p/`

**Decoupled from routing.** Routing and P2P never import each other. Physical constants
(vehicle specs, warranty rate) live in `backend/p2p/config.py`; the DB path comes from core.

### The one rule: age + condition depreciation lives ONLY here

Routing treats returns as NEW units at full `original_price` (logistics arbitrage framing).
P2P is the only module that applies `age_factor × CONDITION_MULTIPLIER[grade]` to compute
a used-item resale price. Do not move this to routing; do not import it from routing.

### Two-stage pricing

```
Stage 1 (pre-grade / nudge):
  estimate = original_price × age_factor(category, age_years) × CONDITION_MULTIPLIER["C"]
  Shows seller A the floor — motivates the resale decision.
  Conservative because C=0.40 is the midpoint grade.

Stage 2 (post-grade / listing):
  final = original_price × age_factor × CONDITION_MULTIPLIER[actual_grade]
  + warranty_bonus (2% × original_price × remaining_warranty_years)
  Grade A (0.85) or B (0.65) > C (0.40) → price STRUCTURALLY rises vs Stage-1.
  This is a mechanical guarantee, not a claim.
```

### Nudge trigger

`notifier.build_resale_nudge()` fires when `age_years ∈ [min_years, max_years]` per
`LIFESPAN_YEARS[category]`. `simulate_years` parameter enables demo time-travel without
altering the DB (key for hackathon live demo — purchase_date can be today, simulated age 2yr).

### P2P handoff flow

```
[Time trigger fires]
      │
      ▼
Step 1: Nudge — Stage-1 price estimate sent to seller
      │
      ▼
Step 2: Seller lists item (after grading) → Stage-2 price revealed + Health Card built
      │
      ▼
Step 3: find_nearby_demand() — same-town buyers within P2P_DEMAND_RADIUS_KM (12 km)
      │
      ▼
Step 4: compute_handoff() — seller→station→buyer logistics, platform fee, seller payout
```

### Financials

Platform fee = 5% of asking price. Seller payout = asking_price − platform_fee.
For the demo scenario: asking ₹4,260 → fee ₹213 → payout ₹4,047.

---

## P2P Lifespan table — `backend/p2p/lifespan_table.py`

22 categories with tuned `(min_years, max_years, avg_years)` resale windows, aligned to the
grading API's 20 categories plus baby_walker, smartphone, backpack. Examples:

| Category | min | max | avg | Notes |
|----------|-----|-----|-----|-------|
| cable | 0.5 | 2.0 | 1.0 | connector wear; shortest window |
| clothing | 0.5 | 2.0 | 1.0 | season/fashion sensitive |
| shoes | 1.0 | 2.0 | 1.5 | condition > age |
| baby_walker | 1.5 | 3.0 | 2.0 | baby outgrows fast; strong used demand |
| laptop | 3.0 | 5.0 | 4.0 | slower tech cycle |
| watch | 4.0 | 8.0 | 5.0 | durable; mechanical holds value |
| book | 5.0 | 20.0 | 10.0 | edition matters more than age |

`age_factor = 1.0` for any item at or before `avg_years`. Decays linearly to `AGE_VALUE_FLOOR`
(per-category, in `backend/p2p/pricing.py`) at `max_years`.

---

## Why reference-as-context (not pixel-delta)

An earlier framing graded the *delta/similarity* between reference and inspection. Real-image
testing showed this backfires: with a catalog studio photo vs a phone photo, the model fixated
on "these don't look similar" and both missed a real defect (a separated zipper) and risked
penalising harmless colour/angle differences. The fix is to use the reference only to learn
the product's design, and grade damage on the returned unit itself. This is robust to the
production case too, where the reference is the exact SKU but still a studio shot.

## Path-selection logic (detail)

| Category examples                         | Path        | Rationale                                  |
|-------------------------------------------|-------------|--------------------------------------------|
| shoes, clothing, phone case, bag, watch   | visual      | condition = visible wear                   |
| charger, speaker, power bank, cable, mouse| functional  | a photo can't reveal if it works           |
| laptop, headphones, camera                | hybrid      | looks **and** function both matter         |
| (unknown)                                 | visual      | safe default — at least inspect the photos |
