# Amazon Relay — Frontend App

One mobile-first web app (vanilla JS + Tailwind CDN + Leaflet) that wires the Stitch screens to
the **live unified backend on `:8000`**. Every on-screen number comes from a real API response,
not a mockup placeholder.

## Run

```bash
# 1. Backend (from repo root)
python -m backend.seed.seed_all
uvicorn backend.main:app --reload            # :8000

# 2. Frontend (separate terminal, from repo root)
python -m http.server 5173 --directory frontend_app
#    → open http://localhost:5173
```

`BASE_URL` is set once at the top of `js/api.js` (`http://localhost:8000`). CORS is open on the
backend, so serving the frontend on another port works out of the box.

## Structure

```
frontend_app/
├── index.html          # single shell: top bar, drawer, 8 screen <section>s, bottom nav, tailwind config
├── css/app.css         # shared tokens-adjacent CSS: animations, toast, gauge, leaflet sizing
└── js/
    ├── api.js          # BASE_URL + ALL fetch wrappers + toast + ₹/kg/km formatters
    ├── state.js        # shared state (order, lastGrade, lastRoute, p2p.*) + node coord lookup
    ├── router.js       # screen switching, drawer, bottom nav, init (loaded last)
    └── screens/
        ├── orders.js   # screen 1 (order) + 2 (branched return) + App.ui shared components
        ├── rider.js    # screen 3 (HERO): photos → /grade → /route → HOLD/SHIP banner
        ├── map.js      # screen 4: real Leaflet map from route geography + economics
        ├── p2p.js      # screens 5–7: nudge → grade+health card → demand → handoff
        └── hub.js      # screen 8: dashboard
```

Scripts are classic (non-module) and load in order; everything hangs off `window.App`
(`App.api`, `App.state`, `App.ui`, `App.router`, `App.screens.*`).

## Which endpoint each screen calls

| Screen | Trigger | API call | Live numbers rendered |
|--------|---------|----------|------------------------|
| 1 Order | open | — | static demo order (the seeded niche shoe) |
| 2 Return | category branch | — (optional `/grade/functional`) | — |
| **3 Rider** | Run AI Grading | **POST `/grade`** (multipart; falls back to `/grade/functional` if no photo) | score gauge, grade badge, defects, reasoning |
| **3 Rider** | auto after grade | **POST `/route`** | decision (HOLD/SHIP), `nearest_rcc`, savings, CO₂, fc_distance |
| **4 Map** | Confirm Drop-off | uses `lastRoute` | Leaflet pins (customer/station/FC), green + red lines, ₹ saved / CO₂ / FC-haul km, per-leg cost breakdown |
| 5 Nudge | Simulate N years | GET `/p2p/purchases`, GET `/p2p/nudge/{id}?simulate_years=` | Stage-1 price, resale-window message |
| 6 Grade | Grade & reveal | POST `/grade` (or `/grade/functional`) → POST `/p2p/list` | Stage-2 price (▲ vs Stage-1), Health Card (warranty, bill, defects, breakdown) |
| 7 Handoff | Simulate demand → Confirm | POST `/p2p/demand/generate` → `/find` → POST `/p2p/handoff` | buyer + real distance, total km, platform fee, seller payout |
| 8 Hub | open | GET `/health` | backend status; sustainability/listings are **placeholders** (no endpoint) |

## Exact demo click-path (hero first)

1. **Hub** → tap the "DEMO ENTRY" card → **Order** (seeded niche shoe, ₹400, Udupi).
2. **Order** → "Return this product" → **Return** → "Confirm Return" → **Rider**.
3. **Rider** → (optionally add a photo) → **Run AI Grading**
   → `POST /grade` renders the real grade/score/defects + reasoning terminal
   → auto `POST /route` renders **HOLD — local resale · Drop at: Udupi City (Service Bus Stand)**
     with real **₹59.82 saved**, **CO₂ saved**, **FC haul 448.54 km**.
4. **Rider** → "Confirm Drop-off" → **Map**: Leaflet shows the tiny local hop (green) vs the
   avoided 448 km FC haul (red dashed), with the real economics in the glass pane.
5. **P2P Nudge** (drawer → "P2P resale") → set "Simulate years" = 3 → **Simulate**
   → `GET /p2p/nudge` shows the real Stage-1 estimate (₹1,680 at 3 yr).
6. → "Scan to grade for a higher price" → **P2P Grade** → "Grade & reveal Stage-2 price"
   → `/grade(/functional)` + `POST /p2p/list` → Stage-2 **₹2,580 ▲** + Product Health Card.
7. → "List it" → **P2P Handoff** → "Simulate nearby demand"
   → `/p2p/demand/generate` + `/find` → "Match found · Ravi Nayak · 7.0 km"
   → "Confirm Handoff" → `POST /p2p/handoff` → real total km + platform fee + **seller payout**.

> The hero scenario uses the seeded niche **shoe** (the only item with a seeded nearby buyer),
> so `/route` genuinely returns `RESELL_LOCAL`. Other categories (e.g. headphones) honestly
> route to `REFURBISH` (no local buyer seeded) — the banner reflects that real decision.

## Backend fields the UI wanted but couldn't find ( `// TODO: backend field` )

1. **`/p2p/handoff` — `co2_saved_kg` + `green_credits`.** The Stitch handoff mock showed
   "+500 green credits" and CO₂ avoided, but the backend handoff response only returns
   `legs{pickup_km,drop_km,total_km}` + `financials{asking_price,platform_fee,seller_payout}`
   (green credits were removed). The UI shows the real payout and marks the gap in `p2p.js`.
2. **Lifetime sustainability total + active-listing count (Hub).** No aggregate endpoint
   (e.g. `GET /metrics`) exists, so the Hub shows a labelled placeholder rather than a fake
   number. Active-listing count reflects only listings created in the current session.
3. **Node lat/lng in `/route` geography.** The route response gives node *names/codes*
   (`nearest_rcc`, `nearest_fc`) but not coordinates, so the map resolves them via a small
   static lookup in `state.js` (`coordFor`) mirroring `backend/routing/seed_locations.py`.
   A `geography.*_latlng` field would remove that lookup.
4. **`/grade-and-route` doesn't accept images** (JSON only), so the rider flow calls `/grade`
   (multipart) then `/route` separately rather than the single combined endpoint.

## Robustness

- Every call goes through `App.api.call()` → friendly error toast on HTTP/network failure,
  never a silent fail or frozen spinner.
- A `grade:"ERROR"` response shows a graceful toast and doesn't advance the flow.
- Async buttons show a spinner; the slow Gemini `/grade` call won't look broken.
- Numbers are formatted (₹ with separators, kg/km to decimals).
