import { execSync } from "node:child_process";
import { REPO_ROOT, artisan } from "./support/env";

/*
 * Rebuild the E2E world from nothing, every run:
 *
 *  1. the engine-replay CLI the API shells out to (ADR-0007) and the v1
 *     bundle JSON the fixture imports;
 *  2. the `mycare_e2e` schema - `migrate` creates it if it does not exist,
 *     `migrate:fresh --seed` empties it and loads roles and barangays;
 *  3. E2eSeeder - v1 published, two test staff accounts. It refuses to run
 *     against any other schema.
 */
export default function globalSetup(): void {
  execSync("npm run build -w @mycare/engine-replay", { cwd: REPO_ROOT, stdio: "inherit" });
  execSync("npm run export:v1 -w @mycare/ruleset", { cwd: REPO_ROOT, stdio: "inherit" });

  artisan("migrate", "--force");
  artisan("migrate:fresh", "--seed", "--force");
  process.stdout.write(artisan("db:seed", "--class=E2eSeeder", "--force"));
}
