import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@verity/ui"; // injects tokens.css / base.css / fonts.css / components.css
import "./app.css";
import { Home } from "./routes/Home";
import { ClaimPage } from "./routes/ClaimPage";
import { DemoClaim } from "./routes/DemoClaim";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="vy-root">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/claims/demo" element={<DemoClaim />} />
            <Route path="/claims/:publicId" element={<ClaimPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
