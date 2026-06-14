import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./ui";
import { useApp } from "../store";

const DRAWER = [
  { key: "hub", icon: "dashboard", label: "Hub" },
  { key: "orders", icon: "person", label: "Customer (return)" },
  { key: "rider", icon: "local_shipping", label: "Rider grading" },
  { key: "map", icon: "map", label: "Logistics map" },
  { key: "p2p-nudge", icon: "sync_alt", label: "P2P resale" },
  { key: "shop", icon: "storefront", label: "Shop (buyer)" },
];
const BOTTOM = [
  { key: "hub", icon: "home", label: "Home" },
  { key: "orders", icon: "package_2", label: "Orders" },
  { key: "rider", icon: "photo_camera", label: "Scan" },
  { key: "map", icon: "map", label: "Map" },
];

export default function Shell({ children }) {
  const { screen, go, toasts } = useApp();
  const [open, setOpen] = useState(false);
  const showAI = ["rider", "p2p-grade"].includes(screen);
  const isP2p = screen.startsWith("p2p");

  return (
    <div className="w-full max-w-[428px] min-h-screen bg-surface shadow-xl relative flex flex-col md:border-x border-outline-variant/40">
      {/* TOP BAR */}
      <header className="h-[56px] flex-none flex items-center justify-between px-container-margin border-b border-outline-variant bg-surface sticky top-0 z-40">
        <button className="w-10 h-10 flex items-center justify-center text-primary rounded-full hover:bg-surface-container-high transition-colors" onClick={() => setOpen(true)}><Icon name="menu" /></button>
        <h1 className="font-headline-md text-headline-md font-semibold text-primary">Relay HUB</h1>
        <div className="flex items-center gap-1">
          <AnimatePresence>
            {showAI && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="bg-primary text-on-primary font-label-bold text-label-bold px-2.5 py-1 rounded-full animate-ai-pulse flex items-center gap-1 shadow-sm">
                <Icon name="smart_toy" className="text-[14px]" fill /><span>AI</span>
              </motion.div>
            )}
          </AnimatePresence>
          <button className="w-10 h-10 flex items-center justify-center text-primary rounded-full hover:bg-surface-container-high transition-colors"><Icon name="search" /></button>
        </div>
      </header>

      {/* DRAWER */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 bg-black/50 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.nav className="fixed inset-y-0 left-0 z-[60] w-[280px] bg-surface-container-lowest shadow-xl py-stack-lg flex flex-col"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "tween", duration: 0.25 }}>
              <div className="px-4 mb-6"><h2 className="font-headline-sm text-headline-sm font-semibold text-primary">Relay HUB</h2>
                <p className="font-label-md text-label-md text-on-surface-variant mt-1">Reverse logistics · resale</p></div>
              <ul className="flex flex-col gap-1">
                {DRAWER.map((d) => {
                  const active = d.key === screen || (d.key === "p2p-nudge" && isP2p);
                  return (
                    <li key={d.key}>
                      <button onClick={() => { go(d.key); setOpen(false); }}
                        className={`w-full flex items-center px-4 py-3 mx-2 rounded-lg text-left transition-colors ${active ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
                        <Icon name={d.icon} className="mr-3" /><span className="font-body-lg text-body-lg">{d.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.nav>
          </>
        )}
      </AnimatePresence>

      {/* SCREEN AREA */}
      <main id="screen-scroll" className="flex-1 overflow-y-auto hide-scrollbar relative">{children}</main>

      {/* BOTTOM NAV */}
      <nav className="h-[64px] flex-none flex justify-around items-center border-t border-outline-variant bg-surface sticky bottom-0 z-40">
        {BOTTOM.map((b) => {
          const active = b.key === screen;
          return (
            <button key={b.key} onClick={() => go(b.key)}
              className={`flex flex-col items-center justify-center flex-1 h-full pt-1 transition-colors ${active ? "text-primary border-t-2 border-primary" : "text-on-surface-variant hover:bg-surface-container-low"}`}>
              <Icon name={b.icon} fill={active} />
              <span className="font-label-md text-label-md mt-1">{b.label}</span>
            </button>
          );
        })}
      </nav>

      {/* TOASTS */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[88px] z-[200] flex flex-col gap-2 w-max max-w-[90vw]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`px-4 py-2.5 rounded-lg text-[13px] font-semibold shadow-lg ${t.kind === "err" ? "bg-error-container text-on-error-container" : t.kind === "ok" ? "bg-secondary-container text-primary" : "bg-near-black text-primary-fixed-dim"}`}>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
