import { test } from "node:test";
import assert from "node:assert/strict";
import type { RulesetBundle } from "@mycare/ruleset";
import { v1Bundle, v1SymptomCodes } from "@mycare/ruleset";
import { evaluate } from "./evaluate.js";

// UT-005: matched symptoms satisfy a rule's conditions -> correct tier + rule id returned.
test("v1 bundle: every one of the 23 presentations resolves to its assigned tier", () => {
  for (const symptom of v1SymptomCodes) {
    const rule = v1Bundle.rules.find((r) => r.conditions[0]?.symptomCode === symptom.code);
    assert.ok(rule, `no rule found for ${symptom.code}`);
    const result = evaluate({ symptomCodes: [symptom.code] }, v1Bundle);
    assert.equal(result.tier, rule.outcomeTier, `${symptom.code} should resolve to ${rule.outcomeTier}`);
    assert.equal(result.reason, "rule_match");
    assert.equal(result.matchedRuleCode, rule.code);
  }
});

test("fail-safe default: unrecognized symptom codes resolve to rhu, never home", () => {
  const result = evaluate({ symptomCodes: ["not_a_real_symptom_code"] }, v1Bundle);
  assert.equal(result.tier, "rhu");
  assert.equal(result.reason, "fail_safe_default");
});

test("fail-safe default: no symptom codes at all resolves to rhu, never home", () => {
  const result = evaluate({ symptomCodes: [] }, v1Bundle);
  assert.equal(result.tier, "rhu");
  assert.equal(result.reason, "fail_safe_default");
});

test("highest tier among matches wins: an emergency symptom outranks a home symptom in the same session", () => {
  const result = evaluate(
    { symptomCodes: ["fever_mild", "difficulty_breathing"] },
    v1Bundle
  );
  assert.equal(result.tier, "emergency");
  assert.equal(result.matchedRuleCode, "R-015");
});

// The following use small synthetic fixture bundles (not the clinical v1
// content) purely to exercise engine precedence paths that the 23 literal
// presentations don't happen to cover.

function syntheticBundle(overrides: Partial<RulesetBundle> = {}): RulesetBundle {
  return {
    versionLabel: "test-fixture",
    symptomCodes: [],
    lexiconTerms: [],
    severityThresholds: [],
    clarificationQuestions: [],
    rules: [],
    ...overrides,
  };
}

test("red-flag clarification answer short-circuits to emergency ahead of rule matching", () => {
  const bundle = syntheticBundle({
    clarificationQuestions: [
      {
        questionKey: "chest_pain_severity",
        symptomCode: "chest_pain",
        language: "en",
        prompt: "How severe is the chest pain?",
        answerType: "single_select",
        allowedAnswers: ["mild", "severe_radiating"],
        redFlagAnswer: "severe_radiating",
      },
    ],
    rules: [
      {
        code: "R-TEST-HOME",
        name: "chest pain, unspecified",
        expression: "IF chest_pain THEN home",
        conditions: [{ symptomCode: "chest_pain", operator: "AND" }],
        outcomeTier: "home",
        priority: 1,
        isActive: true,
      },
    ],
  });

  const result = evaluate(
    {
      symptomCodes: ["chest_pain"],
      clarificationAnswers: [{ questionKey: "chest_pain_severity", answer: "severe_radiating" }],
    },
    bundle
  );

  assert.equal(result.tier, "emergency");
  assert.equal(result.reason, "red_flag_clarification");
  assert.equal(result.matchedQuestionKey, "chest_pain_severity");
});

test("a non-red-flag clarification answer does not override normal rule matching", () => {
  const bundle = syntheticBundle({
    clarificationQuestions: [
      {
        questionKey: "chest_pain_severity",
        symptomCode: "chest_pain",
        language: "en",
        prompt: "How severe is the chest pain?",
        answerType: "single_select",
        allowedAnswers: ["mild", "severe_radiating"],
        redFlagAnswer: "severe_radiating",
      },
    ],
    rules: [
      {
        code: "R-TEST-HOME",
        name: "chest pain, unspecified",
        expression: "IF chest_pain THEN home",
        conditions: [{ symptomCode: "chest_pain", operator: "AND" }],
        outcomeTier: "home",
        priority: 1,
        isActive: true,
      },
    ],
  });

  const result = evaluate(
    {
      symptomCodes: ["chest_pain"],
      clarificationAnswers: [{ questionKey: "chest_pain_severity", answer: "mild" }],
    },
    bundle
  );

  assert.equal(result.tier, "home");
  assert.equal(result.reason, "rule_match");
});

test("a red-flag severity threshold escalates ahead of normal rule matching", () => {
  const bundle = syntheticBundle({
    severityThresholds: [
      {
        key: "fever_duration_days",
        label: "Fever duration (days)",
        value: "7",
        tier: "emergency",
        isOverride: true,
      },
    ],
    rules: [
      {
        code: "R-TEST-RHU",
        name: "fever present",
        expression: "IF fever THEN rhu",
        conditions: [{ symptomCode: "fever", operator: "AND" }],
        outcomeTier: "rhu",
        priority: 1,
        isActive: true,
      },
    ],
  });

  const result = evaluate(
    { symptomCodes: ["fever"], attributes: { fever_duration_days: 10 } },
    bundle
  );

  assert.equal(result.tier, "emergency");
  assert.equal(result.reason, "severity_override");
  assert.equal(result.matchedThresholdKey, "fever_duration_days");
});

