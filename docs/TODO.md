# Relay HUB — Build Tracker

## ✅ Phase 0 — Scaffold & Context   [STATUS: done]
- [x] Repo structure, requirements.txt, .env.example, README
- [x] CONTEXT.md (problem statement + solution)
- [x] ARCHITECTURE.md
- [x] .agents specs

## ✅ Phase 1 — Visual Grading Agent (DONE, live-tested)
- [x] grading_skill.yaml written
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

### ✅ Functional grading upgrade (DONE)
Functional grading upgraded — weighted, category-aware, strict resale, optional description merge:
- [x] `schemas.py` — `FUNCTIONAL_CHECK_DEFINITIONS` registry with per-check weights (3 critical/
      primary/safety · 2 important · 1 minor); first check is the PRIMARY (always w3) → fail = D.
      11 categories incl. new **smartphone** (with a weight-3 "screen/body free of cracks" check
      as #2 so a working-but-cracked phone is blocked). power_bank LED raised 1→2.
      Backward-compat `FUNCTIONAL_CHECKS`/`DEFAULT_CHECKS` derived; `get_checks`/`get_definitions`
      helpers; `description` field added to `FunctionalGradeRequest`.
- [x] `functional_grader.py` — weighted_ratio scoring + strict resale rules (any w2/w3 fail →
      C not-resale; primary fail or ratio<0.55 → D; only w1 fail → B; all pass → A). Per-check
      named defects `FAILED (wN): …`, dynamic confidence. Optional description path uses the
      CENTRAL gemini-2.5-flash client (no hardcoded model) with FULL context (category + checklist
      + answers + rule grade + description) and MERGES (more conservative grade wins, defects
      unioned, confidence averaged); never throws → falls back to the rule grade.
- [x] `category_map.py` — `"smartphone": "functional"` (NOT "phone").
- [x] `router.py` — `GET /grade/functional/checks?category=`; POST passes `description`, echoes `checks`.
- [x] `frontend/index.html` — functional section rebuilt in the file's style: 11-category dropdown
      (smartphone value), embedded checks matching the backend label-for-label, Yes/No toggles,
      ★ CRITICAL badge, neutral unanswered state, description textarea, Reset, shared `renderSummary`.

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

## ✅ Catalog auto-reference (ASIN → reference image) — DONE
- [x] `catalog` table (seed: `backend/seed/seed_catalog.py`, run via `seed_all`) maps ASIN →
      `reference_image_path` (a file under `backend/catalog_images/<asin>.jpg`, or an https URL).
- [x] `backend/grading/catalog.py::reference_paths_for(asin)` resolves it (downloads URLs;
      returns [] if the file is missing → grading runs reference-less, never errors).
- [x] `POST /grade` accepts an optional `asin` form field; auto-loads the catalog reference when
      no reference image is uploaded. Response adds `reference_source` = uploaded|catalog|none.
- [x] Frontend rider + p2p screens pass the ASIN automatically → rider only sends inspection photos.
- [x] `backend/catalog_images/` holds the studio photos (gitignored except README + .gitkeep).

### FUTURE WORK (intentionally deferred — to do when we work on this properly)
The reference image is currently used as **design context** for the VLM, NOT a pixel-diff /
similarity target (a studio shot vs a phone photo always differ in lighting/angle/background;
`skills/grading_skill.yaml` already says those differences are not defects). When refined:
multi-angle references, exact-SKU colourway matching, background masking, and possibly a
structured "expected parts present?" check derived from the reference. See
`backend/grading/catalog.py` docstring.

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

## ✅ Phase 6 — Backend consolidation (DONE)
Merged the three independent apps (grading :8000, routing :8100, p2p :8200) into ONE FastAPI
backend on a single port (:8000), one SQLite db, one shared config/Gemini loader — without
rewriting any business logic. Verified: identical numbers to the pre-merge services.

What moved / changed:
- Old top-level `backend/` (grading) → `backend/grading/`. `routing/` → `backend/routing/`.
  `p2p/` → `backend/p2p/`. The old top-level `routing/` and `p2p/` dirs are deleted.
- NEW `backend/core/`: `config.py` (one .env loader: GEMINI_API_KEY/MODEL, DB_PATH, paths),
  `gemini.py` (one Gemini client/key loader — grading + routing explainer reuse it),
  `db.py` (one `get_connection()` → `backend/data/relay.db`).
- NEW `backend/main.py`: single FastAPI app; `include_router()` for 3 thin domain routers
  (`<domain>/router.py`); aggregate `GET /health`; serves grading UI at `/`.
- Routing's decision logic `routing/router.py` → `backend/routing/router_logic.py` (renamed so
  the API "router" name is free). `routing/route_api.py` + `p2p/p2p_api.py` → thin
  `backend/routing/router.py` + `backend/p2p/router.py` (prefix `/p2p`).
