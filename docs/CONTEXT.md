# Amazon Relay — Context

## Problem statement

Millions of products bought online are returned, underused, or discarded despite being
perfectly usable. Returns are expensive for customers, sellers, and the planet. Customers
also struggle to trust refurbished or second-hand products.

What if Amazon could create an intelligent ecosystem where returned or unused products
automatically find their next best owner? Imagine: AI deciding whether an item should be
resold, refurbished, donated, recycled, or exchanged; smart quality grading through
image/video analysis; personalized recommendations for certified refurbished products;
sustainable incentives for customers; easy peer-to-peer resale inside Amazon's trusted
ecosystem; predictive return prevention before a purchase is even made.
Build the future of sustainable commerce where every product gets a meaningful second life.

## Our proposed solution — Amazon Relay

An intelligent reverse-logistics system. Instead of returned/unused products travelling
hundreds of km to a warehouse and being liquidated at a loss, Relay:

1. **Grades** product condition using an AI agent (Gemini VLM + rule engine).
2. **Routes** it to the best outcome: `RESELL_LOCAL` / `REFURBISH` / `DONATE` / `LIQUIDATE`
   via a downstream XGBoost model with hard economic gates.
3. **Matches** it to nearby buyers who already declared they want it.
4. **Generates** a Product Health Card as a trust layer for the next buyer.
5. **Enables P2P resale** — when an item is still owned (not returned) but entering end of
   useful life, a proactive nudge triggers a same-town resale via the P2P Exchange.

## What's built (June 2026)

| Phase | Module | Status |
|-------|--------|--------|
| Phase 1 | Visual Grading Agent (Gemini VLM) | ✅ complete, live-tested |
| Phase 2 | Hybrid grading answer-merge | 🔵 stub wired, merge TODO |
| Phase 3 | Geo-routing (XGBoost + hard gates) | ✅ complete, API live |
| Phase 3b | Udupi tier-3 multi-region | ✅ complete |
| Phase 4 | Product Health Card (standalone) | ⚪ not built as separate module |
| Phase 5 | P2P Resale Exchange | ✅ complete, API live |
| Phase 6 | Unified backend (one app/port/db) | ✅ complete |
| Phase 7 | React frontend + UX (catalog ref, hold-at-RCC, intercept, animated map) | ✅ complete |

Health Card is built inside Phase 5 — `backend/p2p/listing.py::build_health_card()` assembles
it at listing creation time, which is the natural moment when all data is available.

> **Phase 6 (packaging):** grading, routing, and P2P run inside ONE FastAPI backend on a single
> port (`:8000`) backed by one SQLite database (`backend/data/relay.db`). The three domains stay
> self-contained sub-packages under `backend/`; see `backend/README.md`.
>
> **Phase 7 (frontend + UX):** the primary UI is the React app `frontend_react/` (Vite, Tailwind,
> framer-motion, Leaflet). Added: ASIN→catalog reference image (auto-supplied to grading and
> shown on cards), a map pickup-location picker with the RCC/FC/station network marked + region
> auto-detect, the **hold-at-RCC** flow (an A/B item with no buyer waits for the 1–2 day window;
> "skip 2 days" → FC storage, or pick a buyer → a **dynamic intercept-vs-FC decision** from real
> distances), an animated route-draw map, P2P "thinking" pacing, and a real `/metrics` dashboard.

---

## The tier-3 impact story — Udupi

The routing logic is most powerful where the FC is far. Udupi is a coastal tier-3 town with
**no Amazon FC on the Karnataka coast** — the nearest is the Bengaluru cluster, **448 km over
the Western Ghats** (Shiradi Ghats, NH 169 + NH 75). Low-volume niche FBA items that aren't
pre-stocked regionally take **7-9 days** to reach Udupi, creating a matching window in which
a second order for the same item can arrive.

In this region, local intercept deletes **both** the 448 km inbound haul **and** the 448 km
fresh-unit reship. On a ₹400 niche shoe: **₹59.82/item saved, 1.58 kg CO₂ avoided** —
versus ~₹15/item in Bengaluru where the FC is only 22 km away.

Udupi has no dedicated RCCs. Instead, local last-mile delivery stations (courier franchisees,
India Post hubs, kirana-linked pickup points) double as mini-RCC + 1-2 day holding buffer +
intercept-delivery launch point — a simpler, leaner topology than a metro.

