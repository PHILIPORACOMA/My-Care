import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/*
 * The console is served on the same origin as the API: in development Vite
 * proxies /api and /sanctum to `php artisan serve`; in production nginx does
 * the same (docs/DEPLOYMENT.md). Same origin means the Sanctum session cookie
 * just works and there is no CORS configuration to get wrong.
 */
const api = process.env.MYCARE_API_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
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
