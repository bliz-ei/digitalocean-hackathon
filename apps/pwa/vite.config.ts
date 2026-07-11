import {defineConfig} from "vite"; import react from "@vitejs/plugin-react";
// Deployed under a path prefix (/app) alongside the marketing site on the same DO
// app; local dev stays at root so existing dev URLs (http://localhost:5173/…) hold.
export default defineConfig(({command})=>({base:command==="build"?"/app/":"/",plugins:[react()]}));
