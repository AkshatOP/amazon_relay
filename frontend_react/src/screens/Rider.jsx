import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useApp } from "../store";
import { api, fmt } from "../lib/api";
import { Icon, ProductImg, Gauge, GradeBadge, DefectChips, TerminalLog, Spinner } from "../components/ui";
import CameraModal from "../components/CameraModal";
import LocationPicker from "../components/LocationPicker";

const MAX = 4;
const CONDITION = { A: "Excellent condition", B: "Good condition", C: "Fair — refurbish", D: "Poor — damaged", ERROR: "Could not grade" };
const TAG = { RESELL_LOCAL: "HOLD — local resale (1–2 days)", REFURBISH: "SHIP TO FC — refurbish", DONATE: "ROUTE TO NGO — donate", LIQUIDATE: "ROUTE — liquidate" };

export default function Rider() {
  const { order, grade, setGrade, route, setRoute, toast } = useApp();
  const [photos, setPhotos] = useState([]);
  const [cam, setCam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [routing, setRouting] = useState(false);
  const fileRef = useRef(null);

  function addFiles(list) {
    const imgs = [...(list || [])].filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setPhotos((p) => {
      const next = [...p];
      for (const f of imgs) { if (next.length >= MAX) { toast(`Max ${MAX} photos`, "info"); break; } next.push(f); }
      return next;
    });
  }
  const removeAt = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  async function runGrading() {
    setBusy(true); setGrade(null); setRoute(null);
    let g;
    if (photos.length > 0) g = await api.grade(order.category, { inspection: photos }, order.asin);
    else { toast("No photo — using functional checklist grade", "info"); g = await api.gradeFunctional(order.category, [true, true, false]); }
    setBusy(false);
    if (!g || g.grade === "ERROR" || g._networkError || g._httpError) { toast(g?.reasoning || "Grading failed — try again", "err", 5000); return; }
    setGrade(g);
    runRoute(g);
  }

  async function runRoute(g) {
    setRouting(true);
    const order_meta = {
      order_id: order.order_id, asin: order.asin, product_name: order.product_name, category: order.category,
      original_price: order.original_price, customer_lat: order.customer_lat, customer_lng: order.customer_lng, region: order.region,
    };
    const r = await api.route(g, order_meta);
    setRouting(false);
    if (r && !r._networkError && !r._httpError) setRoute(r);
  }

  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg bg-surface">
      {cam && <CameraModal onCapture={(f) => addFiles([f])} onClose={() => setCam(false)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon name="electric_scooter" className="text-on-surface" /><h2 className="font-headline-md text-headline-md text-on-surface">Rider Pickup</h2></div>
        <div className="flex items-center gap-1 bg-primary text-on-primary px-2.5 py-1 rounded-full animate-ai-pulse"><Icon name="smart_toy" className="text-[14px]" fill /><span className="font-label-bold text-label-bold text-[10px]">AI ACTIVE</span></div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm flex justify-between items-center">
        <div className="flex gap-3 items-center">
          <div className="relative overflow-hidden w-10 h-10 bg-surface-container rounded-md flex items-center justify-center text-on-surface-variant">
            <ProductImg asin={order.asin} icon={order.category === "shoes" ? "footprint" : "inventory_2"} iconClass="text-[20px]" />
          </div>
          <div><div className="font-body-md text-body-md text-on-surface font-medium">{order.product_name}</div>
            <div className="font-label-md text-label-md text-on-surface-variant">#{order.order_id} · {order.customer_area}</div></div>
        </div>
        <span className="font-label-bold text-label-bold text-amber-action bg-amber-action/10 px-2 py-1 rounded">Collect</span>
      </div>

      <h3 className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider">Product Photos</h3>
      <div className="bg-amber/10 border border-amber/30 rounded-lg p-3 flex items-start gap-2">
        <Icon name="warning" className="text-[18px] text-tertiary" />
        <p className="font-body-md text-body-md text-on-surface">Specifically capture the <b>torn / damaged / worn part</b> in close-up. Drag &amp; drop images, tap a tile to choose, or use the live camera. Up to {MAX} photos — all sent to the AI together.</p>
      </div>

      <div className="grid grid-cols-2 gap-2"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
        {Array.from({ length: MAX }).map((_, i) => {
          const f = photos[i];
          if (f) return (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-primary">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center" onClick={() => removeAt(i)}><Icon name="close" className="text-[16px]" /></button>
            </div>
          );
          const isNext = i === photos.length;
          return (
            <button key={i} onClick={() => isNext && fileRef.current?.click()}
              className={`aspect-square rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${isNext ? "border-primary bg-surface-container-lowest hover:bg-surface-container cursor-pointer" : "border-outline bg-surface-container-low text-outline/60"}`}>
              <Icon name="add_a_photo" className="text-outline" />
              <span className="font-label-md text-label-md text-on-surface-variant">Photo {i + 1}</span>
            </button>
          );
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      <button className="w-full bg-surface border border-primary text-primary font-label-bold text-label-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors" onClick={() => setCam(true)}>
        <Icon name="photo_camera" /> Use live camera (phone / webcam)
      </button>

      <motion.button whileTap={{ scale: 0.98 }} disabled={busy}
        className="w-full bg-primary text-on-primary py-3 rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-70" onClick={runGrading}>
        {busy ? <Spinner label="Grading…" /> : <><Icon name="memory" /> Run AI Grading</>}
      </motion.button>
      <p className="font-label-md text-label-md text-on-surface-variant -mt-1">No photo → falls back to a functional checklist grade (still a real API call).</p>

      {grade && <GradeResult g={grade} />}
      {routing && <div className="flex items-center gap-2 text-on-surface-variant p-3"><Icon name="autorenew" className="animate-spin" /> routing…</div>}
      {route && holdEligible(route, grade) && <HoldFlow route={route} order={order} grade={grade} />}
      {route && !holdEligible(route, grade) && <RouteBanner r={route} />}
    </section>
  );
}

// Resale-eligible (grade A/B) but no DB buyer → don't dump it at the FC; offer the hold flow.
function holdEligible(route, grade) {
  return route && grade && ["A", "B"].includes(grade.grade) && grade.resale_eligible && route.decision !== "RESELL_LOCAL";
}

/* Hold-at-RCC flow: the unit waits at the nearest RCC for the 1–2 day buyer window.
   "Skip 2 days" → no buyer → ship to FC for storage. "Customer" → pick a buyer on the
   map → backend decides dynamically (intercept vs FC) from the real distances. */
function HoldFlow({ route, order, grade }) {
  const { setRoute, go, toast } = useApp();
  const [mode, setMode] = useState("holding"); // holding | fc | intercept
  const [picking, setPicking] = useState(false);
  const [res, setRes] = useState(null);
  const geo = route.geography || {};

  async function onBuyer(p) {
    setPicking(false);
    const out = await api.routeIntercept({
      region: order.region, category: order.category, original_price: order.original_price,
      customer_lat: order.customer_lat, customer_lng: order.customer_lng, buyer_lat: p.lat, buyer_lng: p.lng,
    });
    if (!out || out._networkError || out._httpError) { toast("Intercept calc failed", "err"); return; }
    setRes(out); setMode("intercept");
  }

  function viewMap() {
    if (mode === "intercept" && res) setRoute(res);
    else if (mode === "fc") setRoute({ ...route, decision: "SHIP_TO_FC" });
    go("map");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-stack-lg">
      {picking && <LocationPicker initial={{ lat: order.customer_lat, lng: order.customer_lng }} onPick={onBuyer} onClose={() => setPicking(false)} />}
      <hr className="border-t border-outline-variant/30" />
      <section className="rounded-xl p-5 shadow-sm border bg-primary-container text-on-primary-container border-primary/20 flex flex-col gap-3">
        <div className="flex items-center gap-2"><Icon name="pause_circle" fill /><h3 className="font-headline-sm text-headline-sm font-semibold">Hold at {geo.nearest_rcc}</h3></div>
        <p className="font-body-md text-body-md opacity-90">Grade {grade.grade} · eligible for local resale. Holding the unit at <b>{geo.nearest_rcc}</b> for the 1–2 day local-buyer window instead of hauling it {fmt.km(geo.fc_distance_km)} to the FC.</p>

        {mode === "holding" && (
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button onClick={() => setMode("fc")} className="bg-surface/20 border border-on-primary-container/20 rounded-lg py-3 px-2 flex flex-col items-center gap-1 active:scale-[0.98] transition-transform">
              <Icon name="fast_forward" /><span className="font-label-bold text-label-bold">Skip 2 days</span>
              <span className="font-label-md text-label-md opacity-80 text-center">no buyer → FC storage</span>
            </button>
            <button onClick={() => setPicking(true)} className="bg-amber-action text-near-black rounded-lg py-3 px-2 flex flex-col items-center gap-1 active:scale-[0.98] transition-transform">
              <Icon name="person_pin_circle" /><span className="font-label-bold text-label-bold">Customer</span>
              <span className="font-label-md text-label-md opacity-80 text-center">pick buyer on map</span>
            </button>
          </div>
        )}

        {mode === "fc" && (
          <div className="bg-surface/15 rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2"><Icon name="warehouse" /><span className="font-label-bold text-label-bold">Window elapsed · no buyer</span></div>
            <p className="font-body-md text-body-md opacity-90">Shipping to <b>{geo.nearest_fc}</b> (~{fmt.km(geo.fc_distance_km)}) for storage / restock — it'll fulfil a future order from there.</p>
            <div className="flex gap-2 mt-1">
              <button onClick={viewMap} className="bg-amber-action text-near-black font-label-bold text-label-bold px-4 py-2 rounded-lg flex items-center gap-1">View route map <Icon name="arrow_forward" className="text-[16px]" /></button>
              <button onClick={() => setMode("holding")} className="border border-on-primary-container/30 text-on-primary-container font-label-bold text-label-bold px-4 py-2 rounded-lg">Keep holding</button>
            </div>
          </div>
        )}

        {mode === "intercept" && res && <InterceptOutcome res={res} onViewMap={viewMap} onRepick={() => setPicking(true)} />}
      </section>
    </motion.div>
  );
}

function InterceptOutcome({ res, onViewMap, onRepick }) {
  const win = res.decision === "RESELL_LOCAL";
  const e = res.economics || {}, m = res.match || {};
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface/15 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2"><Icon name={win ? "check_circle" : "local_shipping"} fill /><span className="font-label-bold text-label-bold">{win ? "Reroute the held unit to the buyer" : "Cheaper to ship to FC"}</span></div>
      <p className="font-body-md text-body-md opacity-90">{res.reason}</p>
      {win ? (
        <div className="grid grid-cols-3 gap-2">
          <Mini icon="payments" label="Saved" val={fmt.inr2(e.savings_inr)} />
          <Mini icon="co2" label="CO₂ saved" val={fmt.kg(e.co2_saved_kg)} />
          <Mini icon="near_me" label="Buyer" val={fmt.km(m.buyer_distance_km)} />
        </div>
      ) : (
        <div className="font-label-md text-label-md opacity-80">Buyer {fmt.km(m.buyer_distance_km)} away · intercept isn't cheaper than an FC reship here.</div>
      )}
      <div className="flex gap-2 mt-1">
        <button onClick={onViewMap} className="bg-amber-action text-near-black font-label-bold text-label-bold px-4 py-2 rounded-lg flex items-center gap-1">View route map <Icon name="arrow_forward" className="text-[16px]" /></button>
        <button onClick={onRepick} className="border border-on-primary-container/30 text-on-primary-container font-label-bold text-label-bold px-4 py-2 rounded-lg">Different buyer</button>
      </div>
    </motion.div>
  );
}

function GradeResult({ g }) {
  const lines = [
    `&gt; analyzing inspection images... <span class="text-success">ok</span>`,
    `&gt; defects detected: ${(g.defects && g.defects.length) || 0}`,
    `&gt; condition score: ${g.score}/10 → grade ${g.grade}`,
    `&gt; resale_eligible=${g.resale_eligible} · refurbish=${g.refurbish_recommended}`,
    `<span class="text-primary-fixed-dim">&gt; handing off to routing engine...</span>`,
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-stack-lg">
      <hr className="border-t border-outline-variant/30" />
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1"><Icon name="verified" className="text-[16px] text-success" /> Assessment Complete</h3>
          <span className="font-mono-code text-mono-code text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">{g.path || "visual"} · ref:{g.reference_source || "none"} · conf {(g.confidence || 0).toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-6">
          <Gauge score={g.score} />
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2"><GradeBadge grade={g.grade} /><span className="font-body-md text-body-md text-on-surface-variant">{CONDITION[g.grade]}</span></div>
            <div className="flex flex-wrap gap-2 mt-1"><DefectChips defects={g.defects} /></div>
          </div>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant border-t border-outline-variant/30 pt-3">{g.reasoning || g.notes}</p>
      </section>
      <TerminalLog lines={lines} />
    </motion.div>
  );
}

function RouteBanner({ r }) {
  const { go } = useApp();
  const isHold = r.decision === "RESELL_LOCAL";
  const dest = isHold ? `Drop at: ${r.geography.nearest_rcc}` : `Route to: ${r.geography.nearest_fc} (FC)`;
  const econ = r.economics || {};
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-stack-lg">
      <section className={`rounded-xl p-5 shadow-sm border flex flex-col gap-3 ${isHold ? "bg-primary-container text-on-primary-container border-primary/20" : "bg-surface-container-high text-on-surface border-outline-variant"}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-headline-sm text-headline-sm font-semibold flex items-center gap-2"><Icon name={isHold ? "route" : "local_shipping"} /> {dest}</h3>
          <span className={`font-mono-code text-mono-code px-2 py-0.5 rounded ${isHold ? "bg-surface/20" : "bg-surface border border-outline-variant"}`}>{r.decided_by}</span>
        </div>
        <div className={`self-start px-3 py-1.5 rounded font-label-bold text-label-bold border flex items-center gap-2 ${isHold ? "bg-surface/20 border-on-primary-container/20" : "bg-surface border-outline-variant"}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-action" /> {TAG[r.decision] || r.decision}
        </div>
        <p className="font-body-md text-body-md opacity-90">{r.reason || r.explanation}</p>
        {isHold && (
          <div className="grid grid-cols-3 gap-2 mt-1">
            <Mini icon="payments" label="Saved" val={fmt.inr2(econ.savings_inr)} />
            <Mini icon="co2" label="CO₂ saved" val={fmt.kg(econ.co2_saved_kg)} />
            <Mini icon="route" label="FC haul" val={fmt.km(r.geography.fc_distance_km)} />
          </div>
        )}
      </section>
      <motion.button whileTap={{ scale: 0.98 }} className="w-full bg-amber-action text-near-black font-headline-sm text-headline-sm font-bold py-4 rounded-lg flex items-center justify-center gap-2 shadow-md" onClick={() => go("map")}>
        {isHold ? "Confirm Drop-off · view savings map" : "View route map"} <Icon name="arrow_forward" />
      </motion.button>
    </motion.div>
  );
}

const Mini = ({ icon, label, val }) => (
  <div className="bg-surface/30 rounded-lg p-2 flex flex-col items-center text-center">
    <Icon name={icon} className="text-[18px]" /><span className="font-label-md text-label-md opacity-80 text-[10px] uppercase">{label}</span>
    <span className="font-headline-sm text-headline-sm">{val}</span>
  </div>
);
