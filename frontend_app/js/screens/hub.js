/* hub.js — Screen 8 (Relay Hub / dashboard).
   Sustainability total + listing counts come from the real GET /metrics aggregate
   (returns_log + listings). Figures are live lifetime totals, not fabricated. */
(function () {
  "use strict";
  const { fmt } = App;

  function render() {
    const host = document.getElementById("screen-hub");
    host.innerHTML = `
      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-lg shadow-sm flex items-center justify-between">
        <div class="flex flex-col">
          <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Sustainability Impact</p>
          <h2 class="font-display-lg text-display-lg text-on-surface mt-1" id="m-co2">… <span class="font-headline-sm text-headline-sm text-on-surface-variant">kg</span></h2>
          <p class="font-body-md text-body-md text-primary mt-1">CO₂ saved · <span id="m-money">…</span> saved across <span id="m-routed">…</span> returns</p>
        </div>
        <div class="relative w-20 h-20 flex items-center justify-center">
          <svg class="w-full h-full circular-progress" viewBox="0 0 36 36">
            <path class="text-surface-variant" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3"></path>
          </svg>
          <span class="material-symbols-outlined text-primary text-[24px] absolute fill-icon">eco</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-gutter">
        <button class="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm flex flex-col gap-stack-sm text-left hover:bg-surface-container-low" onclick="App.router.go('p2p-nudge')">
          <div class="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center mb-1"><span class="material-symbols-outlined text-on-primary-container fill-icon">history</span></div>
          <p class="font-label-bold text-label-bold text-on-surface">Resell from Order History</p></button>
        <button class="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm flex flex-col gap-stack-sm text-left hover:bg-surface-container-low" onclick="App.router.go('p2p-handoff')">
          <div class="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center mb-1"><span class="material-symbols-outlined text-on-secondary-container fill-icon">inventory_2</span></div>
          <p class="font-label-bold text-label-bold text-on-surface">Active Listings</p>
          <p class="font-body-md text-body-md text-primary font-bold" id="m-listings">…</p></button>
      </div>

      <button class="bg-near-black border border-outline-variant rounded-lg p-stack-lg shadow-sm flex gap-stack-md relative overflow-hidden text-left" onclick="App.router.go('orders')">
        <div class="absolute top-0 right-0 px-2 py-1 bg-primary text-white font-label-bold text-label-bold rounded-bl-lg text-[10px]">DEMO ENTRY</div>
        <div class="w-12 h-12 bg-[#2d3130] rounded-full flex items-center justify-center shrink-0 mt-2"><span class="material-symbols-outlined text-amber">bolt</span></div>
        <div class="flex flex-col">
          <p class="font-body-md text-body-md text-white">Start the hero flow: a returned <span class="font-bold">niche shoe</span> with a nearby buyer.</p>
          <span class="mt-3 text-primary-fixed-dim font-label-bold text-label-bold flex items-center gap-1">Open order → return → rider grade <span class="material-symbols-outlined text-[16px]">arrow_forward</span></span>
        </div>
      </button>

      <div class="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-lg">
        <p class="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider mb-2">Live backend</p>
        <div id="hub-health" class="font-mono-code text-mono-code text-on-surface-variant">checking…</div>
      </div>`;

    App.api.health().then((h) => {
      const el = document.getElementById("hub-health");
      if (!el) return;
      if (h && h.status === "ok") el.innerHTML = `status: ok · model: ${h.model}<br/>db_ready: ${h.db_ready} · router_model: ${h.router_model_trained}`;
      else el.textContent = "backend unreachable";
    });

    App.api.metrics().then((m) => {
      if (!m || m._networkError) return;
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
      set("m-co2", `${(m.co2_saved_kg || 0).toFixed(2)} <span class="font-headline-sm text-headline-sm text-on-surface-variant">kg</span>`);
      set("m-money", fmt.inr(m.money_saved_inr));
      set("m-routed", m.returns_routed);
      set("m-listings", `${m.active_listings} · ${fmt.inr(m.active_listing_value_inr)}`);
    });
  }

  App.screens = App.screens || {};
  App.screens.hub = { render };
})();
