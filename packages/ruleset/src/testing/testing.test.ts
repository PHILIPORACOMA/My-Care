import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as ruleset from "../index.js";
import { v1Bundle } from "../bundle/v1.js";
import { v2Bundle } from "../bundle/v2.js";
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

test("v2 is v1 plus the 26 Batch 2 presentations, and no v1 code or rule changed", () => {
  assert.equal(v2Bundle.versionLabel, "v2-draft");
  assert.deepEqual(v2Bundle.symptomCodes.slice(0, 23), v1Bundle.symptomCodes);
  assert.deepEqual(v2Bundle.rules.slice(0, 23), v1Bundle.rules);
  assert.equal(v2Bundle.symptomCodes.length, 49);
  assert.equal(v2Bundle.rules.length, 49);

  const { symptomCodes: _, rules: __, versionLabel: ___, ...rest } = v2Bundle;
  const { symptomCodes: _v1, rules: __v1, versionLabel: ___v1, ...v1Rest } = v1Bundle;
  assert.deepEqual(rest, v1Rest);
});

test("v2's codes, rule codes and priorities are unique, and fit the API's column widths", () => {
  const codes = v2Bundle.symptomCodes.map((c) => c.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(new Set(v2Bundle.rules.map((r) => r.code)).size, v2Bundle.rules.length);
  assert.equal(new Set(v2Bundle.rules.map((r) => r.priority)).size, v2Bundle.rules.length);
  for (const c of v2Bundle.symptomCodes) {
    assert.ok(c.code.length <= 50 && c.displayName.length <= 100, c.code);
  }
  for (const r of v2Bundle.rules) {
    assert.ok(codes.includes(r.conditions[0]!.symptomCode!), `${r.code} names an unknown code`);
  }
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
