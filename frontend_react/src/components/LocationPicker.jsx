import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { Icon } from "./ui";
import { UDUPI_STATIONS, BLR_RCCS, FCS, nearestNode } from "../lib/coords";

const COLORS = { station: "#0f6e62", rcc: "#3461c1", fc: "#ba1a1a", customer: "#131A22" };

const pinHtml = (color, icon, sz = 28) =>
  `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center">
     <div style="background:${color};width:${sz}px;height:${sz}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">
       <span class="material-symbols-outlined" style="color:#fff;font-size:${Math.round(sz * 0.55)}px;transform:rotate(45deg)">${icon}</span></div>
   </div>`;
const icon = (color, name, sz) => L.divIcon({ className: "", html: pinHtml(color, name, sz), iconSize: [0, 0] });

/* Full-screen map picker: tap/drag to place the pickup pin. Marks the whole network —
   Udupi delivery stations (teal), Bengaluru RCCs (blue), Fulfillment Centers (red). */
export default function LocationPicker({ initial, onPick, onClose }) {
  const [pos, setPos] = useState({ lat: initial.lat, lng: initial.lng });
  const mapRef = useRef(null);
  const allPtsRef = useRef([]);

  useEffect(() => {
    const map = L.map("picker-map", { zoomControl: true, attributionControl: false }).setView([initial.lat, initial.lng], 10);
    mapRef.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);

    const pts = [[initial.lat, initial.lng]];
    const add = (list, color, ic, sz, fmtLabel) => list.forEach((s) => {
      L.marker([s.lat, s.lng], { icon: icon(color, ic, sz) }).addTo(map)
        .bindTooltip(fmtLabel(s), { direction: "top", offset: [0, -sz + 2] });
      pts.push([s.lat, s.lng]);
    });
    add(UDUPI_STATIONS, COLORS.station, "storefront", 26, (s) => `${s.name} · ${s.pincode}`);
    add(BLR_RCCS, COLORS.rcc, "hub", 24, (s) => `RCC · ${s.name} · ${s.pincode}`);
    add(FCS, COLORS.fc, "warehouse", 26, (s) => `FC ${s.code} · ${s.name} · ${s.pincode}`);
    allPtsRef.current = pts;

    const m = L.marker([initial.lat, initial.lng], { draggable: true, icon: icon(COLORS.customer, "person", 30), zIndexOffset: 1000 }).addTo(map);
    m.on("dragend", () => { const ll = m.getLatLng(); setPos({ lat: ll.lat, lng: ll.lng }); });
    map.on("click", (e) => { m.setLatLng(e.latlng); setPos({ lat: e.latlng.lat, lng: e.latlng.lng }); });

    setTimeout(() => map.invalidateSize(), 80);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitAll = () => mapRef.current?.fitBounds(L.latLngBounds(allPtsRef.current).pad(0.1));
  const focusUdupi = () => mapRef.current?.setView([initial.lat, initial.lng], 11);

  const near = nearestNode(pos.lat, pos.lng);
  const roadKm = near ? (near.dist * 1.4).toFixed(1) : null;
  const regionLabel = near?.region === "bengaluru" ? "Bengaluru" : "Udupi";
  const kindLabel = near?.kind === "rcc" ? "RCC" : "station";

  function confirm() {
    const area = near ? near.name.replace(/\s*\(.*\)\s*/, "") : "Custom location";
    onPick({ lat: +pos.lat.toFixed(5), lng: +pos.lng.toFixed(5), area, region: near?.region || "udupi" });
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/60 flex flex-col items-center">
      <div className="w-full max-w-[428px] flex flex-col h-full bg-surface">
        <div className="h-[56px] flex-none flex items-center justify-between px-4 border-b border-outline-variant">
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container-high"><Icon name="close" className="text-on-surface" /></button>
          <span className="font-headline-sm text-headline-sm text-on-surface">Pick pickup location</span>
          <span className="w-9" />
        </div>

        <div className="relative flex-1">
          <div id="picker-map" className="absolute inset-0" />

          {/* legend */}
          <div className="absolute top-2 right-2 z-[500] bg-surface/95 backdrop-blur border border-outline-variant rounded-lg p-2 shadow-md flex flex-col gap-1">
            <LegendRow color={COLORS.station} label="Delivery station (Udupi)" />
            <LegendRow color={COLORS.rcc} label="RCC · Bengaluru" />
            <LegendRow color={COLORS.fc} label="Fulfillment Center" />
            <LegendRow color={COLORS.customer} label="Your pickup" />
          </div>

          {/* view controls */}
          <div className="absolute bottom-2 right-2 z-[500] flex flex-col gap-1.5">
            <button onClick={fitAll} className="bg-surface/95 backdrop-blur border border-outline-variant rounded-lg px-3 py-1.5 shadow-md font-label-bold text-label-bold text-on-surface flex items-center gap-1"><Icon name="zoom_out_map" className="text-[16px]" /> Full network</button>
            <button onClick={focusUdupi} className="bg-surface/95 backdrop-blur border border-outline-variant rounded-lg px-3 py-1.5 shadow-md font-label-bold text-label-bold text-primary flex items-center gap-1"><Icon name="my_location" className="text-[16px]" /> Udupi</button>
          </div>
        </div>

        <div className="flex-none bg-surface p-4 flex flex-col gap-3 border-t border-outline-variant">
          <p className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
            <Icon name="touch_app" className="text-[16px]" /> Tap the map or drag the black pin to set the pickup point.
          </p>
          <div className="bg-surface-container-low rounded-lg p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-mono-code text-mono-code text-on-surface">{pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}</span>
              <span className="font-label-md text-label-md text-on-surface-variant">nearest {kindLabel}: {near?.name?.replace(/\s*\(.*\)\s*/, "")} · ~{roadKm} km · <b className="text-primary">{regionLabel}</b> region</span>
            </div>
            <Icon name="my_location" className="text-primary" fill />
          </div>
          <button onClick={confirm} className="w-full bg-primary text-on-primary font-label-bold text-label-bold py-3 rounded-lg flex items-center justify-center gap-2">
            <Icon name="check" /> Use this location
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const LegendRow = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <span className="w-3 h-3 rounded-full" style={{ background: color }} />
    <span className="font-label-md text-label-md text-on-surface">{label}</span>
  </div>
);
