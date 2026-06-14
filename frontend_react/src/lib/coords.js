/* Static node-coordinate lookup (demo convenience) — the /route response gives node
   names/codes but not lat/lng. Mirrors backend/routing/seed_locations.py. */
export const COORDS = {
  "Udupi City (Service Bus Stand)": [13.3409, 74.7421],
  "Manipal": [13.3490, 74.7869], "Malpe": [13.3494, 74.7039],
  "Kundapura": [13.6260, 74.6920], "Karkala": [13.2160, 74.9930], "Brahmavar": [13.4280, 74.7460],
  "Mysore Road": [12.9456, 77.5236], "Sahakarnagar": [13.0586, 77.5806],
  "Chickpet": [12.9698, 77.5793], "Bannerghatta Road": [12.8911, 77.5970],
  "BTM 1st Stage": [12.9166, 77.6101], "Indira Nagar": [12.9784, 77.6408],
  "Rajajinagar": [12.9911, 77.5526], "Brigade Road": [12.9719, 77.6076],
  "BLR_CLUSTER": [13.0707, 77.7796], "BLR5": [13.0707, 77.7796],
  "BLR7": [13.0707, 77.7796], "BLR8": [13.2437, 77.7172], "Jigani": [12.7889, 77.6406],
};
export const coordFor = (name) => COORDS[name] || null;

/* Udupi delivery stations (name + pincode + coords) — shown on the location picker so the
   user can see where the network is and pick a pickup point relative to it. Mirrors
   backend/routing/seed_locations.py (the backend still computes the authoritative nearest
   station server-side in /route). */
export const UDUPI_STATIONS = [
  { name: "Udupi City (Service Bus Stand)", pincode: "576101", lat: 13.3409, lng: 74.7421 },
  { name: "Manipal", pincode: "576104", lat: 13.3490, lng: 74.7869 },
  { name: "Malpe", pincode: "576103", lat: 13.3494, lng: 74.7039 },
  { name: "Kundapura", pincode: "576201", lat: 13.6260, lng: 74.6920 },
  { name: "Karkala", pincode: "574104", lat: 13.2160, lng: 74.9930 },
  { name: "Brahmavar", pincode: "576213", lat: 13.4280, lng: 74.7460 },
];

/* Bengaluru RCCs (Remote Consolidation Centers — the metro equivalent of Udupi's local
   delivery stations). Mirrors backend/routing/seed_locations.py + the buyer-consolidation list. */
export const BLR_RCCS = [
  { name: "Mysore Road", pincode: "560026", lat: 12.9456, lng: 77.5236 },
  { name: "Sahakarnagar", pincode: "560092", lat: 13.0586, lng: 77.5806 },
  { name: "Chickpet", pincode: "560053", lat: 12.9698, lng: 77.5793 },
  { name: "Bannerghatta Road", pincode: "560076", lat: 12.8911, lng: 77.5970 },
  { name: "BTM 1st Stage", pincode: "560029", lat: 12.9166, lng: 77.6101 },
  { name: "Indira Nagar", pincode: "560008", lat: 12.9784, lng: 77.6408 },
  { name: "Krishna Community Hall", pincode: "560036", lat: 13.0012, lng: 77.5510 },
  { name: "Rajajinagar", pincode: "560010", lat: 12.9911, lng: 77.5526 },
  { name: "Brigade Road", pincode: "560025", lat: 12.9719, lng: 77.6076 },
];

/* Bengaluru Fulfillment Centers (storage + refurbishing; the haul destination for returns). */
export const FCS = [
  { code: "BLR5", name: "Bommasandra/Hoskote", pincode: "560067", lat: 13.0707, lng: 77.7796 },
  { code: "BLR7", name: "Hoskote", pincode: "560067", lat: 13.0740, lng: 77.7836 },
  { code: "BLR8", name: "Devanahalli", pincode: "562149", lat: 13.2437, lng: 77.7172 },
  { code: "BLR6", name: "Nelamangala", pincode: "562123", lat: 13.0997, lng: 77.3938 },
  { code: "BLR10", name: "Kudlu Gate", pincode: "560068", lat: 12.8896, lng: 77.6470 },
  { code: "Jigani", name: "Jigani/Anekal", pincode: "560105", lat: 12.7889, lng: 77.6406 },
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* Nearest station to a point (client-side preview; ×1.4 ≈ road km). */
export function nearestStation(lat, lng, stations = UDUPI_STATIONS) {
  let best = null;
  for (const s of stations) {
    const dist = haversineKm(lat, lng, s.lat, s.lng);
    if (!best || dist < best.dist) best = { ...s, dist };
  }
  return best;
}

/* Nearest INTAKE node across regions — Udupi delivery stations (region "udupi") and
   Bengaluru RCCs (region "bengaluru"). Used to pick the region for a dropped pin so the
   backend routes to the genuinely-nearest RCC/station instead of a fixed region. */
export function nearestNode(lat, lng) {
  const cands = [
    ...UDUPI_STATIONS.map((s) => ({ ...s, region: "udupi", kind: "station" })),
    ...BLR_RCCS.map((s) => ({ ...s, region: "bengaluru", kind: "rcc" })),
  ];
  let best = null;
  for (const c of cands) {
    const dist = haversineKm(lat, lng, c.lat, c.lng);
    if (!best || dist < best.dist) best = { ...c, dist };
  }
  return best;
}