- ONE db `backend/data/relay.db` (was `routing/db/relay_routing.db` + `p2p/db/relay_p2p.db`).
  Seeders moved to `backend/seed/{seed_routing,seed_p2p,seed_all}.py` + `backend/seed/README.md`.
- Killed the HTTP hop: `/grade-and-route` no longer proxies to a separate grading service.
- Scoped configs kept per domain; only shared infra moved to core. Domains never import each
  other (module-boundary rules written in `backend/README.md` + `CLAUDE.md`).
- Demo UIs: base URLs updated to `:8000` (routing) and `:8000/p2p` (p2p); grading UI relative.
- `.gitignore` → `backend/data/*.db` + `backend/routing/model/*`. `requirements.txt` httpx note
  updated (now OSRM-only). Model NOT retrained; `.pkl` moved and loads fine.

New run/seed commands:
```
python -m backend.seed.seed_all      # build backend/data/relay.db
uvicorn backend.main:app --reload    # one port; /docs has all 12 endpoints
```

## ✅ Phase 7 — React frontend + UX + backend extensions (DONE)
Backend additions:
- [x] `GET /metrics` (app-level) — lifetime CO₂/₹ saved, returns routed, decision breakdown,
      active listings, from `returns_log` + `listings`. (Fixed `_log_decision` to write `savings_inr`.)
- [x] `GET /catalog/image/{asin}` + `catalog` table + `seed_catalog.py` + `backend/catalog_images/`.
      `POST /grade` accepts optional `asin` → auto-loads the catalog reference; resp adds
      `reference_source` (uploaded|catalog|none). Missing file → grades reference-less.
      `backend/grading/catalog.py` resolves local files / downloads https URLs.
- [x] `POST /route/intercept` + `router_logic.intercept_decision()` — held resale-eligible unit
      + explicit buyer location → dynamic intercept-vs-FC decision from real road distances
      (savings>0 → RESELL_LOCAL, else SHIP_TO_FC).
- [x] `/p2p/handoff` re-adds `co2` + `green_credits` (CO₂ saved vs a fresh-unit FC haul).

Frontend (`frontend_react/` — Vite + React 18 + Tailwind + framer-motion + Leaflet; primary UI):
- [x] Full port of all 8 screens with the exact Stitch tokens; one shell, animated transitions.
- [x] Photo capture: drag-drop + file picker + live camera (getUserMedia) — Rider up to 4, P2P 1–5,
      all sent to `/grade`; ASIN drives the auto catalog reference; catalog photo shown on cards.
- [x] Map pickup-location picker — RCC + FC + delivery-station markers, legend, region auto-detect
      from the dropped pin (so the nearest RCC is genuinely nearest, not fixed to Udupi).
- [x] Hold-at-RCC flow on the Rider screen: A/B + no buyer → HOLD; "Skip 2 days" → FC storage;
      "Customer" → pick buyer on map → `/route/intercept` → reroute-to-buyer or ship-to-FC.
- [x] Animated route-draw map: focus local → draw pickup→RCC → fly out → draw RCC→FC (slow,
      real OSRM road geometry, bold solid lines); intercept case draws pickup→RCC→buyer.
- [x] Context-aware map metrics: savings cards when a local intercept saved money, else a
      "Normal route followed" panel (no misleading ₹0.00).
- [x] P2P "thinking" pacing (animated checklist + min dwell) before each step's result.
- [x] P2P Grade photo UX: three labelled slots (Front/Back mandatory, Defected-part optional) +
      "Upload photos" multi-picker + live camera, capped at 5 photos.
- [x] P2P Nudge "List as-is" — skip grading, list at the Stage-1 (Grade C) estimate, jump straight
      to the demand/handoff flow.
- [x] Map "Time saved" tile (days): standard return→replacement (FC round-trip + reship + ~5d FC
      handling) vs local-resale handoff (~2d), transit at 60 km/h (~540 km/day); shown with a breakdown.
- [x] UX polish: Shop second-life card photo tracks the listed unit's ASIN ("Previously Owned" tag);
      removed the top-bar search icon on every screen; Rider banner shows an "Item return data logged
      to Amazon DB" capsule.
- [x] Hub reads real `/metrics`. (Legacy `frontend_app/`, `frontend_routing/`, `frontend_p2p/`
      demos removed in cleanup; `frontend/` kept — the static grading + functional-checklist page served at `/`.)

## Progress: Phases 1, 3, 3b, 5, 6, and 7 complete (~90% of MVP scope).
Phase 1: visual grading agent (live-tested). Phase 3/3b: geo-routing with logistics-arbitrage
framing, two regions, hold-at-RCC + dynamic intercept. Phase 5: P2P resale exchange. Phase 6:
unified backend on :8000 (one db + one Gemini loader). Phase 7: React frontend + catalog
auto-reference + `/metrics` + animated map + location picker. Hard gates work; XGBoost loads.
Phase 2 hybrid answer-merge and Phase 4 (standalone Health Card) remain.
