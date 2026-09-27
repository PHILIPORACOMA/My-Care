import type { RulesetBundle } from "../schema.js";
import { v1Bundle } from "../bundle/v1.js";
import { testLexiconTerms } from "./lexicon-fixture.js";

/**
 * Test-only entry point: `@mycare/ruleset/testing`. Never imported by
 * application code, and never re-exported from the package's main entry.
 * Read lexicon-fixture.ts's header before using anything here.
 */
export { testLexiconTerms };

/**
 * v1 exactly as published, plus the invented test lexicon. It exists so
 * free-text triage can be exercised before the reviewed terms arrive: in unit
 * tests, in the throwaway mycare_e2e schema, and (by hand) in a development
 * database via `npm run export:test-lexicon`.
 */
export const v1TestLexiconBundle: RulesetBundle = {
  ...v1Bundle,
  versionLabel: "v1-test-lexicon",
  lexiconTerms: testLexiconTerms,
};
