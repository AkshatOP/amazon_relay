import { useEffect, useState } from "react";
import { useApp } from "../store";
import { api, fmt } from "../lib/api";
import { Icon } from "../components/ui";

export default function Hub() {
  const { go } = useApp();
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.metrics().then((m) => { if (m && !m._networkError) setMetrics(m); });
    api.health().then((h) => setHealth(h));
  }, []);

  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg bg-surface">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-lg shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Sustainability Impact</p>
          <h2 className="font-display-lg text-display-lg text-on-surface mt-1">{metrics ? (metrics.co2_saved_kg || 0).toFixed(2) : "…"} <span className="font-headline-sm text-headline-sm text-on-surface-variant">kg</span></h2>
          <p className="font-body-md text-body-md text-primary mt-1">CO₂ saved · {metrics ? fmt.inr(metrics.money_saved_inr) : "…"} saved across {metrics ? metrics.returns_routed : "…"} returns</p>
        </div>
        <div className="relative w-20 h-20 flex items-center justify-center">
          <svg className="w-full h-full circular-progress" viewBox="0 0 36 36">
            <path className="text-surface-variant" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
          <Icon name="eco" className="text-primary text-[24px] absolute" fill />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-gutter">
        <button className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm flex flex-col gap-stack-sm text-left hover:bg-surface-container-low" onClick={() => go("p2p-nudge")}>
          <div className="w-10 h-10 bg-primary-container rounded-full flex items-center justify-center mb-1"><Icon name="history" className="text-on-primary-container" fill /></div>
          <p className="font-label-bold text-label-bold text-on-surface">Resell from Order History</p></button>
        <button className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm flex flex-col gap-stack-sm text-left hover:bg-surface-container-low" onClick={() => go("p2p-handoff")}>
          <div className="w-10 h-10 bg-secondary-container rounded-full flex items-center justify-center mb-1"><Icon name="inventory_2" className="text-on-secondary-container" fill /></div>
          <p className="font-label-bold text-label-bold text-on-surface">Active Listings</p>
          <p className="font-body-md text-body-md text-primary font-bold">{metrics ? `${metrics.active_listings} · ${fmt.inr(metrics.active_listing_value_inr)}` : "…"}</p></button>
      </div>

      <button className="bg-near-black border border-outline-variant rounded-lg p-stack-lg shadow-sm flex gap-stack-md relative overflow-hidden text-left" onClick={() => go("orders")}>
        <div className="absolute top-0 right-0 px-2 py-1 bg-primary text-white font-label-bold text-label-bold rounded-bl-lg text-[10px]">DEMO ENTRY</div>
        <div className="w-12 h-12 bg-[#2d3130] rounded-full flex items-center justify-center shrink-0 mt-2"><Icon name="bolt" className="text-amber" /></div>
        <div className="flex flex-col">
          <p className="font-body-md text-body-md text-white">Start the hero flow: a returned <span className="font-bold">niche shoe</span> with a nearby buyer.</p>
          <span className="mt-3 text-primary-fixed-dim font-label-bold text-label-bold flex items-center gap-1">Open order → return → rider grade <Icon name="arrow_forward" className="text-[16px]" /></span>
        </div>
      </button>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-lg">
        <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider mb-2">Live backend</p>
        <div className="font-mono-code text-mono-code text-on-surface-variant">
          {health ? (health.status === "ok"
            ? <>status: ok · model: {health.model}<br />db_ready: {String(health.db_ready)} · router_model: {String(health.router_model_trained)}</>
            : "backend unreachable") : "checking…"}
        </div>
      </div>
    </section>
  );
}
