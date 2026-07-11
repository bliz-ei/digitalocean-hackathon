import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

/* Dev server + build for the design-system demo gallery (packages/ui/demo.html).
 * The library itself is consumed as source; this config only powers `npm run dev`. */
export default defineConfig({plugins:[react()]});
