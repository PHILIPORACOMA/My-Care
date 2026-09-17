import assert from "node:assert/strict";
import { test } from "node:test";
import type { RulesetBundle } from "@mycare/ruleset";
import { replay } from "./replay.js";

/* Fixture bundle — test scaffolding, not clinical content. */
const bundle: RulesetBundle = {
  versionLabel: "v7",
  symptomCodes: [],
  lexiconTerms: [],
  severityThresholds: [{ key: "score", label: "Score", value: "8", tier: "emergency", isOverride: true }],
  clarificationQuestions: [
    {
      questionKey: "severity",
      symptomCode: "code_a",
      language: "en",
      prompt: "How bad?",
      answerType: "single_select",
      allowedAnswers: ["mild", "worst"],
      redFlagAnswer: "worst",
    },
  ],
  rules: [
    {
      code: "R-001",
      name: "a",
      expression: "IF code_a THEN home",
      conditions: [{ symptomCode: "code_a", operator: "AND" }],
      outcomeTier: "home",
      priority: 1,
      isActive: true,
    },
  ],
  healthTips: [],
};

const session = (overrides: object) => ({
  id: 1,
  versionLabel: "v7",
  symptomCodes: [],
  clarificationAnswers: [],
  ...overrides,
});

test("replays a rule match to the rule's tier", () => {
  const [result] = replay({ bundles: { v7: bundle }, sessions: [session({ symptomCodes: ["code_a"] })] });
  assert.deepEqual(result, { id: 1, tier: "home", reason: "rule_match", matchedRuleCode: "R-001", error: null });
});

test("recovers an override-threshold escalation that no column records", () => {
  // The Phase 4 tripwire: SessionTierResolver would have read this as rhu.
  const [result] = replay({
    bundles: { v7: bundle },
    sessions: [session({ symptomCodes: ["code_a"], clarificationAnswers: [{ questionKey: "score", answer: "9" }] })],
  });
  assert.equal(result?.tier, "emergency");
  assert.equal(result?.reason, "severity_override");
});

test("recovers a red-flag clarification answer", () => {
  const [result] = replay({
    bundles: { v7: bundle },
    sessions: [session({ symptomCodes: ["code_a"], clarificationAnswers: [{ questionKey: "severity", answer: "worst" }] })],
  });
  assert.equal(result?.tier, "emergency");
  assert.equal(result?.reason, "red_flag_clarification");
});

test("falls back to rhu, never home, when nothing matches", () => {
  const [result] = replay({ bundles: { v7: bundle }, sessions: [session({ symptomCodes: [] })] });
  assert.equal(result?.tier, "rhu");
  assert.equal(result?.reason, "fail_safe_default");
});

test("reports an unknown version instead of guessing", () => {
  const [result] = replay({ bundles: { v7: bundle }, sessions: [session({ versionLabel: "v99" })] });
  assert.equal(result?.tier, null);
  assert.match(result?.error ?? "", /v99/);
});
