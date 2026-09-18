import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/*
 * Same-origin with the API: Vite proxies /api and /sanctum in development,
 * nginx does the same in production (docs/DEPLOYMENT.md). Figure 30 shows the
 * portal at mycare.doh.gov.ph/portal, so the built app is served under /portal.
 */
const api = process.env.MYCARE_API_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  base: "/portal/",
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": { target: api, changeOrigin: false },
      "/sanctum": { target: api, changeOrigin: false },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
