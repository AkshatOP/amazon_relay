# Amazon Relay — Build Tracker

## ✅ Phase 0 — Scaffold & Context   [STATUS: done]
- [x] Repo structure, requirements.txt, .env.example, README
- [x] CONTEXT.md (problem statement + solution)
- [x] ARCHITECTURE.md
- [x] .agents specs

## ✅ Phase 1 — Visual Grading Agent (DONE, live-tested)
- [x] grading_skill.md written
- [x] grading_agent.py calling Gemini VLM with reference + inspection images
- [x] schemas.py strict JSON validation + defensive fence-stripping
- [x] POST /grade endpoint working
- [x] Skeletal index.html: dropdown + 2 image containers + JSON output
- [x] Drag-and-drop upload (multiple files) on both image containers
- [x] End-to-end test against real photos (Skybags backpack): broken-zipper unit → C,
      resale_eligible=false, refurbish_recommended=true; clean unit → A. Passed.

### Phase 1 refinements (from real-image testing)
- [x] Reframed skill: reference is **design context only**, not a similarity/delta target —
      colour/angle/lighting/background/colourway differences are explicitly NOT defects
      (fixed the "items are not similar" false negative).
- [x] Functional/closure checks first (zippers/chains, buckles, straps, seams) + hard rule:
      a broken functional part blocks resale even if cosmetically clean.
- [x] Cross-category stains / discolouration / uneven-localised-fading inspection.
- [x] Transient API-error retry with backoff (503/429/timeout) so live demos don't break.

## 🔵 Phase 2 — Functional & Hybrid Paths (CURRENT)
- [x] functional_grader.py rule logic (stub)
- [x] yes/no question UI + /grade/functional
- [ ] hybrid path combining photos + answers (visual half wired; answers-merge TODO)

## ✅ Phase 3 — Geo-Routing Agent (DONE, API live)
- [x] `routing/config.py` — all constants in one place (fuel ₹91/L, vehicle mileage, demand radius)
- [x] `routing/seed_locations.py` — 8 Bengaluru RCCs + 4 FCs with real coordinates
- [x] `routing/geo.py` — haversine + 1.4× road circuity, nearest-RCC/FC lookups
- [x] `routing/economics.py` — amortized per-item fuel+CO2 model; computed donate/liquidate
      boundary (not hardcoded); honest metro-vs-tier3 self-test printed and verified
- [x] `routing/pricing.py` — resale price formula (grade × age depreciation × category)
- [x] `routing/db/seed_db.py` — SQLite with pending_orders (25 rows), ngos (5), returns_log
- [x] `routing/model/generate_training_data.py` — 8000-row synthetic CSV, rule-engine labels
- [x] `routing/model/train_router.py` — XGBoost CLI trainer (user runs this to produce .pkl)
- [x] `routing/router.py` — hard gates + XGBoost + rule_fallback if .pkl absent. Never throws.
- [x] `routing/explainer.py` — single Gemini call for narrative; templated fallback if no key
- [x] `routing/route_api.py` — FastAPI on port 8100: POST /route, POST /grade-and-route, GET /health
- [x] `frontend_routing/index.html` — demo UI on port 5500; shows decision badge, 4-way scores,
      geography, and money-shot "X km local vs 612 km to warehouse" with ₹ + CO2 saved
- [x] End-to-end smoke-test: grade-A backpack → RESELL_LOCAL (hard gate), grade-C watch →
      REFURBISH (hard gate), grade-D book → DONATE (hard gate). All fire correctly.
- [x] **Economic framing corrected**: returns treated as NEW units at full original_price.
      No age/depreciation in routing. Decision is logistics arbitrage: local intercept cost vs
      FC haul + fresh-unit reship. `pricing.py` stubbed and reserved for future P2P product.
      Features dropped: age_months, resale_price, recovery_pct (13 features, was 15).
      Full-path cost now includes FC→buyer reship leg; tier-3 savings = Rs 78.87/item, 2.15 kg CO₂.
- [x] training_data.csv regenerated with corrected framing (8000 rows, new feature set)

**⚠️ Retrain required** — economic framing changed (see below). Old `.pkl` is stale.
Run: `python -m routing.model.generate_training_data && python -m routing.model.train_router`

## ✅ Phase 3b — Udupi tier-3 region (DONE)
- [x] `routing/seed_locations.py` refactored to multi-region dict (bengaluru + udupi).
      Backward-compat RCCS/FCS shims; ACTIVE_REGION="udupi" switches the default.
