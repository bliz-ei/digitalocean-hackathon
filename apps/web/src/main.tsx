import React from "react";
import {createRoot} from "react-dom/client";
import "@verity/ui"; // injects tokens.css / base.css / fonts.css / components.css
import "./web.css";
import {App} from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
