import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

/*
 * The patient app (Figures 17-29).
 *
 * Build target is Chrome 80 / Safari 12, the manuscript's minimum patient
 * device (Table 27: 2 GB RAM, Snapdragon 400, 100 MB storage). Everything that
 * matters runs offline: the triage engine, the lexicon matcher, the cached
 * ruleset bundle, and the outgoing session queue.
 *
 * `/api` is proxied in development so the device endpoints are same-origin;
 * in production nginx serves the app and the API from one host.
 */
const api = process.env.MYCARE_API_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["fonts/*.woff2", "icon.svg"],
      workbox: {
        // Everything the app needs to start and triage is precached. API calls
        // are never cached: a stale ruleset or a replayed sync would be worse
        // than an honest failure, and both have their own offline handling.
        globPatterns: ["**/*.{js,css,html,woff2,svg}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/sanctum\//],
      },
      manifest: {
        name: "My Care",
        short_name: "My Care",
        description: "Offline health triage guidance for Carcar City barangays.",
        lang: "en",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F6F3ED",
        theme_color: "#0D7C6C",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
    }),
  ],
  build: {
    target: ["chrome80", "safari13"],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: api, changeOrigin: false },
    },
  },
  /*
   * `preview` serves the production build, and it is the only way to test the
   * offline behaviour honestly: the service worker is not registered by the
   * dev server, so going offline against `npm run dev` proves nothing. It
   * needs the same proxy as `server`, because a device still has to reach the
   * API once to register and download the ruleset before it can work offline.
   */
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": { target: api, changeOrigin: false },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
