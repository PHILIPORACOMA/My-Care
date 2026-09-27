import { execSync } from "node:child_process";
import { DEPLOYED_URL, REPO_ROOT, artisan } from "./support/env";

/*
 * Rebuild the E2E world from nothing, every run:
 *
 *  1. the engine-replay CLI the API shells out to (ADR-0007), the v1
 *     bundle JSON the fixture imports, and v1 plus the invented test lexicon
 *     (imported by lexicon.free-text.spec.ts, never by the seeder);
 *  2. the `mycare_e2e` schema - `migrate` creates it if it does not exist,
 *     `migrate:fresh --seed` empties it and loads roles and barangays;
 *  3. E2eSeeder - v1 published, two test staff accounts. It refuses to run
 *     against any other schema.
 */
export default function globalSetup(): void {
  // A deployed server built both already (deploy/deploy.sh).
  if (!DEPLOYED_URL) {
    execSync("npm run build -w @mycare/engine-replay", { cwd: REPO_ROOT, stdio: "inherit" });
    execSync("npm run export:v1 -w @mycare/ruleset", { cwd: REPO_ROOT, stdio: "inherit" });
    // The invented test lexicon, for lexicon.free-text.spec.ts only.
    execSync("npm run export:test-lexicon -w @mycare/ruleset", { cwd: REPO_ROOT, stdio: "inherit" });
  }

  artisan("migrate", "--force");
  artisan("migrate:fresh", "--seed", "--force");
  process.stdout.write(artisan("db:seed", "--class=E2eSeeder", "--force"));
}