---

## Phase 1 — The Condition Grading Agent

The first and most critical stage. Two paths, auto-selected from product category:

### Visual path (the hero)
For products where **condition equals what you can see** — shoes, clothing, bags, watches.
The agent is given reference photos (catalog) and inspection photos (captured by the delivery
rider), and grades **real damage on the returned item** — using the reference only as design
context for what the product should look like.

What the agent prioritises (learned from real test cases):
1. **Functional / closure components first** — zippers/chains, buckles, straps, seams.
   A broken zipper blocks resale even if the item looks spotless.
2. **Surface marks, stains, uneven/localised fading** — compared within the returned item
   itself, not against the catalog colour.

### Functional path (stub)
For products where a photo is useless — chargers, speakers, power banks. Graded by rule
from 2–3 yes/no answers. Structure wired; hero demo is the visual path.

### Important MVP simplification
In this MVP the user uploads reference photos manually. In production, the reference is
auto-pulled from the Amazon catalog via the order-history SKU — the grading approach is
unchanged, only the source of the reference image differs.

### Reference = design context only
Catalog-vs-phone differences in colour, angle, lighting, background are **never** defects.
The agent grades damage on the returned unit itself.

---

## Phase 3 — Geo-Routing Agent

Takes a graded item and decides the best outcome using **logistics arbitrage framing**:
every return is treated as a NEW unit at full `original_price`. There is no age depreciation
in routing — the decision is purely economic:

> "Is intercepting this return locally cheaper/greener than hauling it to the FC AND
> shipping a fresh unit FROM the FC back to the same nearby buyer?"

### Decision pipeline
1. Hard economic gates (deterministic, auditable) — fire before any ML
2. XGBoost 4-class classifier (13 features, trained on 8000-row synthetic dataset)
3. Rule fallback if no `.pkl` present (API still works fully)
4. Gemini explainer — one call for a human-readable narrative, never affects the decision

### Output schema
```json
{ "decision": "RESELL_LOCAL", "decided_by": "hard_gate",
  "scores": {...}, "geography": {...}, "economics": {...} }
```

---

## Phase 5 — P2P Resale Exchange

A separate proactive module for items the customer still owns (not returned) that are
approaching end of useful life. The flow:

### Time trigger
The system monitors purchase history. When `today − purchase_date` enters the category's
resale window (e.g. baby_monitor: 1.5–3.0 years), a nudge notification fires automatically.

### Two-stage pricing
**Stage 1 (pre-grade):** conservative estimate assuming Grade C condition.
```
pre_grade_price = original_price × age_factor × 0.40
```
Shown in the nudge to motivate the resale action.

**Stage 2 (post-grade):** actual condition from the grading agent.
```
post_grade_price = original_price × age_factor × CONDITION_MULTIPLIER[grade]
```
Because Stage 1 assumed C (0.40), grading to A (0.85) or B (0.65) **structurally raises**
the price — this is a mechanical guarantee, not a marketing claim.

**Warranty bonus:** each remaining transferable warranty year adds 2% of original_price.

### Lifespan table
22 categories are covered, aligned to the grading API's 19 categories plus 3 extras
(baby_monitor, smartphone, backpack). Each has `(min_years, max_years, avg_years)` tuned to
market resale behaviour (e.g. cable: 0.5–2.0 yr; watch: 4.0–8.0 yr; book: 5.0–20.0 yr).

### Same-town handoff
P2P demand is matched within a 12 km radius of the seller's local delivery station — no
cross-region shipping. The handoff is: seller → station → buyer, using a delivery motorbike.

### Health Card
Built at listing creation time. Synthesises grade, condition score, defects, warranty,
original bill trust anchor, age, and price breakdown into a buyer-facing card.

### Pricing separation (load-bearing constraint)
- **Routing** = item is NEW, `original_price`, zero depreciation. Logistics arbitrage only.
- **P2P** = item is USED. `original_price × age_factor × CONDITION_MULTIPLIER[grade]`.
  P2P (`backend/p2p/pricing.py`) is the **only** place age + condition depreciation lives.
  Routing and P2P never import each other.

---

## Output contract (uniform across all grading paths)

Regardless of visual / functional / hybrid, the grade is emitted as the **same strict JSON**
(see `skills/grading_skill.yaml` and `backend/grading/schemas.py`) so the downstream router
never has to care which path was used.
