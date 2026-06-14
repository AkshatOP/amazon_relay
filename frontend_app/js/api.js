/* api.js — the ONE place that talks to the backend.
   Every screen calls App.api.*; nothing else issues fetches. */
(function () {
  "use strict";

  // Configurable at the top. The unified backend (Phase 6) serves everything on :8000.
  const BASE_URL = "http://localhost:8000";

  window.App = window.App || {};

  // ---- toast -------------------------------------------------------------
  function toast(message, kind = "info", ms = 3200) {
    const host = document.getElementById("toast-host");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "toast " + (kind || "info");
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, ms);
  }

  // ---- formatting --------------------------------------------------------
  const fmt = {
    inr(n) { if (n == null || isNaN(n)) return "—"; return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 }); },
    inr2(n) { if (n == null || isNaN(n)) return "—"; return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    kg(n) { if (n == null || isNaN(n)) return "—"; return Number(n).toFixed(2) + " kg"; },
    km(n) { if (n == null || isNaN(n)) return "—"; return Number(n).toFixed(1) + " km"; },
  };

  // ---- core fetch wrapper (never silent; never throws past the caller) ---
  async function call(path, opts = {}) {
    const url = BASE_URL + path;
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { _raw: text }; }
      if (!res.ok) {
        const msg = (data && (data.detail || data.error)) || `HTTP ${res.status}`;
        toast(`API ${path}: ${msg}`, "err");
        return { _httpError: res.status, ...data };
      }
      return data;
    } catch (e) {
      toast(`Cannot reach backend at ${BASE_URL}. Is it running? (uvicorn backend.main:app)`, "err", 6000);
      return { _networkError: String(e) };
    }
  }

  const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // ---- typed wrappers (shapes verified against backend/*/router.py) ------
  const api = {
    BASE_URL,
    health: () => call("/health"),

    // grading
    // files: { reference: File[], inspection: File[] }
    grade(category, files) {
      const fd = new FormData();
      fd.append("category", category);
      (files.reference || []).forEach((f) => fd.append("reference_images", f));
      (files.inspection || []).forEach((f) => fd.append("inspection_images", f));
      return call("/grade", { method: "POST", body: fd });
    },
    gradeFunctional: (category, answers) => call("/grade/functional", json({ category, answers })),

    // routing
    route: (grade_json, order_meta) => call("/route", json({ grade_json, order_meta })),
    gradeAndRoute: (order_meta, grade_json) => call("/grade-and-route", json({ order_meta, grade_json })),

    // p2p
    purchases: () => call("/p2p/purchases"),
    nudge: (purchaseId, simulateYears) =>
      call(`/p2p/nudge/${purchaseId}` + (simulateYears != null ? `?simulate_years=${simulateYears}` : "")),
    list: (purchase_id, grade, condition_score, defects, simulate_years) =>
      call("/p2p/list", json({ purchase_id, grade, condition_score, defects, simulate_years })),
    getListing: (id) => call(`/p2p/listing/${id}`),
    demandFind: (listing_id) => call("/p2p/demand/find", json({ listing_id })),
    demandGenerate: (listing_id) => call("/p2p/demand/generate", json({ listing_id })),
    handoff: (p) => call("/p2p/handoff", json(p)),
  };

  App.api = api;
  App.toast = toast;
  App.fmt = fmt;
})();
