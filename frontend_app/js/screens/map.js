/* map.js — Screen 4 (Logistics Map) — REAL Leaflet.
   Pins + polylines from App.state.lastRoute.geography; stats from .economics.
   Node lat/lng aren't in the route response, so names/codes resolve via
   App.state.coordFor() (a demo-convenience lookup mirroring seed_locations). */
(function () {
  "use strict";
  const { fmt } = App;
  let map = null;

  function render() {
    const host = document.getElementById("screen-map");
    const r = App.state.lastRoute;

    if (!r) {
      host.innerHTML = emptyState();
      return;
    }

    const econ = r.economics || {};
    const geo = r.geography || {};
    host.innerHTML = `
      <div class="relative flex-1 min-h-[340px]"><div id="leaflet-map"></div>
        <button class="absolute top-3 left-3 z-[500] w-10 h-10 bg-surface-container-lowest rounded-full shadow-md flex items-center justify-center text-on-surface" onclick="App.router.go('rider')">
          <span class="material-symbols-outlined text-[20px]">arrow_back</span></button>
      </div>
      <div class="bg-surface border-t border-outline-variant p-container-margin flex flex-col gap-stack-lg">
        <h3 class="font-headline-md text-headline-md text-on-surface">${r.decision === "RESELL_LOCAL" ? "Route optimized" : "Routing"}</h3>
        <div class="flex justify-between gap-2">
          ${stat("payments", "Saved", fmt.inr2(econ.savings_inr))}
          ${stat("eco", "CO₂ saved", fmt.kg(econ.co2_saved_kg))}
          ${stat("route", "FC haul avoided", fmt.km(geo.fc_distance_km))}
        </div>
        <div class="border-t border-outline-variant/30 pt-3">
          <div class="flex items-center justify-between cursor-pointer" onclick="document.getElementById('calc').classList.toggle('hidden')">
            <h4 class="font-label-bold text-label-bold text-on-surface">How we calculated this</h4>
            <span class="material-symbols-outlined text-outline">expand_more</span></div>
          <div id="calc" class="hidden mt-3 flex flex-col gap-1 font-mono-code text-mono-code text-on-surface-variant bg-surface-container-low p-3 rounded text-[11px]">
            <div class="flex justify-between"><span>Full path (haul + reship):</span><span>${fmt.inr2(econ.full_path_cost)}</span></div>
            <div class="flex justify-between"><span>Local intercept:</span><span>${econ.local_intercept_cost != null ? fmt.inr2(econ.local_intercept_cost) : "n/a (no buyer)"}</span></div>
            <div class="w-full h-px bg-outline-variant/50 my-1"></div>
            <div class="flex justify-between font-bold text-on-surface"><span>Net savings:</span><span>${fmt.inr2(econ.savings_inr)}</span></div>
            <div class="flex justify-between mt-1"><span>CO₂ full / local:</span><span>${fmt.kg(econ.co2_full_kg)} / ${econ.co2_local_kg!=null?fmt.kg(econ.co2_local_kg):"—"}</span></div>
          </div>
        </div>
        <div class="flex items-center gap-3 text-label-md font-label-md">
          <span class="flex items-center gap-1"><span class="w-4 h-1 bg-primary inline-block rounded"></span>local intercept</span>
          <span class="flex items-center gap-1"><span class="w-4 h-1 inline-block rounded" style="background:repeating-linear-gradient(90deg,#ba1a1a 0 4px,transparent 4px 8px)"></span>avoided FC haul</span>
        </div>
      </div>`;

    setTimeout(drawMap, 60);
  }

  function drawMap() {
    const r = App.state.lastRoute;
    const o = App.state.order;
    const geo = r.geography || {};
    const customer = [o.customer_lat, o.customer_lng];
    const station = App.state.coordFor(geo.nearest_rcc) || customer;
    const fc = App.state.coordFor(geo.nearest_fc);

    if (map) { map.remove(); map = null; }
    map = L.map("leaflet-map", { zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

    const pin = (latlng, color, icon, label) => L.marker(latlng, {
      icon: L.divIcon({ className: "", html:
        `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
           <div style="background:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
             <span class="material-symbols-outlined" style="color:#fff;font-size:16px;transform:rotate(45deg)">${icon}</span></div>
           <div style="margin-top:2px;background:#fff;border:1px solid #bec9c5;border-radius:6px;padding:1px 6px;font:600 11px Inter;white-space:nowrap">${label}</div>
         </div>`, iconSize: [0, 0] }),
    }).addTo(map);

    pin(customer, "#181c1b", "person", "Pickup");
    pin(station, "#0f6e62", "storefront", geo.nearest_rcc || "Station");

    // Green: local intercept (customer → station)
    L.polyline([customer, station], { color: "#0f6e62", weight: 4 }).addTo(map);

    const pts = [customer, station];
    if (fc) {
      pin(fc, "#ba1a1a", "warehouse", `${geo.nearest_fc} · ${fmt.km(geo.fc_distance_km)}`);
      // Red dashed: the avoided FC haul (station → FC)
      L.polyline([station, fc], { color: "#ba1a1a", weight: 3, dashArray: "8 8", opacity: 0.7 }).addTo(map);
      pts.push(fc);
    }
    map.fitBounds(L.latLngBounds(pts).pad(0.25));
    setTimeout(() => map.invalidateSize(), 80);
  }

  function stat(icon, label, val) {
    return `<div class="flex-1 bg-surface-container-lowest rounded-lg p-3 border border-outline-variant/30 flex flex-col items-center text-center">
      <span class="material-symbols-outlined text-primary mb-1 fill-icon">${icon}</span>
      <span class="font-label-md text-label-md text-on-surface-variant text-[10px] uppercase">${label}</span>
      <span class="font-headline-sm text-headline-sm text-on-surface">${val}</span></div>`;
  }

  function emptyState() {
    return `<div class="p-container-margin flex flex-col items-center justify-center text-center gap-stack-lg h-full">
      <span class="material-symbols-outlined text-[48px] text-outline">map</span>
      <h3 class="font-headline-sm text-headline-sm text-on-surface">No route yet</h3>
      <p class="font-body-md text-body-md text-on-surface-variant max-w-[260px]">Run a grade + route in the Rider screen first — the map plots the real geography and savings from that decision.</p>
      <button class="bg-primary text-on-primary font-label-bold text-label-bold py-3 px-5 rounded-lg" onclick="App.router.go('rider')">Go to Rider flow</button></div>`;
  }

  App.screens = App.screens || {};
  App.screens.map = { render };
})();
