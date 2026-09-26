import { defineConfig } from "@playwright/test";
import { API_PORT, DEPLOYED_URL, E2E_ENV, PORTS, REPO_ROOT, URLS, apiDir } from "./support/env";

/*
 * Phase 8: the three apps in a real browser, against the real Laravel API and
 * a real MySQL 8 schema (`mycare_e2e`, rebuilt by global-setup.ts on every
 * run). Nothing is stubbed.
 *
 * Every server runs on its own port, so a run never collides with the
 * development servers (8000 / 5173-5175 / 4173) or touches their database.
 *
 * The patient app is served from its PRODUCTION build: the dev server
 * registers no service worker, so an offline test against it would prove
 * nothing. The staff apps are online-only and run from their dev servers.
 *
 * With E2E_BASE_URL set, no servers are started: the suite runs against an
 * already-deployed host (the CI deploy-smoke job, docs/DEPLOYMENT.md).
 *
 * Chromium only, at a small phone's size. That is as close to the manuscript's
 * minimum device (Table 27: Chrome 80, 2 GB RAM) as Playwright can get - it
 * ships a current Chromium, so this does NOT prove Chrome 80 compatibility.
 * That rests on the build target (chrome80) and a real handset.
 */

const vite = (workspace: string, script: string, port: number) =>
  `npm run ${script} -w ${workspace} -- --port ${port} --strictPort`;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  // One database, shared state across a journey: run serially.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "allow",
  },
  projects: [
    {
      name: "patient",
      testMatch: /patient\..*\.spec\.ts/,
      use: {
        baseURL: URLS.pwa,
        browserName: "chromium",
        viewport: { width: 360, height: 640 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "staff",
      testMatch: /(portal|console)\..*\.spec\.ts/,
      // The staff screens read what the patient journey synced.
      dependencies: ["patient"],
      use: { browserName: "chromium", viewport: { width: 1366, height: 800 } },
    },
  ],
  webServer: DEPLOYED_URL ? [] : [
    {
      command: `php -d variables_order=EGPCS artisan serve --no-reload --host=127.0.0.1 --port=${API_PORT}`,
      cwd: apiDir,
      env: E2E_ENV,
      url: `http://127.0.0.1:${API_PORT}/up`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run build -w @mycare/pwa && ${vite("@mycare/pwa", "preview", PORTS.pwa)}`,
      cwd: REPO_ROOT,
      env: E2E_ENV,
      url: `http://localhost:${PORTS.pwa}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: vite("@mycare/portal", "dev", PORTS.portal),
      cwd: REPO_ROOT,
      env: E2E_ENV,
      url: `http://localhost:${PORTS.portal}/portal/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: vite("@mycare/console", "dev", PORTS.console),
      cwd: REPO_ROOT,
      env: E2E_ENV,
      url: `http://localhost:${PORTS.console}/console/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
