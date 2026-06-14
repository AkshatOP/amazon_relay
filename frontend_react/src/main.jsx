import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppProvider } from "./store";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
