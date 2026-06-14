/* orders.js — Screen 1 (Order Detail) + Screen 2 (Branched Return).
   Also defines App.ui: reusable Stitch components used across all screens. */
(function () {
  "use strict";
  window.App = window.App || {};
  const { fmt } = App;

  // ---------------------------------------------------------------------
  // Shared reusable components (extracted from the Stitch exports)
  // ---------------------------------------------------------------------
  App.ui = {
    // SVG score gauge (amber arc, 0..max). Stitch r=40 / circumference≈251.2.
    gauge(score, max = 10, color = "#FFA724") {
      const C = 251.2;
      const frac = Math.max(0, Math.min(1, (Number(score) || 0) / max));
      const offset = C * (1 - frac);
      return `
        <div class="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
          <svg class="w-full h-full circular-progress" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ebefec" stroke-width="8"></circle>
            <circle class="gauge-arc" cx="50" cy="50" r="40" fill="transparent" stroke="${color}"
                    stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${offset}"></circle>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="font-headline-md text-headline-md text-on-surface leading-none">${(Number(score)||0).toFixed(1)}</span>
            <span class="font-mono-code text-mono-code text-secondary text-[10px]">/ ${max}</span>
          </div>
        </div>`;
    },

    gradeBadge(grade) {
      const map = { A: "bg-success/15 text-success border-success/30", B: "bg-amber/20 text-on-tertiary-fixed-variant border-amber/30",
        C: "bg-amber/20 text-on-tertiary-fixed-variant border-amber/30", D: "bg-error-container text-on-error-container border-error/30",
        ERROR: "bg-error-container text-on-error-container border-error/30" };
      const cls = map[grade] || "bg-surface-container-high text-on-surface-variant border-outline-variant/30";
      return `<span class="font-label-bold text-label-bold px-3 py-1 rounded-sm border ${cls}">GRADE ${grade}</span>`;
    },

    defectChips(defects) {
      if (!defects || defects.length === 0)
        return `<span class="bg-surface-container-high text-on-surface-variant font-label-md text-label-md px-2 py-1 rounded border border-outline-variant/30 flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">check</span> No defects</span>`;
      return defects.map((d) => `
        <span class="bg-surface-container-high text-on-surface-variant font-label-md text-label-md px-2 py-1 rounded border border-outline-variant/30 flex items-center gap-1">
          <span class="material-symbols-outlined text-[14px]">search</span> ${d}</span>`).join("");
    },

    // Streams reasoning lines into the #131A22 terminal panel.
    terminalLog(hostEl, lines) {
      hostEl.innerHTML = `
        <div class="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
          <span class="material-symbols-outlined text-primary-fixed-dim text-[16px]">terminal</span>
          <span class="font-label-bold text-label-bold text-primary-fixed-dim uppercase tracking-widest text-[10px]">Agent Reasoning Log</span>
        </div>
        <div class="font-mono-code text-mono-code text-[#A0AEC0] flex flex-col gap-1 text-[11px] leading-relaxed" id="term-lines"></div>`;
      const box = hostEl.querySelector("#term-lines");
      lines.forEach((ln, i) => setTimeout(() => {
        const p = document.createElement("p");
        p.innerHTML = ln;
        box.appendChild(p);
      }, i * 280));
    },

    spinnerBtnHTML(label) {
      return `<span class="material-symbols-outlined animate-spin">autorenew</span><span>${label}</span>`;
    },
  };

  // ---------------------------------------------------------------------
  // Screen 1 — Order Detail
  // ---------------------------------------------------------------------
  function renderOrders() {
    const o = App.state.order;
    const host = document.getElementById("screen-orders");
    host.innerHTML = `
      <div class="flex items-center gap-2 text-on-surface-variant mb-1 cursor-pointer" onclick="App.router.go('hub')">
        <span class="material-symbols-outlined text-[20px]">arrow_back</span>
        <span class="font-body-md text-body-md">Your Orders</span>
      </div>
      <div class="flex items-center gap-stack-md">
        <div class="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success">
          <span class="material-symbols-outlined text-[18px]">check_circle</span></div>
        <div><h2 class="font-headline-sm text-headline-sm text-on-surface">Delivered</h2>
          <p class="font-body-md text-body-md text-on-surface-variant">Handed directly to resident.</p></div>
      </div>
      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm flex gap-container-margin items-start">
        <div class="w-[80px] h-[80px] rounded bg-surface-container flex-shrink-0 border border-outline-variant/50 flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[36px]">${o.category === "shoes" || o.category === "footwear" ? "footprint" : "headphones"}</span>
        </div>
        <div class="flex flex-col gap-stack-sm flex-grow">
          <h3 class="font-headline-sm text-headline-sm text-on-surface leading-tight">${o.product_name}</h3>
          <div class="font-body-md text-body-md text-on-surface-variant">${o.category}</div>
          <div class="font-label-bold text-label-bold text-on-surface mt-1">${fmt.inr(o.original_price)}</div>
        </div>
      </div>
      <div class="flex flex-col gap-stack-md">
        <div class="flex justify-between items-center py-2 border-b border-outline-variant/30">
          <span class="font-body-md text-body-md text-on-surface-variant">Order ID</span>
          <span class="font-label-bold text-label-bold text-on-surface">#${o.order_id}</span></div>
        <div class="flex justify-between items-center py-2 border-b border-outline-variant/30">
          <span class="font-body-md text-body-md text-on-surface-variant">Address</span>
          <span class="font-body-md text-body-md text-on-surface">${o.customer_area}, Udupi</span></div>
      </div>
      <button class="w-full bg-amber-action text-near-black font-label-bold text-label-bold py-4 rounded-lg flex items-center justify-center gap-2 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)] active:translate-y-[1px] transition-all" onclick="App.router.go('return')">
        Return this product <span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>
      <p class="font-label-md text-label-md text-on-surface-variant text-center">Demo order = the seeded Udupi niche shoe (the scenario with a nearby buyer).</p>`;
  }

  // ---------------------------------------------------------------------
  // Screen 2 — Branched Return
  // ---------------------------------------------------------------------
  const ELECTRONIC = new Set(["headphones", "laptop", "camera", "charger", "power_bank", "speaker", "smartphone", "baby_monitor", "appliance", "mouse", "keyboard"]);

  function renderReturn() {
    const o = App.state.order;
    const isElectronic = ELECTRONIC.has(o.category);
    const host = document.getElementById("screen-return");
    host.innerHTML = `
      <div class="flex items-center gap-2 text-on-surface mb-2">
        <button class="p-1 -ml-1 text-on-surface-variant rounded-full" onclick="App.router.go('orders')"><span class="material-symbols-outlined">close</span></button>
        <h2 class="font-headline-md text-headline-md">Initiate Return</h2>
      </div>
      <div class="flex gap-container-margin items-center p-3 bg-surface rounded-lg border border-outline-variant/30">
        <div class="w-12 h-12 rounded bg-surface-container flex items-center justify-center text-on-surface-variant border border-outline-variant/50">
          <span class="material-symbols-outlined">${isElectronic ? "headphones" : "footprint"}</span></div>
        <div class="font-body-md text-body-md text-on-surface font-medium">${o.product_name}</div>
      </div>
      <div class="flex flex-col gap-stack-sm">
        <label class="font-label-bold text-label-bold text-on-surface-variant">Reason for return</label>
        <div class="relative">
          <select id="ret-reason" class="w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg p-3 pr-10 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary">
            <option>Performance not as expected</option><option>Item damaged on arrival</option>
            <option>No longer needed</option><option>Inaccurate description</option></select>
          <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">expand_more</span>
        </div>
      </div>
      <div id="ret-electronic" class="${isElectronic ? "" : "hidden"} flex flex-col gap-stack-md">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Device Condition</h3>
        ${condRow("Does it power on?", true)}
        ${condRow("Any physical damage?", false)}
        <p class="font-label-md text-label-md text-on-surface-variant">Branched because <b>${o.category}</b> is an electronic item.</p>
      </div>
      <div class="bg-[#F1F8F6] border border-primary/20 rounded-xl p-container-margin flex flex-col items-center text-center gap-stack-md mt-2">
        <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-primary">
          <span class="material-symbols-outlined text-[24px]">calendar_today</span></div>
        <h4 class="font-headline-sm text-headline-sm text-on-surface">Pickup Scheduled</h4>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-[220px]">A rider will collect this in 2–4 days.</p>
      </div>
      <button class="w-full bg-primary text-on-primary font-label-bold text-label-bold py-3.5 rounded-lg shadow-sm" onclick="App.router.go('rider')">Confirm Return → Rider flow</button>`;
  }

  function condRow(label, on) {
    return `<div class="flex items-center justify-between p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
      <span class="font-body-md text-body-md text-on-surface">${label}</span>
      <div class="flex gap-2">
        <button class="cond-btn px-4 py-1.5 rounded-full font-label-bold text-label-bold border ${on ? "bg-primary-container text-on-primary-container border-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/50"}">Yes</button>
        <button class="cond-btn px-4 py-1.5 rounded-full font-label-bold text-label-bold border ${!on ? "bg-primary-container text-on-primary-container border-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/50"}">No</button>
      </div></div>`;
  }

  App.screens = App.screens || {};
  App.screens.orders = { render: renderOrders };
  App.screens.return = { render: renderReturn };
})();
