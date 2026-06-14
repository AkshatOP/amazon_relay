import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { useApp } from "../store";
import { fmt } from "../lib/api";
import { coordFor } from "../lib/coords";
import { Icon } from "../components/ui";

const OSRM = "https://router.project-osrm.org/route/v1/driving";

async function fetchGeom(a, b) {
  try {
    const res = await fetch(`${OSRM}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === "Ok" && data.routes[0]) return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch { /* fall back to straight line */ }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Animate a Leaflet polyline "drawing" itself via stroke-dashoffset, then clear the dash so
   the line survives re-projection when the map zooms. */
function animateDraw(line, duration = 1200, delay = 0) {
  const el = line.getElement && line.getElement();
  if (!el || !el.getTotalLength) return;
  let len;
  try { len = el.getTotalLength(); } catch { return; }
  el.style.transition = "none";
  el.style.strokeDasharray = String(len);
  el.style.strokeDashoffset = String(len);
  el.getBoundingClientRect(); // force reflow
  requestAnimationFrame(() => {
    el.style.transition = `stroke-dashoffset ${duration}ms ease ${delay}ms`;
    el.style.strokeDashoffset = "0";
  });
  setTimeout(() => { try { el.style.transition = "none"; el.style.strokeDasharray = "none"; } catch { /* */ } }, delay + duration + 150);
}

const PIN = (color, icon, label) => L.divIcon({ className: "", iconSize: [0, 0], html:
  `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
     <div style="background:${color};width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
       <span class="material-symbols-outlined" style="color:#fff;font-size:16px;transform:rotate(45deg)">${icon}</span></div>
     <div style="margin-top:2px;background:#fff;border:1px solid #bec9c5;border-radius:6px;padding:1px 6px;font:600 11px Inter;white-space:nowrap">${label}</div>
   </div>` });

export default function MapScreen() {
  const { route, order, go } = useApp();
  const mapRef = useRef(null);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    if (!route) return;
    let cancelled = false;
    const geo = route.geography || {};
    const m = route.match || {};
    const customer = [order.customer_lat, order.customer_lng];
    const station = coordFor(geo.nearest_rcc) || customer;
    const fc = coordFor(geo.nearest_fc);
    const buyer = (m.buyer_lat != null && m.buyer_lng != null) ? [m.buyer_lat, m.buyer_lng] : null;
    const interceptLocal = buyer && route.decision === "RESELL_LOCAL";
    const isHold = route.decision === "RESELL_LOCAL";
    const stationLabel = `${isHold ? "Station" : "RCC"}: ${geo.nearest_rcc || ""}`;
    const distinct = Math.abs(customer[0] - station[0]) > 1e-4 || Math.abs(customer[1] - station[1]) > 1e-4;
    const green = { color: "#0f6e62", weight: 6, opacity: 0.95, lineJoin: "round" };

    const map = L.map("leaflet-map", { zoomControl: true, attributionControl: false });
    mapRef.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

    L.marker(customer, { icon: PIN("#181c1b", "person", "Pickup") }).addTo(map);
    L.marker(station, { icon: PIN("#0f6e62", "storefront", stationLabel) }).addTo(map);

    (async () => {
      // CASE A: local intercept to a chosen buyer — draw pickup → RCC → buyer (all green), focus local.
      if (interceptLocal) {
        L.marker(buyer, { icon: PIN("#0f6e62", "person_pin_circle", `Buyer · ${fmt.km(m.buyer_distance_km)}`) }).addTo(map);
        map.fitBounds(L.latLngBounds([customer, station, buyer]).pad(0.4));
        setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 80);
        await sleep(750);
        if (cancelled) return;
        if (distinct) {
          const g = (await fetchGeom(customer, station)) || [customer, station];
          if (cancelled) return;
          animateDraw(L.polyline(g, green).addTo(map), 1900, 150);
          await sleep(2300);
        }
        if (cancelled) return;
        const gb = (await fetchGeom(station, buyer)) || [station, buyer];
        if (cancelled) return;
        animateDraw(L.polyline(gb, green).addTo(map), 2200, 0);
        return;
      }

      // CASE B: FC route — pickup → RCC (green), then RCC → FC (red); buyer (if any) shown faded.
      if (distinct) map.fitBounds(L.latLngBounds([customer, station]).pad(0.6));
      else map.setView(customer, 13);
      setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 80);
      await sleep(750);
      if (cancelled) return;
      if (distinct) {
        const g = (await fetchGeom(customer, station)) || [customer, station];
        if (cancelled) return;
        animateDraw(L.polyline(g, green).addTo(map), 1900, 150);
        await sleep(2300);
      }
      if (cancelled || !fc) return;
      L.marker(fc, { icon: PIN("#ba1a1a", "warehouse", `FC ${geo.nearest_fc} · ${fmt.km(geo.fc_distance_km)}`) }).addTo(map);
      if (buyer) L.marker(buyer, { icon: PIN("#6e7976", "person_pin_circle", "Buyer · served from FC") }).addTo(map);
      const outer = buyer ? [customer, station, fc, buyer] : [customer, station, fc];
      map.flyToBounds(L.latLngBounds(outer).pad(0.18), { duration: 1.8 });
      await sleep(2000);
      if (cancelled) return;
      const gh = (await fetchGeom(station, fc)) || [station, fc];
      if (cancelled) return;
      animateDraw(L.polyline(gh, { color: "#ba1a1a", weight: 5, opacity: 0.85, lineJoin: "round" }).addTo(map), 2600, 0);
    })();

    return () => { cancelled = true; map.remove(); mapRef.current = null; };
  }, [route, order]);

  if (!route) return (
    <div className="p-container-margin flex flex-col items-center justify-center text-center gap-stack-lg h-full">
      <Icon name="map" className="text-[48px] text-outline" />
      <h3 className="font-headline-sm text-headline-sm text-on-surface">No route yet</h3>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-[260px]">Run a grade + route in the Rider screen first — the map plots the real geography and savings from that decision.</p>
      <button className="bg-primary text-on-primary font-label-bold text-label-bold py-3 px-5 rounded-lg" onClick={() => go("rider")}>Go to Rider flow</button>
    </div>
  );

  const econ = route.economics || {}, geo = route.geography || {};
  const isHold = route.decision === "RESELL_LOCAL";
  const interceptLocal = route.match?.buyer_lat != null && isHold;
  const saved = isHold && (econ.savings_inr || 0) > 0;
  const DECISION_WORD = { REFURBISH: "refurbishment at the FC", DONATE: "donation", LIQUIDATE: "liquidation", SHIP_TO_FC: "storage / restock at the FC" };
  return (
    <div className="h-full flex flex-col">
      <div className="relative flex-1 min-h-[340px]">
        <div id="leaflet-map" />
        <button className="absolute top-3 left-3 z-[500] w-10 h-10 bg-surface-container-lowest rounded-full shadow-md flex items-center justify-center text-on-surface" onClick={() => go("rider")}><Icon name="arrow_back" className="text-[20px]" /></button>
      </div>
      <div className="bg-surface border-t border-outline-variant p-container-margin flex flex-col gap-stack-lg">
        <h3 className="font-headline-md text-headline-md text-on-surface">{saved ? "Route optimized · local resale" : "Routing decision"}</h3>

        {saved ? (
          <>
            <div className="flex justify-between gap-2">
              <Stat icon="payments" label="Saved" val={fmt.inr2(econ.savings_inr)} />
              <Stat icon="eco" label="CO₂ saved" val={fmt.kg(econ.co2_saved_kg)} />
              <Stat icon="route" label="FC haul avoided" val={fmt.km(geo.fc_distance_km)} />
            </div>
            <div className="border-t border-outline-variant/30 pt-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setCalcOpen((o) => !o)}>
                <h4 className="font-label-bold text-label-bold text-on-surface">How we calculated this</h4><Icon name="expand_more" className="text-outline" />
              </div>
              {calcOpen && (
                <div className="mt-3 flex flex-col gap-1 font-mono-code text-mono-code text-on-surface-variant bg-surface-container-low p-3 rounded text-[11px]">
                  <Line k="Full path (haul + reship):" v={fmt.inr2(econ.full_path_cost)} />
                  <Line k="Local intercept:" v={econ.local_intercept_cost != null ? fmt.inr2(econ.local_intercept_cost) : "n/a"} />
                  <div className="w-full h-px bg-outline-variant/50 my-1" />
                  <Line k="Net savings:" v={fmt.inr2(econ.savings_inr)} bold />
                  <Line k="CO₂ full / local:" v={`${fmt.kg(econ.co2_full_kg)} / ${econ.co2_local_kg != null ? fmt.kg(econ.co2_local_kg) : "—"}`} />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2"><Icon name="local_shipping" className="text-on-surface-variant" /><span className="font-headline-sm text-headline-sm text-on-surface">Normal route followed</span></div>
            <p className="font-body-md text-body-md text-on-surface-variant">
              No nearby buyer to intercept this one, so it takes the standard path — hauled to <b>{geo.nearest_fc}</b> (~{fmt.km(geo.fc_distance_km)}) for {DECISION_WORD[route.decision] || "processing"}. Local-intercept savings only appear when a nearby buyer lets us skip the warehouse (e.g. the far-FC Udupi scenario).
            </p>
            <div className="flex flex-wrap gap-2 mt-1">
              <span className="bg-surface-container-high text-on-surface-variant font-label-bold text-label-bold px-2 py-1 rounded">{route.decision}</span>
              <span className="bg-surface-container-high text-on-surface-variant font-label-bold text-label-bold px-2 py-1 rounded">FC {geo.nearest_fc} · {fmt.km(geo.fc_distance_km)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-label-md font-label-md">
          <span className="flex items-center gap-1"><span className="w-5 h-1.5 bg-primary inline-block rounded" />pickup → {interceptLocal ? "buyer (via station)" : "local station"}</span>
          {!interceptLocal && <span className="flex items-center gap-1"><span className="w-5 h-1.5 inline-block rounded" style={{ background: "#ba1a1a" }} />{saved ? "avoided FC haul" : "haul to FC"} (real road)</span>}
        </div>
      </div>
    </div>
  );
}

const Stat = ({ icon, label, val }) => (
  <div className="flex-1 bg-surface-container-lowest rounded-lg p-3 border border-outline-variant/30 flex flex-col items-center text-center">
    <Icon name={icon} className="text-primary mb-1" fill /><span className="font-label-md text-label-md text-on-surface-variant text-[10px] uppercase">{label}</span>
    <span className="font-headline-sm text-headline-sm text-on-surface">{val}</span>
  </div>
);
const Line = ({ k, v, bold }) => (
  <div className={`flex justify-between ${bold ? "font-bold text-on-surface" : ""}`}><span>{k}</span><span>{v}</span></div>
);
