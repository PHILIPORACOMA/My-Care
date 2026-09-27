import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as ruleset from "../index.js";
import { v1Bundle } from "../bundle/v1.js";
import { testLexiconTerms, v1TestLexiconBundle } from "./index.js";

/*
 * Guards for the invented test lexicon (lexicon-fixture.ts). It must never
 * reach a patient: not through v1, and not through the package's main entry.
 */

test("v1 publishes no lexicon terms: the test fixture never leaks into it", () => {
  assert.deepEqual(v1Bundle.lexiconTerms, []);
});

test("the main entry point does not export the test fixture", () => {
  assert.equal("testLexiconTerms" in ruleset, false);
  assert.equal("v1TestLexiconBundle" in ruleset, false);

  const index = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(index, /testing/);
});

test("the test bundle is v1 plus the fixture, and nothing else changed", () => {
  const { lexiconTerms, versionLabel, ...rest } = v1TestLexiconBundle;
  const { lexiconTerms: _, versionLabel: __, ...v1Rest } = v1Bundle;
  assert.deepEqual(rest, v1Rest);
  assert.equal(versionLabel, "v1-test-lexicon");
  assert.equal(lexiconTerms, testLexiconTerms);
});

test("every fixture term names one of v1's symptom codes and a supported language", () => {
  const codes = new Set(v1Bundle.symptomCodes.map((c) => c.code));
  for (const term of testLexiconTerms) {
    assert.ok(codes.has(term.symptomCode), `${term.term} -> unknown code ${term.symptomCode}`);
    assert.ok(["en", "tl", "ceb"].includes(term.language), `${term.term}: language ${term.language}`);
    assert.ok(term.term.trim().length > 0 && term.term.length <= 100, `term length: ${term.term}`);
  }
  // All 23 presentations are reachable by free text.
  assert.equal(new Set(testLexiconTerms.map((t) => t.symptomCode)).size, codes.size);
});
