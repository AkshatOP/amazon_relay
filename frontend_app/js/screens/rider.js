/* rider.js — Screen 3 (Rider Pickup) — THE HERO.
   Real photo upload → POST /grade (multipart) → render GradeResult →
   POST /route → render the real HOLD/SHIP decision banner. */
(function () {
  "use strict";
  const { fmt, ui } = window.App ? { fmt: App.fmt, ui: App.ui } : {};

  const TILES = [
    { key: "front", label: "Front" }, { key: "back", label: "Back" },
    { key: "detail", label: "Detail" }, { key: "damage", label: "Damage" },
  ];
  let files = {}; // key -> File

  function render() {
    files = {};
    const o = App.state.order;
    const host = document.getElementById("screen-rider");
    host.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2"><span class="material-symbols-outlined text-on-surface">electric_scooter</span>
          <h2 class="font-headline-md text-headline-md text-on-surface">Rider Pickup</h2></div>
        <div class="flex items-center gap-1 bg-primary text-on-primary px-2.5 py-1 rounded-full animate-ai-pulse">
          <span class="material-symbols-outlined text-[14px] fill-icon">smart_toy</span>
          <span class="font-label-bold text-label-bold text-[10px]">AI ACTIVE</span></div>
      </div>

      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm flex justify-between items-center">
        <div class="flex gap-3 items-center">
          <div class="w-10 h-10 bg-surface-container rounded-md flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined">${o.category === "shoes" ? "footprint" : "inventory_2"}</span></div>
          <div><div class="font-body-md text-body-md text-on-surface font-medium">${o.product_name}</div>
            <div class="font-label-md text-label-md text-on-surface-variant">#${o.order_id} · ${o.customer_area}</div></div>
        </div>
        <span class="font-label-bold text-label-bold text-amber-action bg-amber-action/10 px-2 py-1 rounded">Collect</span>
      </div>

      <h3 class="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">Required Photos</h3>
      <div class="grid grid-cols-4 gap-2" id="rider-tiles">
        ${TILES.map(tileHTML).join("")}
      </div>
      <p class="font-label-md text-label-md text-on-surface-variant -mt-1">Add ≥1 photo for visual grading. No photo → falls back to a functional checklist grade (still a real API call).</p>

      <button id="btn-grade" class="w-full bg-primary text-on-primary py-3 rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all">
        <span class="material-symbols-outlined">memory</span> Run AI Grading</button>

      <div id="rider-result" class="hidden flex-col gap-stack-lg"></div>`;

    host.querySelectorAll(".tile-input").forEach((inp) => inp.addEventListener("change", onFile));
    document.getElementById("btn-grade").addEventListener("click", runGrading);
  }

  function tileHTML(t) {
    return `<label class="tile bg-surface-container-lowest border border-dashed border-outline rounded-lg aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-surface-container transition-colors relative overflow-hidden" data-key="${t.key}">
      <img class="tile-img absolute inset-0 w-full h-full object-cover hidden"/>
      <span class="material-symbols-outlined text-outline tile-icon">photo_camera</span>
      <span class="font-label-md text-label-md text-on-surface-variant tile-label">${t.label}</span>
      <input type="file" accept="image/*" class="tile-input hidden" data-key="${t.key}"/></label>`;
  }

  function onFile(e) {
    const key = e.target.dataset.key;
    const f = e.target.files[0];
    if (!f) return;
    files[key] = f;
    const tile = e.target.closest(".tile");
    const img = tile.querySelector(".tile-img");
    img.src = URL.createObjectURL(f);
    img.classList.remove("hidden");
    tile.querySelector(".tile-icon").classList.add("hidden");
    tile.classList.add("border-primary");
  }

  async function runGrading() {
    const btn = document.getElementById("btn-grade");
    const orig = btn.innerHTML;
    btn.innerHTML = ui.spinnerBtnHTML("Grading…");
    btn.disabled = true;

    const inspection = Object.values(files);
    const o = App.state.order;
    let grade;
    if (inspection.length > 0) {
      grade = await App.api.grade(o.category, { inspection });
    } else {
      App.toast("No photo — using functional checklist grade", "info");
      grade = await App.api.gradeFunctional(o.category, [true, true, false]);
    }
    btn.innerHTML = orig; btn.disabled = false;

    if (!grade || grade.grade === "ERROR" || grade._networkError || grade._httpError) {
      App.toast(grade && grade.reasoning ? grade.reasoning : "Grading failed — try again", "err", 5000);
      return;
    }
    App.state.lastGrade = grade;
    renderGrade(grade);
    // chain into routing
    await runRoute(grade);
  }

  function renderGrade(g) {
    const box = document.getElementById("rider-result");
    box.classList.remove("hidden"); box.classList.add("flex");
    box.innerHTML = `
      <hr class="border-t border-outline-variant/30"/>
      <section class="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <h3 class="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px] text-success">verified</span> Assessment Complete</h3>
          <span class="font-mono-code text-mono-code text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">${g.path || "visual"} · conf ${(g.confidence||0).toFixed(2)}</span>
        </div>
        <div class="flex items-center gap-6">
          ${ui.gauge(g.score)}
          <div class="flex flex-col gap-2 flex-1">
            <div class="flex items-center gap-2">${ui.gradeBadge(g.grade)}
              <span class="font-body-md text-body-md text-on-surface-variant">${conditionWord(g.grade)}</span></div>
            <div class="flex flex-wrap gap-2 mt-1">${ui.defectChips(g.defects)}</div>
          </div>
        </div>
        <p class="font-body-md text-body-md text-on-surface-variant border-t border-outline-variant/30 pt-3">${g.reasoning || g.notes || ""}</p>
      </section>
      <section class="bg-near-black rounded-xl p-4 shadow-inner" id="rider-terminal"></section>
      <div id="rider-route" class="flex flex-col gap-stack-lg"></div>`;

    const lines = [
      `&gt; analyzing inspection images... <span class="text-success">ok</span>`,
      `&gt; defects detected: ${(g.defects && g.defects.length) || 0}`,
      `&gt; condition score: ${g.score}/10 → grade ${g.grade}`,
      `&gt; resale_eligible=${g.resale_eligible} · refurbish=${g.refurbish_recommended}`,
      `<span class="text-primary-fixed-dim">&gt; handing off to routing engine...</span>`,
    ];
    ui.terminalLog(document.getElementById("rider-terminal"), lines);
  }

  async function runRoute(grade) {
    const o = App.state.order;
    const routeBox = document.getElementById("rider-route");
    routeBox.innerHTML = `<div class="flex items-center gap-2 text-on-surface-variant p-3"><span class="material-symbols-outlined animate-spin">autorenew</span> routing…</div>`;
    const order_meta = {
      order_id: o.order_id, asin: o.asin, product_name: o.product_name, category: o.category,
      original_price: o.original_price, customer_lat: o.customer_lat, customer_lng: o.customer_lng, region: o.region,
    };
    const route = await App.api.route(grade, order_meta);
    if (!route || route._networkError || route._httpError) { routeBox.innerHTML = ""; return; }
    App.state.lastRoute = route;
    renderRoute(route);
  }

  function renderRoute(r) {
    const isHold = r.decision === "RESELL_LOCAL";
    const tag = {
      RESELL_LOCAL: "HOLD — local resale (1–2 days)", REFURBISH: "SHIP TO FC — refurbish",
      DONATE: "ROUTE TO NGO — donate", LIQUIDATE: "ROUTE — liquidate",
    }[r.decision] || r.decision;
    const dest = isHold ? `Drop at: ${r.geography.nearest_rcc}` : `Route to: ${r.geography.nearest_fc} (FC)`;
    const econ = r.economics || {};
    const routeBox = document.getElementById("rider-route");
    routeBox.innerHTML = `
      <section class="rounded-xl p-5 shadow-sm border ${isHold ? "bg-primary-container text-on-primary-container border-primary/20" : "bg-surface-container-high text-on-surface border-outline-variant"} flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="font-headline-sm text-headline-sm font-semibold flex items-center gap-2">
            <span class="material-symbols-outlined">${isHold ? "route" : "local_shipping"}</span> ${dest}</h3>
          <span class="font-mono-code text-mono-code px-2 py-0.5 rounded ${isHold ? "bg-surface/20" : "bg-surface border border-outline-variant"}">${r.decided_by}</span>
        </div>
        <div class="self-start px-3 py-1.5 rounded font-label-bold text-label-bold border ${isHold ? "bg-surface/20 border-on-primary-container/20" : "bg-surface border-outline-variant"} flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-action"></span> ${tag}</div>
        <p class="font-body-md text-body-md opacity-90">${r.reason || r.explanation || ""}</p>
        ${isHold ? `<div class="grid grid-cols-3 gap-2 mt-1">
            ${miniStat("payments","Saved", fmt.inr2(econ.savings_inr))}
            ${miniStat("co2","CO₂ saved", fmt.kg(econ.co2_saved_kg))}
            ${miniStat("route","FC haul", fmt.km(r.geography.fc_distance_km))}
          </div>` : ""}
      </section>
      <button class="w-full bg-amber-action text-near-black font-headline-sm text-headline-sm font-bold py-4 rounded-lg flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all" onclick="App.router.go('map')">
        ${isHold ? "Confirm Drop-off · view savings map" : "View route map"} <span class="material-symbols-outlined">arrow_forward</span></button>`;
  }

  function miniStat(icon, label, val) {
    return `<div class="bg-surface/30 rounded-lg p-2 flex flex-col items-center text-center">
      <span class="material-symbols-outlined text-[18px]">${icon}</span>
      <span class="font-label-md text-label-md opacity-80 text-[10px] uppercase">${label}</span>
      <span class="font-headline-sm text-headline-sm">${val}</span></div>`;
  }

  function conditionWord(grade) {
    return { A: "Excellent condition", B: "Good condition", C: "Fair — refurbish", D: "Poor — damaged", ERROR: "Could not grade" }[grade] || "";
  }

  App.screens = App.screens || {};
  App.screens.rider = { render };
})();
