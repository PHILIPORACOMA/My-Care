import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const apiDir = path.join(REPO_ROOT, "apps/api");

export const API_PORT = 8100;
export const PORTS = { pwa: 4273, portal: 5274, console: 5275 } as const;

/**
 * Environment for every server and artisan call in the run. DB_DATABASE is the
 * load-bearing line: the real environment wins over apps/api/.env (Laravel's
 * Dotenv never overwrites), so nothing here can reach the development schema.
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
  return execFileSync("php", ["-d", "variables_order=EGPCS", "artisan", ...args], {
    cwd: apiDir,
    env: E2E_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Read one number from the E2E schema: what the server actually stored. */
export function count(table: string): number {
  const out = artisan("tinker", `--execute=echo DB::table('${table}')->count();`);
  return Number(out.trim().split(/\s+/).pop());
}
