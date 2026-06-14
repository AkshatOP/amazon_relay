# Amazon Relay — Frontend (Vite + React)

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

Backend URL is `http://localhost:8000` by default; override with a `.env`:
`VITE_API_URL=http://localhost:8000`.

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
│   ├── CameraModal.jsx     # shared getUserMedia capture (device picker)
│   ├── LocationPicker.jsx  # full-screen map picker — RCC/FC/station markers + legend + region detect
│   ├── Thinking.jsx        # animated "thinking" checklist + useThinking() pacing hook
│   └── Shell.jsx           # top bar, animated drawer, bottom nav, toaster
└── screens/
    ├── Orders.jsx · ReturnFlow.jsx · Rider.jsx · MapScreen.jsx
    └── P2PNudge.jsx · P2PGrade.jsx · P2PHandoff.jsx · Hub.jsx
```

## Screen → endpoint map

| Screen | Calls |
|--------|-------|
| Hub | `GET /metrics`, `GET /health` |
| Orders | static order; **"Change on map"** → LocationPicker → sets pickup lat/lng + region |
| Return | static (category branch) |
| **Rider** (hero) | `POST /grade` (multi-photo + `asin`) → `POST /route`; if A/B + no buyer → **hold-at-RCC** with "Skip 2 days" (FC) or "Customer" → `POST /route/intercept` |
| Map | uses route result; animated draw with OSRM road geometry (pickup→RCC→FC, or pickup→RCC→buyer for an intercept) |
| P2P Nudge | `GET /p2p/purchases`, `GET /p2p/nudge/{id}` |
| P2P Grade | `POST /grade` (1–5 photos) → `POST /p2p/list` |
| P2P Handoff | `POST /p2p/demand/generate` → `/find` → `POST /p2p/handoff` |

## Notes
- **Photo capture** (Rider 4, P2P 5): drag-drop + file picker + live camera, all sent to `/grade`.
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
