import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useApp } from "../store";
import { api, fmt } from "../lib/api";
import { Icon, Spinner } from "../components/ui";
import { Thinking, useThinking } from "../components/Thinking";
import CameraModal from "../components/CameraModal";

const WORD = { A: "Excellent", B: "Good", C: "Fair", D: "Poor" };
const MAX = 5;  // maximum photos sent to the AI (3 named slots + up to 2 extra)
// Photo slots — front & back are mandatory; a defected-part close-up is optional but improves grading.
const SLOT_DEFS = [
  { key: "front", label: "Front", required: true },
  { key: "back", label: "Back", required: true },
  { key: "defected_part", label: "Defected part", required: false },
];

export default function P2PGrade() {
  const { p2p, setP2p, go, toast } = useApp();
  const purchase = p2p.purchase;
  const [slots, setSlots] = useState({ front: null, back: null, defected_part: null });
  const [extras, setExtras] = useState([]);  // photos beyond the 3 named slots (up to MAX total)
  const [cam, setCam] = useState(false);
  const [result, setResult] = useState(null); // {g, listing}
  const { steps, thinking, run } = useThinking();
  const fileRef = useRef(null);       // single-file picker for tapping a named slot
  const uploadRef = useRef(null);     // multi-file picker for the "Upload photos" button
  const targetSlot = useRef("front"); // which slot the slot-tap picker fills

  if (!purchase) return <p className="p-4">Start from the Nudge screen.</p>;

  // Front & back are mandatory; all filled slots + extras (max MAX total) go to the AI together.
  const photos = [slots.front, slots.back, slots.defected_part, ...extras].filter(Boolean);
  const count = photos.length;
  const ready = Boolean(slots.front && slots.back);

  const pick = (key) => { targetSlot.current = key; fileRef.current?.click(); };
  const setSlot = (key, file) => setSlots((s) => ({ ...s, [key]: file }));
  const clearSlot = (key) => setSlots((s) => ({ ...s, [key]: null }));
  const clearExtra = (i) => setExtras((x) => x.filter((_, idx) => idx !== i));

  function onPicked(list) {  // slot tap → replace just that one slot
    const f = [...(list || [])].find((x) => x.type.startsWith("image/"));
    if (f) setSlot(targetSlot.current, f);
  }

  // "Upload photos" / camera: route each image to the first empty named slot, then to extras,
  // capping the total at MAX. Computed from current state so multi-select batches correctly.
  function addPhotos(list) {
    const imgs = [...(list || [])].filter((x) => x.type.startsWith("image/"));
    if (!imgs.length) return;
    const nextSlots = { ...slots };
    const nextExtras = [...extras];
    let total = count;
    let overflow = false;
    for (const f of imgs) {
      const emptyKey = SLOT_DEFS.find((s) => !nextSlots[s.key])?.key;
      if (emptyKey) { nextSlots[emptyKey] = f; total += 1; continue; }
      if (total >= MAX) { overflow = true; break; }
      nextExtras.push(f); total += 1;
    }
    setSlots(nextSlots);
    setExtras(nextExtras);
    if (overflow) toast(`Maximum ${MAX} photos`, "info");
  }

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
      {cam && <CameraModal onCapture={(f) => addPhotos([f])} onClose={() => setCam(false)} />}

      <div className="flex items-center gap-2"><button className="p-1 -ml-1 text-on-surface-variant" onClick={() => go("p2p-nudge")}><Icon name="arrow_back" /></button>
        <h2 className="font-headline-md text-headline-md text-on-surface">Grade Condition</h2></div>

      {/* Three photo slots — Front & Back mandatory, Defected part optional. All filled slots
          are sent to the AI together. Tap a slot to choose a file, or use the live camera. */}
      <div className="grid grid-cols-3 gap-3">
        {SLOT_DEFS.map(({ key, label, required }) => {
          const file = slots[key];
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <button type="button" onClick={() => pick(key)}
                className={`relative aspect-square rounded-xl overflow-hidden flex flex-col items-center justify-center gap-1 border-2 transition-colors ${file ? "border-primary bg-surface-container-low" : "border-dashed border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"}`}>
                {file ? (
                  <>
                    <img src={URL.createObjectURL(file)} alt={label} className="absolute inset-0 w-full h-full object-cover" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); clearSlot(key); }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center z-10"><Icon name="close" className="text-[15px]" /></button>
                  </>
                ) : (
                  <>
                    <Icon name="add_a_photo" className="text-[26px] text-on-surface-variant" />
                    <span className="font-label-md text-label-md text-on-surface-variant text-center leading-tight px-1">{label}</span>
                  </>
                )}
              </button>
              <span className="font-label-md text-label-md flex items-center justify-center gap-1">
                <Icon name={file ? "check_circle" : required ? "error" : "add_circle"} fill className={`text-[13px] ${file ? "text-success" : required ? "text-amber" : "text-on-surface-variant"}`} />
                <span className={file ? "text-on-surface" : "text-on-surface-variant"}>{label}{required ? " *" : ""}</span>
              </span>
            </div>
          );
        })}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onPicked(e.target.files); e.target.value = ""; }} />
      <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />

      {/* Extra photos beyond the 3 named slots (up to MAX total). */}
      {extras.length > 0 && (
        <div className="grid grid-cols-5 gap-2 -mt-1">
          {extras.map((f, i) => (
            <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-outline-variant">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button type="button" className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center" onClick={() => clearExtra(i)}><Icon name="close" className="text-[13px]" /></button>
            </div>
          ))}
        </div>
      )}

      <button className="bg-surface border border-outline-variant text-on-surface rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-surface-container-low font-label-bold text-label-bold disabled:opacity-50" disabled={count >= MAX} onClick={() => uploadRef.current?.click()}><Icon name="upload" className="text-[18px]" /> Upload photos</button>
      <button className="bg-surface border border-primary text-primary rounded-lg py-3 flex items-center justify-center gap-2 hover:bg-surface-container-low font-label-bold text-label-bold disabled:opacity-50 -mt-2" disabled={count >= MAX} onClick={() => setCam(true)}><Icon name="photo_camera" className="text-[18px]" /> Live camera</button>

      <p className="font-label-md text-label-md text-on-surface-variant -mt-1">
        <span className="font-label-bold text-on-surface">Front and back photos are mandatory</span> (minimum 3 photos, maximum {MAX} — add a close-up of any worn/defected part for a more accurate grade). All photos go to the AI together. <span className="text-on-surface">{count}/{MAX} added.</span>
      </p>

      <motion.button whileTap={{ scale: 0.98 }} disabled={thinking || !ready} className="w-full bg-primary text-on-primary py-3 rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-50" onClick={doGrade}>
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
