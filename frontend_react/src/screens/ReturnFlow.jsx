import { useState } from "react";
import { useApp } from "../store";
import { Icon, ProductImg } from "../components/ui";

const ELECTRONIC = new Set(["headphones", "laptop", "camera", "charger", "power_bank", "speaker", "smartphone", "baby_monitor", "appliance", "mouse", "keyboard"]);

export default function ReturnFlow() {
  const { order, go } = useApp();
  const isElectronic = ELECTRONIC.has(order.category);
  const [powerOn, setPowerOn] = useState(true);
  const [damage, setDamage] = useState(false);

  return (
    <section className="p-container-margin pb-[100px] flex flex-col gap-stack-lg">
      <div className="flex items-center gap-2 text-on-surface">
        <button className="p-1 -ml-1 text-on-surface-variant rounded-full" onClick={() => go("orders")}><Icon name="close" /></button>
        <h2 className="font-headline-md text-headline-md">Initiate Return</h2>
      </div>
      <div className="flex gap-container-margin items-center p-3 bg-surface rounded-lg border border-outline-variant/30">
        <div className="relative overflow-hidden w-12 h-12 rounded bg-surface-container flex items-center justify-center text-on-surface-variant border border-outline-variant/50">
          <ProductImg asin={order.asin} icon={isElectronic ? "inventory_2" : "footprint"} iconClass="text-[20px]" />
        </div>
        <div className="font-body-md text-body-md text-on-surface font-medium">{order.product_name}</div>
      </div>
      <div className="flex flex-col gap-stack-sm">
        <label className="font-label-bold text-label-bold text-on-surface-variant">Reason for return</label>
        <div className="relative">
          <select className="w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg p-3 pr-10 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary">
            <option>Performance not as expected</option><option>Item damaged on arrival</option>
            <option>No longer needed</option><option>Inaccurate description</option>
          </select>
          <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
        </div>
      </div>
      {isElectronic && (
        <div className="flex flex-col gap-stack-md">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Device Condition</h3>
          <CondRow label="Does it power on?" yes={powerOn} onChange={setPowerOn} />
          <CondRow label="Any physical damage?" yes={damage} onChange={setDamage} />
          <p className="font-label-md text-label-md text-on-surface-variant">Branched because <b>{order.category}</b> is an electronic item.</p>
        </div>
      )}
      <div className="bg-[#F1F8F6] border border-primary/20 rounded-xl p-container-margin flex flex-col items-center text-center gap-stack-md mt-2">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-primary"><Icon name="calendar_today" className="text-[24px]" /></div>
        <h4 className="font-headline-sm text-headline-sm text-on-surface">Pickup Scheduled</h4>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-[220px]">A rider will collect this in 2–4 days.</p>
      </div>
      <button className="w-full bg-primary text-on-primary font-label-bold text-label-bold py-3.5 rounded-lg shadow-sm" onClick={() => go("rider")}>Confirm Return → Rider flow</button>
    </section>
  );
}

function CondRow({ label, yes, onChange }) {
  return (
    <div className="flex items-center justify-between p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
      <span className="font-body-md text-body-md text-on-surface">{label}</span>
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => onChange(v)}
            className={`px-4 py-1.5 rounded-full font-label-bold text-label-bold border ${yes === v ? "bg-primary-container text-on-primary-container border-primary/20" : "bg-surface text-on-surface-variant border-outline-variant/50"}`}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}
