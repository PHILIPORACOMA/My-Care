/**
 * Writes a RulesetBundle as JSON so the Laravel API can import it:
 *
 *     npm run export:v1 -w @mycare/ruleset      (or export:v2)
 *     cd apps/api && php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1.json
 *
 * The import lands as a DRAFT. Neither v1 nor v2 has been through clinician
 * review, and being encoded here is not the same as having passed it
 * (docs/BUILD-LOG.md).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { RulesetBundle } from "../src/schema.js";
import { v1Bundle } from "../src/bundle/v1.js";
import { v2Bundle } from "../src/bundle/v2.js";

const bundles: Record<string, RulesetBundle> = { v1: v1Bundle, v2: v2Bundle };

const version = process.argv[3] ?? "v1";
const bundle = bundles[version];
if (!bundle) {
  console.error(`Unknown bundle "${version}". Expected one of: ${Object.keys(bundles).join(", ")}`);
  process.exit(1);
}

const target = resolve(process.argv[2] ?? `dist/${version}.json`);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(bundle, null, 2) + "\n", "utf8");

console.log(`Wrote ${bundle.rules.length} rules and ${bundle.symptomCodes.length} symptom codes to ${target}`);
