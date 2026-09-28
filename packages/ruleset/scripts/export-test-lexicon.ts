/**
 * Writes v1 PLUS THE INVENTED TEST LEXICON as JSON, so free-text triage can be
 * tried by hand in a development database before the reviewed terms exist:
 *
 *     npm run export:test-lexicon -w @mycare/ruleset
 *     cd apps/api && php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1-test-lexicon.json
 *
 * The import lands as a draft with the next label (v2, v3...). Publishing it
 * from the console replaces the real v1 on every phone that syncs with that
 * database, so do this in a development database only, never on a server
 * patients use. Publish the reviewed version over it when it exists.
 *
 * Read src/testing/lexicon-fixture.ts before using this: the terms are
 * invented and not clinically reviewed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { v1TestLexiconBundle } from "../src/testing/index.js";

const target = resolve(process.argv[2] ?? "dist/v1-test-lexicon.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(v1TestLexiconBundle, null, 2) + "\n", "utf8");

console.log(
  `Wrote ${v1TestLexiconBundle.rules.length} rules and ${v1TestLexiconBundle.lexiconTerms.length} lexicon terms to ${target}`
);
console.warn(
  "TEST ONLY: these lexicon terms are invented and not clinically reviewed. " +
    "Import into a development database only, never a server patients use."
);
