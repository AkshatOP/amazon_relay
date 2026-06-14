import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useApp } from "../store";
import { api, fmt } from "../lib/api";
import { Icon, Spinner } from "../components/ui";
import { Thinking, useThinking } from "../components/Thinking";
import CameraModal from "../components/CameraModal";
import { iconFor } from "./P2PNudge";

const MAX = 5;
const WORD = { A: "Excellent", B: "Good", C: "Fair", D: "Poor" };

export default function P2PGrade() {
  const { p2p, setP2p, go, toast } = useApp();
  const purchase = p2p.purchase;
  const [photos, setPhotos] = useState([]);
  const [cam, setCam] = useState(false);
  const [result, setResult] = useState(null); // {g, listing}
  const { steps, thinking, run } = useThinking();
  const fileRef = useRef(null);

  if (!purchase) return <p className="p-4">Start from the Nudge screen.</p>;

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

  async function doGrade() {
    setResult(null);
    const out = await run(
      ["Scanning condition from your photos", "Detecting wear & surface defects", "Cross-checking the catalog reference", "Computing the Stage-2 resale price"],
      async () => {
        let g = photos.length > 0
          ? await api.grade(purchase.category, { inspection: photos }, purchase.asin)
          : await api.gradeFunctional(purchase.category, [true, true, true]);
        if (!g || g.grade === "ERROR" || g._networkError) return { error: "grade" };
        const listing = await api.list(purchase.id, g.grade, g.score, g.defects || [], p2p.simulateYears);
        if (!listing || listing.error || listing._networkError) return { error: listing?.error || "list" };
        return { g, listing };
      },
      { perStepMs: 900 }
    );
    if (out.error) { toast(out.error === "grade" ? "Grading failed" : out.error, "err"); return; }
    setP2p({ listing: out.listing });
    setResult(out);
  }

  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg">
      {cam && <CameraModal onCapture={(f) => addFiles([f])} onClose={() => setCam(false)} />}

      <div className="flex items-center gap-2"><button className="p-1 -ml-1 text-on-surface-variant" onClick={() => go("p2p-nudge")}><Icon name="arrow_back" /></button>
        <h2 className="font-headline-md text-headline-md text-on-surface">Grade Condition</h2></div>

      <div onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="relative bg-near-black rounded-xl overflow-hidden min-h-[240px] flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-transparent">
        {photos.length > 0 && <img src={URL.createObjectURL(photos[photos.length - 1])} alt="" className="absolute inset-0 w-full h-full object-contain bg-near-black" />}
        <div className="relative w-40 h-40 flex items-center justify-center pointer-events-none">
          {["top-0 left-0 border-t-4 border-l-4", "top-0 right-0 border-t-4 border-r-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map((c, i) => <div key={i} className={`absolute w-8 h-8 border-amber bracket-anim ${c}`} />)}
          {photos.length === 0 && <Icon name={iconFor(purchase.category)} className="text-[48px] text-white/70" />}
        </div>
        <span className="font-label-md text-label-md text-white/70 z-[5] text-center px-4">
          {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""} ready ✓ — tap Grade to analyze` : `Drag & drop up to ${MAX} photos, tap to choose, or use the live camera`}
        </span>
        {photos.length > 0 && <span className="absolute top-2 right-2 z-10 bg-amber text-near-black font-label-bold text-label-bold px-2 py-0.5 rounded-full">{photos.length}/{MAX}</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {photos.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-outline-variant">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center" onClick={(e) => { e.stopPropagation(); removeAt(i); }}><Icon name="close" className="text-[14px]" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="bg-surface border border-outline-variant rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-surface-container-low font-label-bold text-label-bold text-on-surface" onClick={() => fileRef.current?.click()}><Icon name="add_photo_alternate" className="text-[18px]" /> Add / drop photos</button>
        <button className="bg-surface border border-primary text-primary rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-surface-container-low font-label-bold text-label-bold" onClick={() => setCam(true)}><Icon name="photo_camera" className="text-[18px]" /> Live camera</button>
      </div>
      <p className="font-label-md text-label-md text-on-surface-variant -mt-1">Add 1–{MAX} photos (more angles + close-ups of any worn/damaged part grade more accurately). All photos go to the AI together. No photo → functional checklist grade.</p>

      <motion.button whileTap={{ scale: 0.98 }} disabled={thinking} className="w-full bg-primary text-on-primary py-3 rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-70" onClick={doGrade}>
        {thinking ? <Spinner label="Grading…" /> : <><Icon name="memory" /> Grade &amp; reveal Stage-2 price</>}
      </motion.button>

      {steps && <Thinking steps={steps} />}
      {!thinking && result && <HealthCard g={result.g} l={result.listing} go={go} />}
    </section>
  );
}

function HealthCard({ g, l, go }) {
  const hc = l.health_card || {};
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm flex flex-col gap-stack-md">
      <div className="flex justify-between items-end border-b border-outline-variant pb-stack-md">
        <div><p className="font-label-md text-label-md text-on-surface-variant">Condition</p>
          <p className="font-display-lg text-display-lg text-on-surface">{WORD[g.grade] || g.grade} <span className="text-primary">{(g.score || 0).toFixed(1)}</span></p></div>
        <div className="text-right"><p className="font-label-md text-label-md text-on-surface-variant">Stage-2 value</p>
          <p className="font-headline-md text-headline-md text-on-surface">{fmt.inr(l.asking_price)} {l.price_went_up && <span className="text-success text-sm">▲</span>}</p>
          <p className="font-label-md text-label-md text-on-surface-variant">from {fmt.inr(l.stage1_price)}</p></div>
      </div>
      <div className="bg-surface-container-low rounded-lg p-stack-md border border-outline-variant flex flex-col gap-stack-sm">
        <p className="font-label-bold text-label-bold text-on-surface flex items-center gap-2"><Icon name="verified" className="text-[16px] text-primary" /> Product Health Card</p>
        <div className="grid grid-cols-2 gap-stack-md mt-1">
          <HC k="Condition" v={hc.condition_summary} /><HC k="Warranty" v={hc.warranty} />
          <HC k="Age" v={hc.age_display} /><HC k="Defects" v={(hc.defects || []).join(", ")} />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">{(hc.trust_anchors || []).map((t, i) => <span key={i} className="bg-success/10 text-success border border-success/30 rounded px-2 py-0.5 font-label-md text-label-md">✓ {t}</span>)}</div>
        <p className="font-label-md text-label-md text-on-surface-variant mt-1">{l.price_note}</p>
      </div>
      <button className="w-full bg-amber-action text-near-black font-label-bold text-label-bold py-3 rounded-lg" onClick={() => go("p2p-handoff")}>List it → find a buyer</button>
    </motion.div>
  );
}
const HC = ({ k, v }) => <div><p className="font-label-md text-label-md text-on-surface-variant">{k}</p><p className="font-body-md text-body-md text-on-surface">{v || "—"}</p></div>;
