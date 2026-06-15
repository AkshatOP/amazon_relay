# Relay HUB — Frontend (Vite + React)

Mobile-first React app for the unified backend (`:8000`). Replaces the vanilla
`frontend_app/` (kept as a fallback). Same design tokens, same backend wiring, plus
**framer-motion** transitions and a component architecture that's easy to extend.

## Run

```bash
# 1. Backend (repo root)
python -m backend.seed.seed_all
uvicorn backend.main:app --reload          # :8000

# 2. Frontend
cd frontend_react
npm install
npm run dev                                 # → http://localhost:5173
```

Backend URL is resolved per-environment in `lib/api.js` (`resolveBaseUrl`): `VITE_API_URL` wins,
else `localhost`/`127.0.0.1` → `http://localhost:8000`, else the deployed Railway backend (https,
so no mixed-content on Vercel). Override locally with a `.env`: `VITE_API_URL=http://localhost:8000`.

## Stack
- **Vite + React 18** — fast HMR, component model.
- **Tailwind 3** — the exact Stitch design tokens live in `tailwind.config.js`.
- **framer-motion** — screen transitions, drawer slide, toast/badge animations. Add more
  by wrapping elements in `<motion.*>` — the foundation is in place.
- **Leaflet** — real map with OSRM road geometry (`src/screens/MapScreen.jsx`).
- Icons: Google **Material Symbols** (font, via `index.html`) through `<Icon name=…/>`.
  To switch to `lucide-react`: `npm i lucide-react` and swap the `Icon` component.

## Structure

```
src/
├── main.jsx                # entry → <AppProvider><App/>
├── App.jsx                 # screen switch with AnimatePresence
├── store.jsx               # React context: screen nav, order, grade, route, p2p, toasts
├── index.css               # tailwind + keyframes + leaflet css
├── lib/
│   ├── api.js              # BASE_URL + ALL fetch wrappers + fmt (₹/kg/km)
│   └── coords.js           # node lat/lng lookup (route gives names, not coords)
├── components/
│   ├── ui.jsx              # Icon, Gauge, GradeBadge, DefectChips, TerminalLog, ProductImg, Spinner
│   ├── HealthCard.jsx      # shared Product Health Card (same visual the grader + P2P produce)
│   ├── CameraModal.jsx     # shared getUserMedia capture (device picker)
│   ├── LocationPicker.jsx  # full-screen map picker — RCC/FC/station markers + legend + region detect
│   ├── Thinking.jsx        # animated "thinking" checklist + useThinking() pacing hook
│   └── Shell.jsx           # top bar, animated drawer, bottom nav, toaster
└── screens/
    ├── Orders.jsx · ReturnFlow.jsx · Rider.jsx · MapScreen.jsx
    └── P2PNudge.jsx · P2PGrade.jsx · P2PHandoff.jsx · Hub.jsx · Shop.jsx
```

## Screen → endpoint map

| Screen | Calls |
|--------|-------|
| Hub | `GET /metrics`, `GET /health` |
| Orders | static order; **"Change on map"** → LocationPicker → sets pickup lat/lng + region |
| Return | static (category branch) |
| **Rider** (hero) | `POST /grade` (multi-photo + `asin`) → `POST /route`; if A/B + no buyer → **hold-at-RCC** with "Skip 2 days" (FC) or "Customer" → `POST /route/intercept` |
| Map | uses route result; animated draw with OSRM road geometry (pickup→RCC→FC, or pickup→RCC→buyer for an intercept); savings tiles incl. a **Time saved** estimate in days |
| P2P Nudge | `GET /p2p/purchases`, `GET /p2p/nudge/{id}`; **"List as-is"** skips grading → `POST /p2p/list` (Grade C = the Stage-1 estimate) → Handoff |
| P2P Grade | `POST /grade` (Front / Back / Defected-part slots — front+back required, up to 5 photos) → `POST /p2p/list` |
| P2P Handoff | `POST /p2p/demand/generate` → `/find` → `POST /p2p/handoff` |
| **Shop (buyer)** | static store list; the second-life card's photo/icon track the actual listed unit (`p2p.purchase.asin`), tagged **Previously Owned**. Health Card from cached `state.p2p.listing.health_card` if present, else a seeded demo card. Renders via the shared `<HealthCard/>`. |

## Notes
- **Photo capture**: Rider — drag-drop + file picker + live camera (up to 4). P2P Grade — three
  labelled slots (**Front** + **Back** mandatory, **Defected part** optional) plus an "Upload photos"
  multi-picker and live camera, **max 5** total; all filled slots sent to `/grade` together.
- **Skip grading**: from the P2P Nudge result, "List as-is at this price" lists at the Stage-1
  (Grade C) estimate and jumps straight to the demand/handoff flow — no photos required.
- **Time saved (Map)**: alongside CO₂ + FC-haul-avoided, a days-saved estimate — standard
  return→replacement (FC round-trip + reship + ~5d handling) vs local-resale handoff (~2d), transit
  at 60 km/h (~540 km/day). Breakdown in the "How we calculated this" panel.
- Top-bar **search icon removed** (every screen); the Rider routing banner shows an
  "Item return data logged to Amazon DB" capsule instead of the raw decision source.
- **Catalog reference**: auto-loaded server-side by `asin`; the UI also shows it on product cards
  via `GET /catalog/image/{asin}` (`<ProductImg>` falls back to an icon on 404).
- **Location picker**: marks the whole network (Udupi stations teal, BLR RCCs blue, FCs red) with
  a legend; detects the region from the dropped pin so routing uses the genuinely-nearest RCC.
- **Hold-at-RCC + intercept**: a resale-eligible item with no DB buyer is held; the buyer location
  (chosen on the map) drives `/route/intercept`'s dynamic intercept-vs-FC decision.
- **Map**: bold solid OSRM road paths drawn in sequence (focus local → draw → fly out → draw FC);
  shows savings cards only when a local intercept saved money, else a "Normal route followed" panel.
- **P2P pacing**: `useThinking()` shows an animated checklist with a minimum dwell before results.
- Build for production: `npm run build` → `dist/`. (Don't build after every edit — build once at the end.)
