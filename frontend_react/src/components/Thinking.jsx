import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Icon } from "./ui";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Animated "the system is thinking" checklist. Steps reveal one-by-one: the current step
   shows a spinner, completed steps get a green check. Purely cosmetic — it paces the UI. */
export function Thinking({ steps, intervalMs = 850 }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    setDone(0);
    const t = setInterval(() => setDone((d) => (d < steps.length ? d + 1 : d)), intervalMs);
    return () => clearInterval(t);
  }, [steps, intervalMs]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center"><Icon name="smart_toy" className="text-on-primary-container animate-ai-pulse" fill /></span>
        <span className="font-label-bold text-label-bold text-primary uppercase tracking-wider">Thinking</span>
        <span className="flex gap-1 ml-0.5 items-end h-4">
          <span className="dot w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="dot w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: ".15s" }} />
          <span className="dot w-1.5 h-1.5 rounded-full bg-primary" style={{ animationDelay: ".3s" }} />
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <motion.div key={i} initial={false} animate={{ opacity: i <= done ? 1 : 0.35 }}
            className="flex items-center gap-2 font-body-md text-body-md">
            {i < done
              ? <Icon name="check_circle" className="text-success text-[18px]" fill />
              : i === done
                ? <Icon name="progress_activity" className="text-primary text-[18px] animate-spin" />
                : <Icon name="radio_button_unchecked" className="text-outline-variant text-[18px]" />}
            <span className={i < done ? "text-on-surface" : "text-on-surface-variant"}>{s}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* Drives a Thinking panel: shows the steps, runs the async work, and guarantees a minimum
   dwell so even instant API calls feel considered. Returns the async result. */
export function useThinking() {
  const [steps, setSteps] = useState(null);
  const run = useCallback(async (stepList, asyncFn, { perStepMs = 850, tail = 450 } = {}) => {
    setSteps(stepList);
    const minMs = stepList.length * perStepMs + tail;
    const [res] = await Promise.all([Promise.resolve().then(asyncFn), sleep(minMs)]);
    setSteps(null);
    return res;
  }, []);
  return { steps, thinking: steps != null, run };
}
