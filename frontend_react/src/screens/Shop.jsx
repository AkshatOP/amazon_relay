import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../store";
import { fmt } from "../lib/api";
import { ICON_FOR } from "../lib/demoItems";
import { Icon, ProductImg } from "../components/ui";
import HealthCard from "../components/HealthCard";

/* Buyer shopping screen: a normal Amazon-like shoe browse list where ONE unit is an Amazon
   Relay second-life (second-hand + refurbished) item. Tapping its "Second Hand" tag expands
   the real Product Health Card inline (same shared component the grader/P2P produce). */

// Static demo store listing (context — these are just normal "New" products).
const NEW_SHOES = [
  { name: "Metro Runner — Road Running Shoes", price: 3499, rating: 4.3, icon: "footprint", img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=240&q=70&auto=format&fit=crop" },
  { name: "TrailGrip Hiking Shoes", price: 4999, rating: 4.6, icon: "footprint", img: "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=240&q=70&auto=format&fit=crop" },
  { name: "EveryDay Canvas Sneakers", price: 1799, rating: 4.1, icon: "footprint", img: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=240&q=70&auto=format&fit=crop" },
  { name: "ProCourt Tennis Shoes", price: 5499, rating: 4.5, icon: "footprint", img: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=240&q=70&auto=format&fit=crop" },
];

// Seeded Health Card for the second-life unit — used when no live listing is in state.
// Renders through the SAME <HealthCard/> as the grader output, so it looks identical.
// TODO: wire to a real listing endpoint (GET /p2p/listing/{id}) when a listing id is available.
const SEED_HEALTH = {
  item_name: "Trail Runner Shoes (niche brand)",
  grade: "A", score: 10, confidence: 1.0, defects: [],
  reasoning:
    "Returned unused and still sealed in its original clear plastic packaging. No cosmetic marks, " +
    "no structural wear; sole, stitching, and eyelets all intact. Effectively new.",
  condition_summary: "Grade A — Excellent (near-new)",
  age_display: "0.2 years old",
  purchase_date: "2026-04-30",
  has_original_bill: true,
  warranty: "Brand warranty not applicable (footwear)",
  trust_anchors: ["Original purchase bill (price & date verified)", "Graded by Relay HUB AI"],
  provenance: "visual · ref:catalog · conf 1.00",
  verified_by: "Relay HUB grading AI",
  original_price: 2499,
  asking_price: 1299,
};

export default function Shop() {
  const { p2p } = useApp();
  const [open, setOpen] = useState(false);

  // Prefer a real graded listing from an earlier flow; else the seeded demo card. Either way
  // it renders through the shared <HealthCard/> so the buyer sees the actual card shape.
  const live = p2p.listing && p2p.listing.health_card;
  const healthCard = live
    ? { ...p2p.listing.health_card, provenance: "visual · ref:catalog", asking_price: p2p.listing.asking_price }
    : SEED_HEALTH;

  // Image + icon track the ACTUAL listed unit. The live listing is built from p2p.purchase, so
  // use that purchase's ASIN/category (e.g. a baby monitor shows its catalog photo, not the seed
  // shoe). The photo loads via GET /catalog/image/{asin}; ProductImg falls back to the icon.
  const unitAsin = live ? (p2p.purchase?.asin || "") : "B0SH_UDUPI_NICHE";
  const unitIcon = live ? ICON_FOR(p2p.purchase?.category || healthCard.category) : "footprint";

  return (
    <section className="p-container-margin pb-stack-xl flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-md text-headline-md text-on-surface">Relay HUB Store</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">Verified second-life deals &amp; new arrivals</p>
      </div>

      {/* The ONE second-life unit — sits in the list like any product, but trust-tagged. */}
      <article className="bg-surface-container-lowest border border-primary/30 rounded-lg shadow-sm overflow-hidden">
        <div className="p-container-margin flex gap-container-margin items-start">
          <div className="relative overflow-hidden w-[84px] h-[84px] rounded bg-surface-container flex-shrink-0 border border-outline-variant/50 flex items-center justify-center text-on-surface-variant">
            <ProductImg asin={unitAsin} icon={unitIcon} iconClass="text-[36px]" />
          </div>
          <div className="flex flex-col gap-1 flex-grow">
            <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight">{healthCard.item_name || "Trail Runner Shoes"}</h3>
            <Stars rating={4.7} count={1} />
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-headline-sm text-headline-sm text-on-surface">{fmt.inr(healthCard.asking_price)}</span>
              {healthCard.original_price > healthCard.asking_price && (
                <span className="font-body-md text-body-md text-on-surface-variant line-through">{fmt.inr(healthCard.original_price)}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <TrustTag label="Previously Owned" onClick={() => setOpen((o) => !o)} />
            </div>
            <p className="font-label-md text-label-md text-on-surface-variant mt-1 flex items-center gap-1">
              <Icon name="verified" className="text-[14px] text-primary" fill /> Graded &amp; verified by Relay HUB AI
            </p>
          </div>
        </div>

        <button onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-center gap-1 py-2 border-t border-outline-variant/40 text-primary font-label-bold text-label-bold hover:bg-surface-container-low">
          {open ? "Hide Health Card" : "View Health Card"} <Icon name={open ? "expand_less" : "expand_more"} className="text-[18px]" />
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="p-container-margin pt-0"><HealthCard card={healthCard} /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>

      {/* Normal "New" products (static context). */}
      {NEW_SHOES.map((s, i) => (
        <article key={i} className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-sm p-container-margin flex gap-container-margin items-start">
          <div className="relative overflow-hidden w-[84px] h-[84px] rounded bg-surface-container flex-shrink-0 border border-outline-variant/50 flex items-center justify-center text-on-surface-variant">
            <Thumb src={s.img} icon={s.icon} />
          </div>
          <div className="flex flex-col gap-1 flex-grow">
            <h3 className="font-headline-sm text-headline-sm text-on-surface leading-tight">{s.name}</h3>
            <Stars rating={s.rating} count={120 + i * 37} />
            <span className="font-headline-sm text-headline-sm text-on-surface mt-0.5">{fmt.inr(s.price)}</span>
            <span className="bg-surface-container-high text-on-surface-variant font-label-md text-label-md px-2 py-0.5 rounded w-max mt-1">New</span>
          </div>
        </article>
      ))}
    </section>
  );
}

// Web image with graceful icon fallback (parent must be relative + overflow-hidden + centered).
function Thumb({ src, icon }) {
  const [err, setErr] = useState(false);
  return (
    <>
      <Icon name={icon} className="text-[36px]" />
      {src && !err && (
        <img src={src} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" onError={() => setErr(true)} />
      )}
    </>
  );
}

function TrustTag({ label, onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`flex items-center gap-1 bg-success/10 text-success border border-success/30 rounded-full px-2.5 py-1 font-label-bold text-label-bold ${onClick ? "hover:bg-success/20" : "cursor-default"}`}>
      <Icon name="check_circle" className="text-[14px]" fill /> {label}
    </button>
  );
}

function Stars({ rating, count }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      <span className="flex text-amber">
        {Array.from({ length: 5 }).map((_, i) => (
          <Icon key={i} name={i < full ? "star" : i === full && half ? "star_half" : "star"} className={`text-[14px] ${i < full || (i === full && half) ? "" : "text-outline-variant"}`} fill={i < full || (i === full && half)} />
        ))}
      </span>
      <span className="font-label-md text-label-md text-on-surface-variant">{rating.toFixed(1)} ({count})</span>
    </div>
  );
}
