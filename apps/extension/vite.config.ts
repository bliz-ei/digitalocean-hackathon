import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";

/* Pages (popup, options) + the MV3 module worker/offscreen. These load their JS as ES
 * modules, so Rollup may share a react/ui vendor chunk between them freely.
 * The content script is built separately (vite.content.config.ts) because a manifest
 * content script is a classic script and must be a single self-contained file. */
export default defineConfig({
  plugins:[react()],
  build:{
    rollupOptions:{
      input:{
        popup:resolve(__dirname,"popup.html"),
        options:resolve(__dirname,"options.html"),
        offscreen:resolve(__dirname,"offscreen.html"),
        worker:resolve(__dirname,"src/service-worker.ts"),
      },
      output:{entryFileNames:"[name].js"},
    },
  },
});
