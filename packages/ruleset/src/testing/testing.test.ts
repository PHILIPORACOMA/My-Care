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

test("v2 is v1 plus the 26 Batch 2 presentations and one added after the form, and no v1 rule changed", () => {
  assert.equal(v2Bundle.versionLabel, "v2-draft");
  // The v1 codes keep their names; only the six with a Part C follow-up now ask first.
  assert.deepEqual(
    v2Bundle.symptomCodes.slice(0, 23).map(({ needsClarification: _, ...c }) => c),
    v1Bundle.symptomCodes.map(({ needsClarification: _, ...c }) => c)
  );
  assert.deepEqual(v2Bundle.rules.slice(0, 23), v1Bundle.rules);
  // 23 (v1) + 26 (the appraisal form's Part D) + 1 (chest pain, added 2026-11-15).
  assert.equal(v2Bundle.symptomCodes.length, 50);
  // ... and 6 follow-up rules (Part C, 2026-11-16).
  assert.equal(v2Bundle.rules.length, 56);
  assert.equal(v2Bundle.symptomCodes[49]!.code, "chest_pain_unspecified");

  // Nothing else about v1 changed except the follow-up questions, thresholds and tips added below.
  const { symptomCodes: _, rules: __, versionLabel: ___, clarificationQuestions: ____, healthTips: _____, severityThresholds: ______, ...rest } = v2Bundle;
  const { symptomCodes: _v1, rules: __v1, versionLabel: ___v1, clarificationQuestions: _q1, healthTips: _t1, severityThresholds: _s1, ...v1Rest } = v1Bundle;
  assert.deepEqual(rest, v1Rest);
});

test("v2's severe-or-not follow-ups: two questions in three languages, Yes is the red flag, the tip is home-only", () => {
  for (const code of ["abdominal_pain_ordinary", "chest_pain_unspecified"]) {
    assert.equal(v2Bundle.symptomCodes.find((c) => c.code === code)?.needsClarification, true, code);
  }

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
  const homeTips = v2Bundle.healthTips.filter((t) => t.outcomeTier === "home");
  assert.equal(homeTips.length, 18);
  for (const symptomCode of ["abdominal_pain_ordinary", "chest_pain_unspecified"]) {
    for (const language of ["en", "tl", "ceb"] as const) {
      const tips = v2Bundle.healthTips.filter((t) => t.symptomCode === symptomCode && t.language === language);
      assert.deepEqual(tips.map((t) => t.displayOrder), [1, 2, 3], `${symptomCode}/${language}`);
    }
  }
  for (const tip of homeTips) {
    assert.ok(["abdominal_pain_ordinary", "chest_pain_unspecified"].includes(tip.symptomCode!));
  }
  for (const tip of v2Bundle.healthTips) {
    assert.ok(tip.title.length <= 150 && tip.body.length <= 5000);
    // No medicine is named and no dose is given in any tip (CLAUDE.md: no prescriptions).
    assert.doesNotMatch(`${tip.title} ${tip.body}`, /paracetamol|ibuprofen|aspirin|biogesic|\bmg\b|\btablet|\bpill/i);
  }
  // The appraiser's own stomach condition is kept word for word.
  const own = v2Bundle.healthTips.find((t) => t.symptomCode === "abdominal_pain_ordinary" && t.language === "en" && t.displayOrder === 3);
  assert.equal(own?.body, "If the pain lasts more than 24 hours, or medicine does not help, go to your Rural Health Unit.");
  // Every chest tip list opens with the warning signs.
  const chestFirst = v2Bundle.healthTips.find((t) => t.symptomCode === "chest_pain_unspecified" && t.language === "en" && t.displayOrder === 1);
  assert.match(chestFirst!.body, /nearest hospital now/);
});

// Batch 2 Part C (2026-11-16): the appraiser's approved follow-ups, typed out here
// rather than read from v2.ts so a slip in the bundle cannot pass itself.
// [questionKey, symptomCode, result per answer, in answer order]
const PART_C: [string, string, ("home" | "rhu" | "emergency")[]][] = [
  ["fever_days", "fever_mild", ["home", "rhu"]],
  ["cough_weeks", "cold_cough_no_sob", ["home", "rhu"]],
  ["diarrhea_dehydration", "diarrhea_mild_no_dehydration", ["home", "rhu", "emergency"]],
  ["wound_size", "minor_wound_no_infection", ["home", "rhu", "emergency"]],
  ["wound_infection", "minor_wound_no_infection", ["home", "rhu"]],
  ["headache_danger_signs", "headache_mild_moderate", ["home", "rhu", "emergency"]],
  ["spotting_pads", "spotting_first_trimester_mild", ["rhu", "rhu", "emergency"]],
];

