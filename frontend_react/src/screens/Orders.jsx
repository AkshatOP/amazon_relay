import { useState } from "react";
import { useApp } from "../store";
import { fmt } from "../lib/api";
import { Icon, ProductImg } from "../components/ui";
import LocationPicker from "../components/LocationPicker";

export default function Orders() {
  const { order, setOrder, setRoute, go, toast } = useApp();
  const [picking, setPicking] = useState(false);
  const isShoe = order.category === "shoes" || order.category === "footwear";

  function onPick({ lat, lng, area, region }) {
    setOrder({ customer_lat: lat, customer_lng: lng, customer_area: area, region });
    setRoute(null); // invalidate any prior routing — location changed
    setPicking(false);
    toast(`Pickup set: ${area} · ${region} region`, "ok");
  }

  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg">
      <div className="flex items-center gap-2 text-on-surface-variant cursor-pointer" onClick={() => go("hub")}>
        <Icon name="arrow_back" className="text-[20px]" /><span className="font-body-md text-body-md">Your Orders</span>
      </div>
      <div className="flex items-center gap-stack-md">
        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success"><Icon name="check_circle" className="text-[18px]" /></div>
        <div><h2 className="font-headline-sm text-headline-sm text-on-surface">Delivered</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">Handed directly to resident.</p></div>
      </div>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm flex gap-container-margin items-start">
        <div className="relative overflow-hidden w-[80px] h-[80px] rounded bg-surface-container flex-shrink-0 border border-outline-variant/50 flex items-center justify-center text-on-surface-variant">
          <ProductImg asin={order.asin} icon={isShoe ? "footprint" : "inventory_2"} />
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
      <p className="font-label-md text-label-md text-on-surface-variant text-center">Demo order = the seeded Udupi niche shoe (the scenario with a nearby buyer).</p>
    </section>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
    <span className="font-body-md text-body-md text-on-surface-variant">{k}</span>
    <span className="font-label-bold text-label-bold text-on-surface">{v}</span>
  </div>
);
