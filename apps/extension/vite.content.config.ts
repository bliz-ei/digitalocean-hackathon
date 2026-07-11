import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";

/* The YouTube content script must be one self-contained classic-script file (no ES
 * imports), so it is built on its own with inlineDynamicImports. Runs after the main
 * build with emptyOutDir:false so it appends content.js without wiping the other entries. */
export default defineConfig({
  plugins:[react()],
  build:{
    emptyOutDir:false,
    rollupOptions:{
      input:{content:resolve(__dirname,"src/content-script.tsx")},
      output:{entryFileNames:"[name].js",format:"iife",inlineDynamicImports:true},
    },
  },
});
