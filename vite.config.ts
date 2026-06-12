import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Vite + React SPA deployed to Cloudflare. A small Worker (src/worker.ts) gates the
// data; all other data is precomputed and committed under public/data.
export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    // The only chunk over 500 KB is MapLibre GL, which is now lazy-loaded (the map
    // tab only). Raise the warning threshold so the build output stays clean.
    chunkSizeWarningLimit: 1100,
  },
});
