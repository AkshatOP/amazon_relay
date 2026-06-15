import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "../store";
import { api, fmt } from "../lib/api";
import { coordFor } from "../lib/coords";
import { Icon, Spinner } from "../components/ui";
import { Thinking, useThinking } from "../components/Thinking";

export default function P2PHandoff() {
  const { p2p, go, toast } = useApp();
  const listing = p2p.listing;
  const [buyer, setBuyer] = useState(null);
  const [handoff, setHandoff] = useState(null);
  const demandT = useThinking();
  const handoffT = useThinking();

  if (!listing) return <p className="p-4">List an item first (Grade screen).</p>;

  async function findDemand() {
    setBuyer(null); setHandoff(null);
    const find = await demandT.run(
      ["Broadcasting the listing to nearby buyers", "Matching demand within 12 km", "Confirming the closest match"],
      async () => { await api.demandGenerate(listing.listing_id); return api.demandFind(listing.listing_id); }
    );
    if (!find || find.error || !find.buyers || find.buyers.length === 0) { toast("No buyers found in range", "info"); return; }
    setBuyer(find.buyers[0]);
  }

  async function confirmHandoff() {
    const station = coordFor(listing.station_id === "UDUPI_CITY" ? "Udupi City (Service Bus Stand)" : listing.station_id)
      || coordFor("Udupi City (Service Bus Stand)") || [13.3409, 74.7421];
    const h = await handoffT.run(
      ["Reserving a local-station handoff slot", "Computing the avoided FC haul + CO₂", "Finalizing the seller payout & green credits"],
      () => api.handoff({
        listing_id: listing.listing_id, demand_id: buyer.demand_id,
        seller_lat: station[0], seller_lng: station[1],
        buyer_lat: buyer.lat || station[0], buyer_lng: buyer.lng || station[1],
      })
    );
    if (!h || h.error || h._networkError) { toast(h?.error || "handoff failed", "err"); return; }
    setHandoff(h);
  }

  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg">
      <div className="flex items-center gap-2"><button className="p-1 -ml-1 text-on-surface-variant" onClick={() => go("p2p-grade")}><Icon name="arrow_back" /></button>
        <h2 className="font-headline-md text-headline-md text-on-surface">P2P Handoff</h2></div>
      <p className="font-body-md text-body-md text-on-surface-variant">Listed: {listing.item_name} · {fmt.inr(listing.asking_price)}</p>

      <button disabled={demandT.thinking} className="w-full bg-surface border border-outline-variant rounded-lg py-3 px-4 flex items-center justify-center gap-2 hover:bg-surface-container-low disabled:opacity-70" onClick={findDemand}>
        {demandT.thinking ? <Spinner label="Scanning network…" /> : <><Icon name="radar" className="text-primary" /><span className="font-label-bold text-label-bold text-primary">Simulate nearby demand</span></>}
      </button>

      {demandT.steps && <Thinking steps={demandT.steps} />}

      {!demandT.thinking && buyer && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-stack-lg">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-secondary-container flex items-center justify-center"><Icon name="person" className="text-primary-container" fill /></div>
              <div><h3 className="font-headline-sm text-headline-sm text-on-surface">Match found!</h3>
                <p className="font-body-md text-body-md text-on-surface-variant">{buyer.buyer_name} · <span className="font-bold text-primary">{fmt.km(buyer.road_km)} away</span> · budget {fmt.inr(buyer.max_budget)}</p></div>
            </div>
          </div>
          <AnimatedRoute buyer={buyer} />
          <motion.button whileTap={{ scale: 0.98 }} disabled={handoffT.thinking} className="w-full bg-primary text-on-primary font-headline-sm text-headline-sm py-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70" onClick={confirmHandoff}>
            {handoffT.thinking ? <Spinner label="Finalizing…" /> : <><Icon name="handshake" /> Confirm Handoff</>}
          </motion.button>
        </motion.div>
      )}

      {handoffT.steps && <Thinking steps={handoffT.steps} />}
      {!handoffT.thinking && handoff && <HandoffResult h={handoff} />}
    </section>
  );
}

