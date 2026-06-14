import { useState, useEffect } from "react";
import { api } from "../lib/api";

export const Icon = ({ name, className = "", fill = false }) => (
  <span className={`material-symbols-outlined ${fill ? "fill-icon" : ""} ${className}`}>{name}</span>
);

// SVG score gauge (amber arc, 0..max). circumference ≈ 251.2 for r=40.
export function Gauge({ score = 0, max = 10, color = "#FFA724" }) {
  const C = 251.2;
  const offset = C * (1 - Math.max(0, Math.min(1, (Number(score) || 0) / max)));
  return (
    <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
      <svg className="w-full h-full circular-progress" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ebefec" strokeWidth="8" />
        <circle className="gauge-arc" cx="50" cy="50" r="40" fill="transparent" stroke={color}
          strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-headline-md text-headline-md text-on-surface leading-none">{(Number(score) || 0).toFixed(1)}</span>
        <span className="font-mono-code text-mono-code text-secondary text-[10px]">/ {max}</span>
      </div>
    </div>
  );
}

export function GradeBadge({ grade }) {
  const map = {
    A: "bg-success/15 text-success border-success/30", B: "bg-amber/20 text-on-tertiary-fixed-variant border-amber/30",
    C: "bg-amber/20 text-on-tertiary-fixed-variant border-amber/30", D: "bg-error-container text-on-error-container border-error/30",
    ERROR: "bg-error-container text-on-error-container border-error/30",
  };
  return <span className={`font-label-bold text-label-bold px-3 py-1 rounded-sm border ${map[grade] || "bg-surface-container-high text-on-surface-variant border-outline-variant/30"}`}>GRADE {grade}</span>;
}

export function DefectChips({ defects }) {
  if (!defects || defects.length === 0)
    return <span className="bg-surface-container-high text-on-surface-variant font-label-md text-label-md px-2 py-1 rounded border border-outline-variant/30 flex items-center gap-1"><Icon name="check" className="text-[14px]" /> No defects</span>;
  return defects.map((d, i) => (
    <span key={i} className="bg-surface-container-high text-on-surface-variant font-label-md text-label-md px-2 py-1 rounded border border-outline-variant/30 flex items-center gap-1"><Icon name="search" className="text-[14px]" /> {d}</span>
  ));
}

// Streams reasoning lines into the #131A22 terminal panel.
export function TerminalLog({ lines }) {
  const [shown, setShown] = useState([]);
  useEffect(() => {
    setShown([]);
    const timers = lines.map((ln, i) => setTimeout(() => setShown((s) => [...s, ln]), i * 280));
    return () => timers.forEach(clearTimeout);
  }, [lines]);
  return (
    <section className="bg-near-black rounded-xl p-4 shadow-inner">
      <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
        <Icon name="terminal" className="text-primary-fixed-dim text-[16px]" />
        <span className="font-label-bold text-label-bold text-primary-fixed-dim uppercase tracking-widest text-[10px]">Agent Reasoning Log</span>
      </div>
      <div className="font-mono-code text-mono-code text-[#A0AEC0] flex flex-col gap-1 text-[11px] leading-relaxed">
        {shown.map((l, i) => <p key={i} dangerouslySetInnerHTML={{ __html: l }} />)}
      </div>
    </section>
  );
}

// Catalog photo for an ASIN, with icon fallback if it 404s. Parent must be relative + overflow-hidden + centered.
export function ProductImg({ asin, icon, iconClass = "text-[36px]" }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Icon name={icon} className={iconClass} />
      {asin && !failed && (
        <img src={api.catalogImageUrl(asin)} alt="" className="absolute inset-0 w-full h-full object-cover" onError={() => setFailed(true)} />
      )}
    </>
  );
}

export const Spinner = ({ label }) => (
  <><Icon name="autorenew" className="animate-spin" /><span>{label}</span></>
);
