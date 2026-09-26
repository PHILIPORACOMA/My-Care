import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/*
 * Two ways to run the suite:
 *
 *  - Default: Playwright starts its own API, patient build and staff dev
 *    servers on private ports (playwright.config.ts).
 *  - E2E_BASE_URL set: the suite targets an already-deployed server laid out
 *    as docs/DEPLOYMENT.md describes - / , /portal/ , /console/ on one host.
 *    The CI deploy-smoke job uses this against nginx + PHP-FPM. E2E_API_DIR
 *    then names that deployment's Laravel directory, and E2E_ARTISAN_USER the
 *    user artisan must run as to read its .env.
 */
export const DEPLOYED_URL = process.env.E2E_BASE_URL?.replace(/\/$/, "");

export const apiDir = process.env.E2E_API_DIR ?? path.join(REPO_ROOT, "apps/api");

export const API_PORT = 8100;
export const PORTS = { pwa: 4273, portal: 5274, console: 5275 } as const;

export const URLS = DEPLOYED_URL
  ? { pwa: DEPLOYED_URL, portal: `${DEPLOYED_URL}/portal`, console: `${DEPLOYED_URL}/console` }
  : {
      pwa: `http://localhost:${PORTS.pwa}`,
      portal: `http://localhost:${PORTS.portal}/portal`,
      console: `http://localhost:${PORTS.console}/console`,
    };

/**
 * Environment for every server and artisan call in the run. DB_DATABASE is the
 * load-bearing line: the real environment wins over apps/api/.env (Laravel's
 * Dotenv never overwrites), so nothing here can reach the development schema.
 * A deployed server caches its config, so there its own .env must name
 * mycare_e2e - and E2eSeeder refuses to run if it does not.
 */
export const E2E_ENV: Record<string, string> = {
  ...(process.env as Record<string, string>),
  DB_DATABASE: "mycare_e2e",
  MYCARE_API_URL: `http://127.0.0.1:${API_PORT}`,
  SANCTUM_STATEFUL_DOMAINS: `localhost:${PORTS.portal},localhost:${PORTS.console}`,
};

/** Mirrors Database\Seeders\E2eSeeder. Test-only, valid only in mycare_e2e. */
export const STAFF = {
  super: { email: "e2e-super@mycare.test", password: "e2e-super-pass-2026" },
  sub: { email: "e2e-sub@mycare.test", password: "e2e-sub-pass-2026", barangay: "Valladolid" },
} as const;

/**
 * Run `php artisan ...` against the E2E schema. `-d variables_order=EGPCS`
 * makes PHP populate $_ENV, which the Windows setup needs (docs/STATUS.md).
 */
export function artisan(...args: string[]): string {
  const php = ["-d", "variables_order=EGPCS", "artisan", ...args];
  const user = process.env.E2E_ARTISAN_USER;
  const [command, argv] = user ? ["sudo", ["-u", user, "php", ...php]] : ["php", php];

  return execFileSync(command, argv, {
    cwd: apiDir,
    env: E2E_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Read one number from the E2E schema: what the server actually stored. */
export function count(table: string): number {
  const out = artisan("tinker", `--execute=echo DB::table('${table}')->count();`);
  // The count is the last line that is only digits. Anything before it -
  // PsySH warning that www-data's home is not writable, say - is noise.
  const line = out.trim().split(/\r?\n/).reverse().find((l) => /^\d+$/.test(l.trim()));
  if (line === undefined) throw new Error(`Could not read a row count for ${table} from: ${out}`);
  return Number(line.trim());
}