function HandoffResult({ h }) {
  const fin = h.financials || {}, legs = h.legs || {}, co2 = h.co2 || {}, gc = h.green_credits || {};
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container-low border border-primary-fixed-dim rounded-lg p-4 flex flex-col gap-stack-md">
      <div className="flex items-center gap-2"><Icon name="check_circle" className="text-primary" fill /><span className="font-headline-sm text-headline-sm text-on-surface">Handoff confirmed</span></div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <FStat k="Distance" v={fmt.km(legs.total_km)} /><FStat k="Platform fee" v={fmt.inr(fin.platform_fee)} /><FStat k="Seller payout" v={fmt.inr(fin.seller_payout)} />
      </div>
      <div className="bg-primary-fixed/40 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon name="eco" className="text-primary" fill />
          <div><div className="font-headline-sm text-headline-sm text-on-surface">+{(gc.credits_rs || 0).toLocaleString("en-IN")} credits earned</div>
            <div className="font-label-md text-label-md text-on-surface-variant">{fmt.kg(co2.saved_kg)} CO₂ saved vs a fresh unit from the {fmt.km(co2.fc_road_km_used)} FC haul</div></div></div>
        <span className="font-headline-md text-headline-md font-bold text-primary">{fmt.inr(fin.total_seller_value)}</span>
      </div>
      <p className="font-label-md text-label-md text-on-surface-variant">{h.logistics_note}</p>
    </motion.div>
  );
}

/* Animated journey (plays ONCE): a package rides the line Seller → Local Station → Buyer,
   pausing at the station. Phase drives which legs are lit; once it reaches the buyer BOTH
   captions stay fully lit (phase 2 = done). */
function AnimatedRoute({ buyer }) {
  const [phase, setPhase] = useState(0); // 0 collecting, 1 shipping, 2 done (both lit)
  const DUR = 3.2;                       // seconds for the full Seller→Buyer pass
  useEffect(() => {
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), DUR * 1000 * 0.5);
    const t2 = setTimeout(() => setPhase(2), DUR * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const collectDays = 2;  // illustrative rider-pickup window (matches "2–4 days" copy)
  const shipDays = 1;     // same-town delivery
  const dot = (active) => `absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-primary z-10 flex items-center justify-center transition-colors duration-500 ${active ? "bg-primary" : "bg-surface"}`;

  return (
    <div className="bg-surface border border-outline-variant rounded-lg p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <span className="font-label-md text-label-md text-on-surface-variant">Routing</span>
        <span className="bg-surface-variant px-2 py-1 rounded text-[10px] uppercase tracking-wide font-bold">same-town · near-zero haul</span>
      </div>

      {/* track */}
      <div className="relative h-7 mx-1">
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-surface-variant rounded-full" />
        <motion.div className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] bg-primary rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: ["0%", "48%", "52%", "100%"] }}
          transition={{ duration: DUR, times: [0, 0.42, 0.58, 1], ease: "easeInOut" }}>
          {/* package rides the leading edge of the fill (single pass, then settles at Buyer) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md">
            <Icon name="inventory_2" className="text-[15px]" fill />
          </div>
        </motion.div>
        <span className={`${dot(true)} left-0`} />
        <span className={`${dot(phase >= 1)} left-1/2 -translate-x-1/2`}><Icon name="storefront" className={`text-[9px] ${phase >= 1 ? "text-on-primary" : "text-primary"}`} /></span>
        <span className={`${dot(phase >= 2)} right-0`} />
      </div>

      <div className="flex justify-between font-mono-code text-mono-code text-on-surface-variant px-0.5">
        <span>Seller</span><span>Local Station</span><span>Buyer</span>
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        {/* collect leg lit throughout (it's first + completes); ship leg lights once reached */}
        <Cap active icon="electric_scooter" title="Rider collects from seller" sub={`~${collectDays} days after listing`} />
        <Cap active={phase >= 1} icon="local_shipping" title="Ships to buyer (same town)"
          sub={`+~${shipDays} day${shipDays > 1 ? "s" : ""}${buyer?.road_km != null ? ` · ${buyer.road_km} km` : ""}`} />
      </div>
    </div>
  );
}

function Cap({ active, icon, title, sub }) {
  return (
    <motion.div animate={{ opacity: active ? 1 : 0.4 }} transition={{ duration: 0.4 }} className="flex items-center gap-2">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${active ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-on-surface-variant"}`}>
        <Icon name={icon} className="text-[16px]" fill={active} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="font-body-md text-body-md text-on-surface">{title}</span>
        <span className="font-label-md text-label-md text-on-surface-variant">{sub}</span>
      </div>
    </motion.div>
  );
}
const FStat = ({ k, v }) => <div className="bg-surface-container-lowest rounded p-2"><div className="font-label-md text-label-md text-on-surface-variant text-[10px] uppercase">{k}</div><div className="font-headline-sm text-headline-sm text-on-surface">{v}</div></div>;
