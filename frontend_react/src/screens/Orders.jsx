import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../store";
import { fmt } from "../lib/api";
import { Icon, ProductImg } from "../components/ui";
import LocationPicker from "../components/LocationPicker";
import { DEMO_ITEMS, ICON_FOR } from "../lib/demoItems";

export default function Orders() {
  const { order, setOrder, setRoute, setGrade, go, toast } = useApp();
  const [picking, setPicking] = useState(false);   // map location picker
  const [itemsOpen, setItemsOpen] = useState(false); // item switcher

  function onPick({ lat, lng, area, region }) {
    setOrder({ customer_lat: lat, customer_lng: lng, customer_area: area, region });
    setRoute(null); // invalidate any prior routing — location changed
    setPicking(false);
    toast(`Pickup set: ${area} · ${region} region`, "ok");
  }

  function chooseItem(it) {
    // Swap the product fields only; keep the current pickup location. Clear stale grade/route.
    setOrder({ order_id: it.order_id, product_name: it.product_name, category: it.category, asin: it.asin, original_price: it.original_price });
    setGrade(null); setRoute(null);
    setItemsOpen(false);
    toast(`Item: ${it.product_name}`, "ok");
  }

  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-on-surface-variant cursor-pointer" onClick={() => go("hub")}>
          <Icon name="arrow_back" className="text-[20px]" /><span className="font-body-md text-body-md">Your Orders</span>
        </div>
        <button onClick={() => setItemsOpen((o) => !o)}
          className="flex items-center gap-1 text-primary font-label-bold text-label-bold border border-primary/30 rounded-full px-3 py-1.5 hover:bg-surface-container-low">
          <Icon name="swap_horiz" className="text-[18px]" /> Change item
        </button>
      </div>

      <AnimatePresence>
        {itemsOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden flex flex-col gap-1.5 bg-surface-container-low rounded-lg p-2 border border-outline-variant">
            <p className="font-label-md text-label-md text-on-surface-variant px-1">Pick a product to return (pickup location stays the same):</p>
            {DEMO_ITEMS.map((it) => {
              const active = it.asin === order.asin && it.order_id === order.order_id;
              return (
                <button key={it.order_id} onClick={() => chooseItem(it)}
                  className={`flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${active ? "bg-primary-container/30 border border-primary/30" : "hover:bg-surface-container"}`}>
                  <div className="relative overflow-hidden w-11 h-11 rounded bg-surface-container flex items-center justify-center text-on-surface-variant border border-outline-variant/50 flex-shrink-0">
                    <ProductImg asin={it.asin} icon={it.icon} iconClass="text-[20px]" />
                  </div>
                  <div className="flex flex-col flex-grow">
                    <span className="font-body-md text-body-md text-on-surface leading-tight">{it.product_name}</span>
                    <span className="font-label-md text-label-md text-on-surface-variant">{it.category} · {fmt.inr(it.original_price)}</span>
                  </div>
                  {active && <Icon name="check_circle" className="text-primary" fill />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-stack-md">
        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success"><Icon name="check_circle" className="text-[18px]" /></div>
        <div><h2 className="font-headline-sm text-headline-sm text-on-surface">Delivered</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Handed directly to resident.</p></div>
      </div>

      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm flex gap-container-margin items-start">
        <div className="relative overflow-hidden w-[80px] h-[80px] rounded bg-surface-container flex-shrink-0 border border-outline-variant/50 flex items-center justify-center text-on-surface-variant">
          <ProductImg asin={order.asin} icon={ICON_FOR(order.category)} />
        </div>
        <div className="flex flex-col gap-stack-sm flex-grow">
          <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight">{order.product_name}</h3>
          <div className="font-body-md text-body-md text-on-surface-variant">{order.category}</div>
          <div className="font-label-bold text-label-bold text-on-surface mt-1">{fmt.inr(order.original_price)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-stack-md">
        <Row k="Order ID" v={`#${order.order_id}`} />
        <div className="flex justify-between items-start py-2 border-b border-outline-variant/30">
          <span className="font-body-md text-body-md text-on-surface-variant">Pickup address</span>
          <div className="flex flex-col items-end gap-1">
            <span className="font-label-bold text-label-bold text-on-surface">{order.customer_area} · {order.region === "bengaluru" ? "Bengaluru" : "Udupi"}</span>
            <span className="font-mono-code text-mono-code text-on-surface-variant">{order.customer_lat}, {order.customer_lng}</span>
            <button onClick={() => setPicking(true)} className="flex items-center gap-1 text-primary font-label-bold text-label-bold mt-0.5">
              <Icon name="edit_location_alt" className="text-[16px]" /> Change on map
            </button>
          </div>
        </div>
      </div>

      {picking && <LocationPicker initial={{ lat: order.customer_lat, lng: order.customer_lng }} onPick={onPick} onClose={() => setPicking(false)} />}

      <button className="w-full bg-amber-action text-near-black font-label-bold text-label-bold py-4 rounded-lg flex items-center justify-center gap-2 shadow-[inset_0_-2px_0_rgba(0,0,0,0.1)] active:translate-y-[1px] transition-all" onClick={() => go("return")}>
        Return this product <Icon name="arrow_forward" className="text-[18px]" />
      </button>
      <p className="font-label-md text-label-md text-on-surface-variant text-center">Use "Change item" to return a different product — each has its own catalog reference photo.</p>
    </section>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
    <span className="font-body-md text-body-md text-on-surface-variant">{k}</span>
    <span className="font-label-bold text-label-bold text-on-surface">{v}</span>
  </div>
);
