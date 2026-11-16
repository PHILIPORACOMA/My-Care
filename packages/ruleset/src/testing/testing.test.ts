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

test("v2 is v1 plus the 26 Batch 2 presentations and one added after the form, and no v1 code or rule changed", () => {
  assert.equal(v2Bundle.versionLabel, "v2-draft");
  assert.deepEqual(v2Bundle.symptomCodes.slice(0, 23), v1Bundle.symptomCodes);
  assert.deepEqual(v2Bundle.rules.slice(0, 23), v1Bundle.rules);
  // 23 (v1) + 26 (the appraisal form's Part D) + 1 (chest pain, added 2026-11-15).
  assert.equal(v2Bundle.symptomCodes.length, 50);
  assert.equal(v2Bundle.rules.length, 50);
  assert.equal(v2Bundle.symptomCodes[49]!.code, "chest_pain_unspecified");

  // Nothing else about v1 changed except the follow-up questions and tip added below.
  const { symptomCodes: _, rules: __, versionLabel: ___, clarificationQuestions: ____, healthTips: _____, ...rest } = v2Bundle;
  const { symptomCodes: _v1, rules: __v1, versionLabel: ___v1, clarificationQuestions: _q1, healthTips: _t1, ...v1Rest } = v1Bundle;
  assert.deepEqual(rest, v1Rest);
});

test("v2's severe-or-not follow-ups: two questions in three languages, Yes is the red flag, the tip is home-only", () => {
  const asking = v2Bundle.symptomCodes.filter((c) => c.needsClarification).map((c) => c.code);
  assert.deepEqual(asking, ["abdominal_pain_ordinary", "chest_pain_unspecified"]);

  for (const key of ["abdominal_pain_severe", "chest_pain_severe"]) {
    const variants = v2Bundle.clarificationQuestions.filter((q) => q.questionKey === key);
    assert.deepEqual(variants.map((q) => q.language), ["en", "tl", "ceb"]);
    for (const q of variants) {
      // "Yes" sits in the same position in every language, so a tl or ceb answer
      // is checked against the English red flag (the engine compares the first variant).
      assert.equal(q.allowedAnswers.indexOf(q.redFlagAnswer!), 1, `${key}/${q.language}`);
      assert.ok(/^[a-z0-9_]+$/.test(q.questionKey) && q.questionKey.length <= 50 && q.prompt.length <= 2000);
      assert.ok(q.allowedAnswers.length >= 2 && q.allowedAnswers.every((a) => a.length <= 50));
    }
  }

  // Home tips for both: three each, in all three languages (18 rows), shown in order 1, 2, 3.
  assert.equal(v2Bundle.healthTips.length, 18);
  for (const symptomCode of ["abdominal_pain_ordinary", "chest_pain_unspecified"]) {
    for (const language of ["en", "tl", "ceb"] as const) {
      const tips = v2Bundle.healthTips.filter((t) => t.symptomCode === symptomCode && t.language === language);
      assert.deepEqual(tips.map((t) => t.displayOrder), [1, 2, 3], `${symptomCode}/${language}`);
    }
  }
  for (const tip of v2Bundle.healthTips) {
    assert.equal(tip.outcomeTier, "home");
    assert.ok(tip.title.length <= 150 && tip.body.length <= 5000);
    // No medicine is named and no dose is given in any tip (CLAUDE.md: no prescriptions).
    assert.doesNotMatch(`${tip.title} ${tip.body}`, /paracetamol|ibuprofen|aspirin|biogesic|mg|tablet|pill/i);
  }
  // The appraiser's own stomach condition is kept word for word.
  const own = v2Bundle.healthTips.find((t) => t.symptomCode === "abdominal_pain_ordinary" && t.language === "en" && t.displayOrder === 3);
  assert.equal(own?.body, "If the pain lasts more than 24 hours, or medicine does not help, go to your Rural Health Unit.");
  // Every chest tip list opens with the warning signs.
  const chestFirst = v2Bundle.healthTips.find((t) => t.symptomCode === "chest_pain_unspecified" && t.language === "en" && t.displayOrder === 1);
  assert.match(chestFirst!.body, /nearest hospital now/);
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
