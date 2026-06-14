import { AnimatePresence, motion } from "framer-motion";
import { useApp } from "./store";
import Shell from "./components/Shell";
import Orders from "./screens/Orders";
import ReturnFlow from "./screens/ReturnFlow";
import Rider from "./screens/Rider";
import MapScreen from "./screens/MapScreen";
import P2PNudge from "./screens/P2PNudge";
import P2PGrade from "./screens/P2PGrade";
import P2PHandoff from "./screens/P2PHandoff";
import Hub from "./screens/Hub";
import Shop from "./screens/Shop";

const SCREENS = {
  hub: Hub, orders: Orders, return: ReturnFlow, rider: Rider, map: MapScreen,
  "p2p-nudge": P2PNudge, "p2p-grade": P2PGrade, "p2p-handoff": P2PHandoff, shop: Shop,
};

export default function App() {
  const { screen } = useApp();
  const Screen = SCREENS[screen] || Hub;
  return (
    <div className="min-h-screen flex justify-center bg-surface-container-low">
      <Shell>
        <AnimatePresence mode="wait">
          <motion.div key={screen}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="h-full">
            <Screen />
          </motion.div>
        </AnimatePresence>
      </Shell>
    </div>
  );
}
