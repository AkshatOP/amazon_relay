/* map.js — Screen 4 (Logistics Map) — REAL Leaflet with REAL road paths.
   Polylines follow actual roads via OSRM geometry (overview=full, geojson), drawn as
   bold solid lines. Pins/stats come from App.state.lastRoute.geography/.economics.
   Node lat/lng aren't in the route response → resolved via App.state.coordFor(). */
(function () {
  "use strict";
  const { fmt } = App;
  const OSRM = "https://router.project-osrm.org/route/v1/driving";
  let map = null;

  function render() {
    const host = document.getElementById("screen-map");
    const r = App.state.lastRoute;
    if (!r) { host.innerHTML = emptyState(); return; }

    const econ = r.economics || {}, geo = r.geography || {};
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
          <span class="flex items-center gap-1"><span class="w-5 h-1.5 bg-primary inline-block rounded"></span>local intercept</span>
          <span class="flex items-center gap-1"><span class="w-5 h-1.5 inline-block rounded" style="background:#ba1a1a"></span>avoided FC haul (real road)</span>
        </div>
      </div>`;
    setTimeout(drawMap, 60);
  }

  // Fetch a real road polyline ([[lat,lng],...]) between two points; null on failure.
  async function fetchGeom(a, b) {
    try {
      const url = `${OSRM}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === "Ok" && data.routes[0]) {
        return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      }
    } catch (e) { /* fall through to straight line */ }
    return null;
  }

  async function drawMap() {
    const r = App.state.lastRoute, o = App.state.order, geo = r.geography || {};
    const customer = [o.customer_lat, o.customer_lng];
    const station = App.state.coordFor(geo.nearest_rcc) || customer;
    const fc = App.state.coordFor(geo.nearest_fc);

    if (map) { map.remove(); map = null; }
    map = L.map("leaflet-map", { zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

    const pin = (latlng, color, icon, label) => L.marker(latlng, { icon: L.divIcon({ className: "", html:
      `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
         <div style="background:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
           <span class="material-symbols-outlined" style="color:#fff;font-size:16px;transform:rotate(45deg)">${icon}</span></div>
         <div style="margin-top:2px;background:#fff;border:1px solid #bec9c5;border-radius:6px;padding:1px 6px;font:600 11px Inter;white-space:nowrap">${label}</div>
       </div>`, iconSize: [0, 0] }) }).addTo(map);

    pin(customer, "#181c1b", "person", "Pickup");
    pin(station, "#0f6e62", "storefront", geo.nearest_rcc || "Station");
    const allPts = [customer, station];

    // local intercept (customer → station): bold solid green, real road if distinct points
    if (Math.abs(customer[0] - station[0]) > 1e-4 || Math.abs(customer[1] - station[1]) > 1e-4) {
      const g = (await fetchGeom(customer, station)) || [customer, station];
      L.polyline(g, { color: "#0f6e62", weight: 6, opacity: 0.95, lineJoin: "round" }).addTo(map);
      g.forEach((p) => allPts.push(p));
    }

    // avoided FC haul (station → FC): bold SOLID red real road path
    if (fc) {
      pin(fc, "#ba1a1a", "warehouse", `${geo.nearest_fc} · ${fmt.km(geo.fc_distance_km)}`);
      const gh = (await fetchGeom(station, fc)) || [station, fc];
      L.polyline(gh, { color: "#ba1a1a", weight: 5, opacity: 0.85, lineJoin: "round" }).addTo(map);
      gh.forEach((p) => allPts.push(p));
    }

    map.fitBounds(L.latLngBounds(allPts).pad(0.15));
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