test("tie-break: when two matched rules share the highest tier, the lower priority number wins", () => {
  const bundle = syntheticBundle({
    rules: [
      {
        code: "R-TEST-A",
        name: "symptom A",
        expression: "IF a THEN rhu",
        conditions: [{ symptomCode: "a", operator: "AND" }],
        outcomeTier: "rhu",
        priority: 2,
        isActive: true,
      },
      {
        code: "R-TEST-B",
        name: "symptom B",
        expression: "IF b THEN rhu",
        conditions: [{ symptomCode: "b", operator: "AND" }],
        outcomeTier: "rhu",
        priority: 1,
        isActive: true,
      },
    ],
  });

  const result = evaluate({ symptomCodes: ["a", "b"] }, bundle);
  assert.equal(result.tier, "rhu");
  assert.equal(result.matchedRuleCode, "R-TEST-B");
});

test("a clarification answer's questionKey feeds a rule condition's attribute lookup", () => {
  const bundle = syntheticBundle({
    severityThresholds: [
      {
        key: "fever_duration_days",
        label: "Fever duration (days)",
        value: "3",
        tier: "rhu",
        isOverride: false,
      },
    ],
    rules: [
      {
        code: "R-TEST-FEVER-RHU",
        name: "fever, 3+ days",
        expression: "IF fever AND fever_duration_days >= 3 THEN rhu",
        conditions: [
          { symptomCode: "fever", operator: "AND" },
          {
            attribute: "fever_duration_days",
            comparator: ">=",
            severityThresholdKey: "fever_duration_days",
            operator: "AND",
          },
        ],
        outcomeTier: "rhu",
        priority: 1,
        isActive: true,
      },
    ],
  });

  const result = evaluate(
    {
      symptomCodes: ["fever"],
      clarificationAnswers: [{ questionKey: "fever_duration_days", answer: "5" }],
    },
    bundle
  );

  assert.equal(result.tier, "rhu");
  assert.equal(result.reason, "rule_match");
  assert.equal(result.matchedRuleCode, "R-TEST-FEVER-RHU");
});

test("explicit attributes are used when no clarification answer overrides them", () => {
  const bundle = syntheticBundle({
    severityThresholds: [
      {
        key: "fever_duration_days",
        label: "Fever duration (days)",
        value: "3",
        tier: "rhu",
        isOverride: false,
      },
    ],
    rules: [
      {
        code: "R-TEST-FEVER-RHU",
        name: "fever, 3+ days",
        expression: "IF fever AND fever_duration_days >= 3 THEN rhu",
        conditions: [
          { symptomCode: "fever", operator: "AND" },
          {
            attribute: "fever_duration_days",
            comparator: ">=",
            severityThresholdKey: "fever_duration_days",
            operator: "AND",
          },
        ],
        outcomeTier: "rhu",
        priority: 1,
        isActive: true,
      },
    ],
  });

  const belowThreshold = evaluate(
    { symptomCodes: ["fever"], attributes: { fever_duration_days: 1 } },
    bundle
  );
  assert.equal(belowThreshold.tier, "rhu");
  assert.equal(belowThreshold.reason, "fail_safe_default");

  const atThreshold = evaluate(
    { symptomCodes: ["fever"], attributes: { fever_duration_days: 3 } },
    bundle
  );
  assert.equal(atThreshold.tier, "rhu");
  assert.equal(atThreshold.reason, "rule_match");
});

test("an inactive rule is not matched even if its conditions hold", () => {
  const bundle = syntheticBundle({
    rules: [
      {
        code: "R-TEST-INACTIVE",
        name: "disabled rule",
        expression: "IF x THEN emergency",
        conditions: [{ symptomCode: "x", operator: "AND" }],
        outcomeTier: "emergency",
        priority: 1,
        isActive: false,
      },
    ],
  });

  const result = evaluate({ symptomCodes: ["x"] }, bundle);
  assert.equal(result.tier, "rhu");
  assert.equal(result.reason, "fail_safe_default");
});

test("AND/NOT condition chains: a rule requiring symptom present AND another absent", () => {
  const bundle = syntheticBundle({
    rules: [
      {
        code: "R-TEST-COUGH-HOME",
        name: "cough without breathing difficulty",
        expression: "IF cough AND NOT difficulty_breathing THEN home",
        conditions: [
          { symptomCode: "cough", operator: "AND" },
          { symptomCode: "difficulty_breathing", operator: "NOT" },
        ],
        outcomeTier: "home",
        priority: 1,
        isActive: true,
      },
    ],
  });

  const matches = evaluate({ symptomCodes: ["cough"] }, bundle);
  assert.equal(matches.tier, "home");

  const excluded = evaluate({ symptomCodes: ["cough", "difficulty_breathing"] }, bundle);
  assert.equal(excluded.tier, "rhu");
  assert.equal(excluded.reason, "fail_safe_default");
});
