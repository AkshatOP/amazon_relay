import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { setToast } from "./lib/api";
import { DEMO_ITEMS } from "./lib/demoItems";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// Default = first demo item (the seeded Udupi niche shoe) at the Udupi City pickup point.
// Item fields come from demoItems; the pickup location is separate (changed on the map).
const DEFAULT_ORDER = {
  ...DEMO_ITEMS[0],
  region: "udupi", customer_lat: 13.3409, customer_lng: 74.7421, customer_area: "Udupi City",
};

let _id = 0;

export function AppProvider({ children }) {
  const [screen, setScreen] = useState("hub");
  const [order, setOrderState] = useState(DEFAULT_ORDER);
  const [grade, setGrade] = useState(null);
  const [route, setRoute] = useState(null);
  const [p2p, setP2pState] = useState({ purchase: null, nudge: null, listing: null, demand: null, handoff: null, simulateYears: 3 });
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, kind = "info", ms = 3200) => {
    const id = ++_id;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  useEffect(() => { setToast(toast); }, [toast]);  // let the api layer raise toasts

  const go = useCallback((name) => { setScreen(name); document.getElementById("screen-scroll")?.scrollTo(0, 0); }, []);
  const setP2p = useCallback((patch) => setP2pState((s) => ({ ...s, ...patch })), []);
  const setOrder = useCallback((patch) => setOrderState((o) => ({ ...o, ...patch })), []);

  const value = { screen, go, order, setOrder, grade, setGrade, route, setRoute, p2p, setP2p, toast, toasts };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
