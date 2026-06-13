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

## ⚪ Phase 4 — Trust Layer & Matching
- [ ] Product Health Card generation
- [ ] Nearby-buyer matching (full UI integration)

## Progress: Phases 1 and 3 complete, framing corrected (~70% of MVP scope).
Phase 1: visual grading agent (live-tested). Phase 3: geo-routing API on :8100 with corrected
logistics-arbitrage framing (returns = new units, full-path cost includes reship leg, no
age/depreciation). Hard gates work. XGBoost needs one retrain on the new training_data.csv.
Phase 2 hybrid answer-merge and Phase 4 remain.
