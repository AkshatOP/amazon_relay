import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "../store";
import { api, fmt } from "../lib/api";
import { Icon, ProductImg, Spinner } from "../components/ui";
import { Thinking, useThinking } from "../components/Thinking";

const ICON = { baby_walker: "child_friendly", shoes: "footprint", headphones: "headphones", laptop: "laptop_mac", camera: "photo_camera", watch: "watch" };
export const iconFor = (c) => ICON[c] || "inventory_2";

export default function P2PNudge() {
  const { p2p, setP2p, go, toast } = useApp();
  const [loading, setLoading] = useState(true);
  const [sy, setSy] = useState(p2p.simulateYears);
  const [listingBusy, setListingBusy] = useState(false);
  const { steps, thinking, run } = useThinking();
  const purchase = p2p.purchase;

  useEffect(() => {
    let alive = true;
    api.purchases().then((res) => {
      if (!alive) return;
      const list = (res && res.purchases) || [];
      const p = list.find((x) => x.category === "baby_walker") || list[0] || null;
      setP2p({ purchase: p });
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doNudge() {
    if (!purchase) return;
    setP2p({ simulateYears: sy, nudge: null });
    const n = await run(
      ["Reading your purchase history", "Checking the category resale window", "Estimating a fair market value"],
      () => api.nudge(purchase.id, sy)
    );
    if (!n || n._networkError || n.error) { toast(n?.error || "nudge failed", "err"); return; }
    setP2p({ nudge: n });
  }

  // Skip grading: list the item as-is at the Stage-1 (Grade C) estimate, then go straight to
  // the demand/handoff flow. Grade C → asking price == the Stage-1 estimate already shown.
  async function listAsIs() {
    if (!purchase) return;
    setListingBusy(true);
    const out = await api.list(purchase.id, "C", 5.0, [], sy);
    setListingBusy(false);
    if (!out || out.error || out._networkError) { toast(out?.error || "listing failed", "err"); return; }
    setP2p({ listing: out, simulateYears: sy });
    go("p2p-handoff");
  }

  if (loading) return <div className="flex items-center justify-center p-8 text-on-surface-variant gap-2"><Icon name="autorenew" className="animate-spin" /> loading purchases…</div>;
  if (!purchase) return <p className="p-4 text-on-surface-variant">No purchases seeded. Run <code>python -m backend.seed.seed_all</code>.</p>;

  const n = p2p.nudge;
  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg">
      <h2 className="font-headline-md text-headline-md text-primary">P2P Exchange</h2>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md flex flex-col gap-stack-sm shadow-sm">
        <div className="relative overflow-hidden h-40 bg-surface-container rounded-md flex items-center justify-center text-on-surface-variant">
          <ProductImg asin={purchase.asin} icon={iconFor(purchase.category)} iconClass="text-[56px]" fit="contain" />
        </div>
        <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2">{purchase.item_name}</h3>
        <p className="font-body-md text-body-md text-on-surface-variant">Purchased: {purchase.purchase_date} · MRP {fmt.inr(purchase.original_price)}</p>
        <div className="flex items-center gap-2 mt-2">
          <label className="font-label-md text-label-md text-on-surface-variant">Simulate years:</label>
          <input type="number" step="0.5" min="0" max="12" value={sy} onChange={(e) => setSy(parseFloat(e.target.value) || 0)}
            className="w-20 border border-outline-variant rounded p-1.5 font-body-md text-body-md" />
          <button disabled={thinking} className="ml-auto bg-primary text-on-primary font-label-bold text-label-bold py-2 px-4 rounded-full flex items-center gap-1 disabled:opacity-70" onClick={doNudge}>
            {thinking ? <Spinner label="…" /> : <><Icon name="update" className="text-[18px]" /> Simulate</>}
          </button>
        </div>
      </div>

      {steps && <Thinking steps={steps} />}

      {!thinking && n && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg p-container-margin flex flex-col gap-stack-lg">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.in_window ? "bg-secondary-container" : "bg-surface-container-high"}`}>
              <Icon name={n.in_window ? "notifications_active" : "schedule"} className="text-on-secondary-container" /></div>
            <p className="font-body-md text-body-md text-on-surface">{n.message}</p>
          </div>
          <div className="text-center bg-amber/10 rounded-lg py-3">
            <div className="font-display-lg text-display-lg text-on-surface">{fmt.inr(n.estimated_price)}</div>
            <div className="font-label-md text-label-md text-on-surface-variant">Stage-1 estimate (assumes Grade C — grading can raise it)</div>
          </div>
          <button className="w-full bg-transparent border border-primary text-primary font-label-bold text-label-bold py-3 rounded-lg flex justify-center items-center gap-2" onClick={() => go("p2p-grade")}>
            Scan to grade for a higher price <Icon name="arrow_forward" className="text-[18px]" />
          </button>
          <button disabled={listingBusy} className="w-full bg-amber-action text-near-black font-label-bold text-label-bold py-3 rounded-lg flex justify-center items-center gap-2 disabled:opacity-70" onClick={listAsIs}>
            {listingBusy ? <Spinner label="Listing…" /> : <>List as-is at this price &amp; find a buyer <Icon name="sell" className="text-[18px]" /></>}
          </button>
          <p className="font-label-md text-label-md text-on-surface-variant text-center -mt-1">Skips grading — lists at the Stage-1 (Grade&nbsp;C) estimate.</p>
        </motion.div>
      )}
    </section>
  );
}
