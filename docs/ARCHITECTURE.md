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

**Grading philosophy (in `skills/grading_skill.md`):** the reference is *design context only*,
not a similarity target. Catalog-vs-phone differences (colour, angle, lighting, background,
colourway) are explicitly **not** defects. The agent inspects functional/closure components
first (a broken zipper blocks resale even on a cosmetically clean item), then surfaces for
stains / discolouration / uneven fading — judging fading by comparing one area of the returned
item to another, not to the catalog colour.

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

## Routing Agent (Phase 3) — `routing/`

A **separate, independently-importable package** on **port 8100**. Consumes the grading JSON
and decides: `RESELL_LOCAL | REFURBISH | DONATE | LIQUIDATE`.

### Core framing: logistics arbitrage, not resale pricing

Every return arrives inside the return window — it is a **fresh, current-generation unit at
full original price**. There is no age depreciation in routing. The decision is purely:

> **"Is intercepting this return locally cheaper/greener than hauling it to the FC AND
> shipping a fresh unit FROM the FC back to the same nearby buyer?"**

Age/depreciation pricing is reserved for a separate future peer-to-peer exchange product
(`routing/pricing.py` is stubbed with that note). It does NOT belong here.

### Decision pipeline (`routing/router.py`)

```
grade_json + order_meta (no age_months)
        │
        ▼
  1. item_value = original_price  (unit is new — no pricing step, no depreciation)
        │
        ▼
  2. Geography (routing/geo.py)
     nearest_rcc ← haversine over 8 Bengaluru RCCs × 1.4 road-circuity factor
     nearest_fc  ← 4 FCs mapped from the chosen RCC
        │
        ▼
  3. Nearby-demand DB lookup (SQLite: pending_orders within NEARBY_DEMAND_RADIUS_KM=8)
     buyer_found, buyer_distance_km, buyer_pincode
        │
        ▼
  4. Dual-path economics (routing/economics.py) — PER ITEM, amortized
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
  7. Explainer (routing/explainer.py) — ONE Gemini call, never affects the decision
     2–3 sentence ops/buyer-facing narrative. Templated fallback if no API key.
```

### Geography model

8 Bengaluru RCCs + 4 FCs seeded from real area centroids (approximate — marked with TODO
for exact geocoding). `ROAD_CIRCUITY = 1.4` converts haversine → practical road distance.

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

### Ports

| Port | Service |
|------|---------|
| 8000 | Grading API (`backend/main.py`) — **never touched by routing** |
| 8100 | Routing API (`routing/route_api.py`) |
| 5500 | Routing demo UI (`frontend_routing/index.html`) |

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