- [x] Udupi: 6 local delivery stations that double as mini-RCC + holding (no separate RCC).
      External FC = BLR cluster, ~400 km over Ghats. OSRM at runtime; 400 km fallback.
- [x] `routing/geo.py` — region param on all functions; external-FC path for LOCAL_STATION
      regions; road_km_between circuity param; measure_external_fc_osrm() utility.
- [x] `routing/router.py` — region threaded from order_meta; node_type + holding_capacity
      in geography response; tier3_projection suppressed for external-FC regions (real numbers
      shown instead of synthetic 612 km).
- [x] `routing/route_api.py` — optional region field in OrderMeta; unknown-region fallback
      with region_note in response.
- [x] `routing/db/seed_db.py` — region column; Bengaluru (23) + Udupi (15) rows; 5 BLR NGOs
      + 3 Udupi NGOs; two precise demo scenarios (Scenario A: RESELL_LOCAL; Scenario B: DONATE).
- [x] `routing/db/README_udupi_demo.md` — exact UI inputs + expected outputs for both scenarios.
- [x] `frontend_routing/index.html` — region dropdown; Udupi presets; "Local Delivery Station"
      label + holding capacity; Udupi money-shot uses real ~400 km numbers (no synthetic 612 km).
- [x] No features changed → no retrain required. decided_by stays hard_gate/rule_fallback.

## ⚪ Phase 4 — Trust Layer & Matching
- [ ] Product Health Card generation (NOTE: Health Card is built inside Phase 5 P2P — listing.py::build_health_card)
- [ ] Nearby-buyer matching (full UI integration in routing; P2P has its own demand.py)

## ✅ Phase 5 — P2P Resale Exchange (DONE)
- [x] `p2p/config.py` — all P2P constants (vehicles, CO₂ factors, green credit rate, etc.)
- [x] `p2p/lifespan_table.py` — LIFESPAN_YEARS dict + resale_window/in_resale_window/window_position
- [x] `p2p/pricing.py` — two-stage pricing: Stage-1 (age × C=0.40), Stage-2 (age × actual grade).
      Grading A/B STRUCTURALLY raises price (mechanical guarantee, not a promise).
      CONDITION_MULTIPLIER: A=0.85, B=0.65, C=0.40, D=0.15. AGE_VALUE_FLOOR per category.
- [x] `p2p/notifier.py` — build_resale_nudge() with simulate_years demo time-travel
- [x] `p2p/listing.py` — create_listing() + build_health_card() (Phase 4 Health Card built here)
- [x] `p2p/demand.py` — find_nearby_demand() + generate_demand() (synthetic buyer button)
- [x] `p2p/handoff.py` — A→station→B logistics, platform fee, seller payout
- [x] `p2p/db/seed_p2p.py` — users, purchases (₹6000 baby monitor), demand tables; run: python -m p2p.db.seed_p2p
- [x] `p2p/p2p_api.py` — FastAPI on port 8200: /nudge, /list, /listing, /demand/find, /demand/generate, /handoff, /purchases
- [x] `frontend_p2p/index.html` — 4-step demo UI on port 5600
- [x] `p2p/README_p2p_demo.md` — exact click-path + expected numbers

Key numbers (simulate_years=2.0, grade B, warranty 5yr):
  Stage-1 price: ₹6000 × 1.0 × 0.40 + warranty = ₹2,400 + ₹360 = ₹2,760
  Stage-2 price: ₹6000 × 1.0 × 0.65 + warranty = ₹3,900 + ₹360 = ₹4,260 (▲+₹1,500 after grading)
  Seller payout: ₹4,047 (asking ₹4,260 − 5% platform fee ₹213)

## ✅ Phase 5 follow-up — lifespan table aligned to grading API (DONE)
- [x] `p2p/lifespan_table.py` — expanded from 12 to 22 categories. All 20 grading-API
      categories now have explicit `(min, max, avg)` entries. Extras kept: baby_monitor,
      smartphone, backpack.
- [x] `p2p/pricing.py` — AGE_VALUE_FLOOR aligned to match (22 entries).

## Progress: Phases 1, 3, 3b, and 5 complete (~85% of MVP scope).
Phase 1: visual grading agent (live-tested). Phase 3: geo-routing API on :8100 with corrected
logistics-arbitrage framing (returns = new units, full-path cost includes reship leg, no
age/depreciation). Hard gates work. XGBoost needs one retrain on the new training_data.csv.
Phase 2 hybrid answer-merge and Phase 4 remain.