test("v2's Part C follow-ups: seven questions in three languages, English first, each fitting the API", () => {
  const asking = v2Bundle.symptomCodes.filter((c) => c.needsClarification).map((c) => c.code).sort();
  assert.deepEqual(asking, [
    "abdominal_pain_ordinary",
    "chest_pain_unspecified",
    "cold_cough_no_sob",
    "diarrhea_mild_no_dehydration",
    "fever_mild",
    "headache_mild_moderate",
    "minor_wound_no_infection",
    "spotting_first_trimester_mild",
  ]);
  // 2 severe-or-not questions + 7 Part C, each in en, tl, ceb.
  assert.equal(v2Bundle.clarificationQuestions.length, 27);

  for (const [key, symptomCode, results] of PART_C) {
    const variants = v2Bundle.clarificationQuestions.filter((q) => q.questionKey === key);
    assert.deepEqual(variants.map((q) => q.language), ["en", "tl", "ceb"], key);
    const emergencyAt = results.indexOf("emergency");
    for (const q of variants) {
      assert.equal(q.symptomCode, symptomCode, key);
      assert.equal(q.allowedAnswers.length, results.length, `${key}/${q.language}`);
      assert.equal(new Set(q.allowedAnswers).size, q.allowedAnswers.length, `${key}/${q.language}`);
      assert.equal(q.redFlagAnswer === undefined ? -1 : q.allowedAnswers.indexOf(q.redFlagAnswer), emergencyAt, `${key}/${q.language}`);
      // The question key doubles as the rule attribute, VARCHAR(30) in RULE_CONDITION.
      assert.ok(/^[a-z0-9_]+$/.test(q.questionKey) && q.questionKey.length <= 30 && q.prompt.length <= 2000, key);
      // Every answer fits the importer's 100; the red flag fits its VARCHAR(50).
      assert.ok(q.allowedAnswers.every((a) => a.length <= 100), `${key}/${q.language}`);
      assert.ok((q.redFlagAnswer ?? "").length <= 50, `${key}/${q.language}`);
    }
    // The phone submits the English answer, stored in a VARCHAR(50) column.
    assert.ok(variants[0]!.allowedAnswers.every((a) => a.length <= 50), key);
  }
});

test("v2's Part C thresholds hold the English home answer, never override, and feed one rhu rule each", () => {
  const followUpRules = v2Bundle.rules.slice(50);
  assert.deepEqual(followUpRules.map((r) => r.code), ["R-051", "R-052", "R-053", "R-054", "R-055", "R-056"]);
  assert.equal(v2Bundle.severityThresholds.length, 6);

  for (const [key, symptomCode, results] of PART_C) {
    const home = results.indexOf("home");
    const rule = followUpRules.find((r) => r.conditions[1]?.attribute === key);
    if (home === -1) {
      assert.equal(rule, undefined, `${key} has no home answer, so no rule`);
      continue;
    }
    const threshold = v2Bundle.severityThresholds.find((t) => t.key === `${key}_home`)!;
    const english = v2Bundle.clarificationQuestions.find((q) => q.questionKey === key)!;
    assert.equal(threshold.value, english.allowedAnswers[home]);
    assert.equal(threshold.isOverride, false);
    assert.ok(threshold.value.length <= 30, `${key}: VARCHAR(30)`);
    assert.ok(rule, `${key} needs a rule`);
    assert.equal(rule.outcomeTier, "rhu");
    assert.deepEqual(rule.conditions, [
      { symptomCode, operator: "AND" },
      { attribute: key, comparator: "!=", severityThresholdKey: threshold.key, operator: "AND" },
    ]);
    assert.ok(rule.name.length <= 150);
  }
});

test("v2's animal-bite tip: rhu, in three languages, and R-013 still sends the bite to rhu with no question", () => {
  const tips = v2Bundle.healthTips.filter((t) => t.symptomCode === "animal_bite_stable");
  assert.deepEqual(tips.map((t) => [t.language, t.outcomeTier, t.displayOrder]), [
    ["en", "rhu", 1],
    ["tl", "rhu", 1],
    ["ceb", "rhu", 1],
  ]);
  assert.equal(tips[0]!.title, "Get the bite checked today");
  const r013 = v2Bundle.rules.find((r) => r.code === "R-013")!;
  assert.equal(r013.conditions[0]!.symptomCode, "animal_bite_stable");
  assert.equal(r013.outcomeTier, "rhu");
  assert.equal(v2Bundle.clarificationQuestions.some((q) => q.symptomCode === "animal_bite_stable"), false);
  assert.equal(v2Bundle.healthTips.length, 21);
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
