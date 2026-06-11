import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// Vite + React SPA deployed to Cloudflare as static assets (no Worker backend
// needed for the MVP — all data is precomputed and committed under public/data).
export default defineConfig({
  plugins: [react(), cloudflare()],
});
