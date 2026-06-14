// api.js — the single source of backend calls. Shapes verified against the backend domain routers.
export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// toast() is injected by the store so api errors surface in the UI.
let _toast = () => {};
export function setToast(fn) { _toast = fn; }

export const fmt = {
  inr(n) { return n == null || isNaN(n) ? "—" : "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 }); },
  inr2(n) { return n == null || isNaN(n) ? "—" : "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  kg(n) { return n == null || isNaN(n) ? "—" : Number(n).toFixed(2) + " kg"; },
  km(n) { return n == null || isNaN(n) ? "—" : Number(n).toFixed(1) + " km"; },
};

async function call(path, opts = {}) {
  try {
    const res = await fetch(BASE_URL + path, opts);
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
    if (!res.ok) {
      _toast(`API ${path}: ${(data && (data.detail || data.error)) || "HTTP " + res.status}`, "err");
      return { _httpError: res.status, ...data };
    }
    return data;
  } catch (e) {
    _toast(`Cannot reach backend at ${BASE_URL}. Is it running? (uvicorn backend.main:app)`, "err", 6000);
    return { _networkError: String(e) };
  }
}

const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  BASE_URL,
  health: () => call("/health"),
  metrics: () => call("/metrics"),
  catalogImageUrl: (asin) => BASE_URL + "/catalog/image/" + encodeURIComponent(asin || ""),

  // grading — files.inspection: File[]; asin auto-loads the catalog reference
  grade(category, files, asin = "") {
    const fd = new FormData();
    fd.append("category", category);
    if (asin) fd.append("asin", asin);
    (files.reference || []).forEach((f) => fd.append("reference_images", f));
    (files.inspection || []).forEach((f) => fd.append("inspection_images", f));
    return call("/grade", { method: "POST", body: fd });
  },
  gradeFunctional: (category, answers) => call("/grade/functional", json({ category, answers })),

  // routing
  route: (grade_json, order_meta) => call("/route", json({ grade_json, order_meta })),
  gradeAndRoute: (order_meta, grade_json) => call("/grade-and-route", json({ order_meta, grade_json })),
  routeIntercept: (body) => call("/route/intercept", json(body)), // held unit + explicit buyer → intercept vs FC

  // p2p
  purchases: () => call("/p2p/purchases"),
  nudge: (id, sy) => call(`/p2p/nudge/${id}` + (sy != null ? `?simulate_years=${sy}` : "")),
  list: (purchase_id, grade, condition_score, defects, simulate_years) =>
    call("/p2p/list", json({ purchase_id, grade, condition_score, defects, simulate_years })),
  getListing: (id) => call(`/p2p/listing/${id}`),
  demandFind: (listing_id) => call("/p2p/demand/find", json({ listing_id })),
  demandGenerate: (listing_id) => call("/p2p/demand/generate", json({ listing_id })),
  handoff: (p) => call("/p2p/handoff", json(p)),
};
