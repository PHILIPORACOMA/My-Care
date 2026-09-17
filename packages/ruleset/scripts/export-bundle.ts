/**
 * Writes the v1 RulesetBundle as JSON so the Laravel API can import it:
 *
 *     npm run export:v1 -w @mycare/ruleset
 *     cd apps/api && php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1.json
 *
 * The import lands as a DRAFT. v1 has not been through clinician review, and
 * being encoded here is not the same as having passed it (docs/BUILD-LOG.md).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { v1Bundle } from "../src/bundle/v1.js";

const target = resolve(process.argv[2] ?? "dist/v1.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(v1Bundle, null, 2) + "\n", "utf8");

console.log(`Wrote ${v1Bundle.rules.length} rules and ${v1Bundle.symptomCodes.length} symptom codes to ${target}`);
