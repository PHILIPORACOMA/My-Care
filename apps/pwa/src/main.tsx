import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";

/*
 * Offline is the point (Table 27: "None required for triage"). The service
 * worker precaches the app shell, the engine, the matcher and the font, so a
 * second visit works with no signal at all. An update is applied immediately:
 * a handset that has just reconnected should not keep running last month's
 * build while the rules it downloads are current.
 */
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
