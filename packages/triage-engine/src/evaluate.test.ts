import { test } from "node:test";
import assert from "node:assert/strict";
import type { RulesetBundle } from "@mycare/ruleset";
import { v1Bundle, v1SymptomCodes, v2Bundle, v2SymptomCodes } from "@mycare/ruleset";
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

// The tiers as ticked on the Batch 2 Lexicon Appraisal Form, Part D, typed out
// here rather than read from v2.ts so a slip in the bundle cannot pass itself.
// Insect sting / snake bite split and back pain = home per Philipo, 2026-11-07.
const BATCH2_TIERS: Record<string, "home" | "rhu" | "emergency"> = {
  abdominal_pain_ordinary: "home",
  nausea_vomiting: "rhu",
  heartburn_acid_reflux: "emergency",
  constipation: "home",
  blood_in_stool: "emergency",
  sore_throat: "home",
  runny_blocked_nose: "home",
  ear_pain_discharge: "rhu",
  toothache_swollen_gums: "home",
  red_itchy_eyes: "home",
  skin_rash_itching: "rhu",
  boil_abscess: "rhu",
  burns: "emergency",
  sprain_joint_injury: "rhu",
  back_pain: "home",
  joint_pain_swelling: "rhu",
  painful_urination: "rhu",
  dizziness_fainting: "emergency",
  palpitations: "rhu",
  numbness_tingling: "rhu",
  swollen_feet_legs: "rhu",
  tiredness_weakness: "rhu",
  fever_with_rash_or_bleeding: "emergency",
  insect_sting: "rhu",
  snake_bite: "emergency",
  vaginal_discharge_itching: "rhu",
};

test("v2 bundle: all 50 presentations resolve to their assigned tier, the 26 Batch 2 ones as appraised", () => {
  assert.equal(v2SymptomCodes.length, 50);
  for (const symptom of v2SymptomCodes) {
    const rule = v2Bundle.rules.find((r) => r.conditions[0]?.symptomCode === symptom.code);
    assert.ok(rule, `no rule found for ${symptom.code}`);
    const result = evaluate({ symptomCodes: [symptom.code] }, v2Bundle);
    assert.equal(result.tier, rule.outcomeTier, `${symptom.code} should resolve to ${rule.outcomeTier}`);
    assert.equal(result.reason, "rule_match");
    assert.equal(result.matchedRuleCode, rule.code);
  }
  for (const [code, tier] of Object.entries(BATCH2_TIERS)) {
    assert.equal(evaluate({ symptomCodes: [code] }, v2Bundle).tier, tier, `${code} should resolve to ${tier}`);
  }
  assert.equal(Object.keys(BATCH2_TIERS).length, 26);
});

// Added after the appraisal form, at Philipo's request (2026-11-15): a plain "my stomach
// hurts" / "my chest hurts" asks "Is the pain severe?". Yes is the red flag.
test("v2 bundle: ordinary stomach pain asks if it is severe; Yes is Emergency, No stays home", () => {
  const answer = (value: string) => ({ questionKey: "abdominal_pain_severe", answer: value });

  const yes = evaluate({ symptomCodes: ["abdominal_pain_ordinary"], clarificationAnswers: [answer("Yes")] }, v2Bundle);
  assert.equal(yes.tier, "emergency");
  assert.equal(yes.reason, "red_flag_clarification");

  const no = evaluate({ symptomCodes: ["abdominal_pain_ordinary"], clarificationAnswers: [answer("No")] }, v2Bundle);
  assert.equal(no.tier, "home");
  assert.equal(no.reason, "rule_match");
  assert.equal(no.matchedRuleCode, "R-024");
});

test("v2 bundle: unspecified chest pain asks if it is severe; Yes is Emergency, No goes to home (Philipo, 2026-11-16)", () => {
  const answer = (value: string) => ({ questionKey: "chest_pain_severe", answer: value });

  const yes = evaluate({ symptomCodes: ["chest_pain_unspecified"], clarificationAnswers: [answer("Yes")] }, v2Bundle);
  assert.equal(yes.tier, "emergency");
  assert.equal(yes.reason, "red_flag_clarification");

  // Home was Philipo's decision. RHU was proposed instead, because a patient with a
  // heart problem may well answer No; the chest tip puts the warning signs first.
  const no = evaluate({ symptomCodes: ["chest_pain_unspecified"], clarificationAnswers: [answer("No")] }, v2Bundle);
  assert.equal(no.tier, "home");
  assert.equal(no.matchedRuleCode, "R-050");
});

test("v2 bundle: saying 'not severe' cannot pull down a severe presentation that was also matched", () => {
  const result = evaluate(
    {
      symptomCodes: ["abdominal_pain_ordinary", "abdominal_pain_severe_rigidity"],
      clarificationAnswers: [{ questionKey: "abdominal_pain_severe", answer: "No" }],
    },
    v2Bundle
  );
  assert.equal(result.tier, "emergency");
});

test("v2 bundle: a home complaint alongside an emergency one still resolves to emergency", () => {
  const result = evaluate({ symptomCodes: ["sore_throat", "snake_bite"] }, v2Bundle);
  assert.equal(result.tier, "emergency");
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
    healthTips: [],
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

// A fixed-choice answer is text. "=" and "!=" compare it exactly; an ordering
// comparator never holds; numbers still compare as numbers (ADR-0001).
function textRuleBundle(comparator: "=" | "!=" | ">=", value: string): RulesetBundle {
  return syntheticBundle({
    severityThresholds: [{ key: "q_home", label: "home answer", value, tier: "rhu", isOverride: false }],
    rules: [
      {
        code: "R-TEST-HOME",
        name: "symptom alone",
        expression: "IF s THEN home",
        conditions: [{ symptomCode: "s", operator: "AND" }],
        outcomeTier: "home",
        priority: 1,
        isActive: true,
      },
      {
        code: "R-TEST-TEXT",
        name: "symptom with an answer",
        expression: `IF s AND q ${comparator} "${value}" THEN rhu`,
        conditions: [
          { symptomCode: "s", operator: "AND" },
          { attribute: "q", comparator, severityThresholdKey: "q_home", operator: "AND" },
        ],
        outcomeTier: "rhu",
        priority: 2,
        isActive: true,
      },
    ],
  });
}

const answering = (answer: string) => ({ symptomCodes: ["s"], clarificationAnswers: [{ questionKey: "q", answer }] });

test("text answers: '!=' holds for any other answer and not for the same one", () => {
  const bundle = textRuleBundle("!=", "1 to 2 days");
  assert.equal(evaluate(answering("1 to 2 days"), bundle).tier, "home");
  const other = evaluate(answering("3 days or more"), bundle);
  assert.equal(other.tier, "rhu");
  assert.equal(other.matchedRuleCode, "R-TEST-TEXT");
  // Exact text: case and spacing count.
  assert.equal(evaluate(answering("1 to 2 Days"), bundle).tier, "rhu");
  // No answer: the attribute condition cannot hold, so the base rule decides.
  assert.equal(evaluate({ symptomCodes: ["s"] }, bundle).tier, "home");
});

test("text answers: '=' holds only for the same text", () => {
  const bundle = textRuleBundle("=", "Big or deep cut");
  assert.equal(evaluate(answering("Big or deep cut"), bundle).tier, "rhu");
  assert.equal(evaluate(answering("Small scrape or shallow cut"), bundle).tier, "home");
});

test("text answers: an ordering comparator against text never holds", () => {
  const bundle = textRuleBundle(">=", "Big or deep cut");
  assert.equal(evaluate(answering("Big or deep cut"), bundle).tier, "home");
  assert.equal(evaluate(answering("Zzz"), bundle).tier, "home");
});

test("numbers still compare as numbers, including '=' and '!='", () => {
  assert.equal(evaluate(answering("3.0"), textRuleBundle("=", "3")).tier, "rhu");
  assert.equal(evaluate(answering("3.0"), textRuleBundle("!=", "3")).tier, "home");
  assert.equal(evaluate(answering("10"), textRuleBundle(">=", "9")).tier, "rhu");
  assert.equal(evaluate(answering("8"), textRuleBundle(">=", "9")).tier, "home");
});

// Batch 2 Part C, approved by the appraiser 2026-11-16 (BUILD-LOG 9ao): every
// answer of every follow-up, typed out, with the result it must give. The phone
// submits the English answer at the chosen position (ADR-0006).
const PART_C_RESULTS: [string, string, [string, "home" | "rhu" | "emergency"][]][] = [
  ["fever_mild", "fever_days", [["1 to 2 days", "home"], ["3 days or more", "rhu"]]],
  ["cold_cough_no_sob", "cough_weeks", [["Less than 2 weeks", "home"], ["2 weeks or more", "rhu"]]],
  [
    "diarrhea_mild_no_dehydration",
    "diarrhea_dehydration",
    [["None of these", "home"], ["Yes, one or more", "rhu"], ["Very weak, confused, or cannot drink", "emergency"]],
  ],
  [
    "minor_wound_no_infection",
    "wound_size",
    [["Small scrape or shallow cut", "home"], ["Big or deep cut", "rhu"], ["Bleeding that will not stop", "emergency"]],
  ],
  ["minor_wound_no_infection", "wound_infection", [["No", "home"], ["Yes", "rhu"]]],
  [
    "headache_mild_moderate",
    "headache_danger_signs",
    [["No, none of these", "home"], ["None of these, but it has lasted 3 days or more", "rhu"], ["Yes, one or more", "emergency"]],
  ],
  [
    "spotting_first_trimester_mild",
    "spotting_pads",
    [["Only spots, less than 1 pad a day", "rhu"], ["1 pad or more a day, but less than 1 an hour", "rhu"], ["1 pad or more every hour", "emergency"]],
  ],
];

test("v2 bundle: every Part C follow-up answer gives the result the appraiser approved", () => {
  for (const [symptomCode, questionKey, answers] of PART_C_RESULTS) {
    for (const [answer, tier] of answers) {
      const result = evaluate({ symptomCodes: [symptomCode], clarificationAnswers: [{ questionKey, answer }] }, v2Bundle);
      assert.equal(result.tier, tier, `${symptomCode} / ${questionKey} = "${answer}"`);
      if (tier === "emergency") assert.equal(result.reason, "red_flag_clarification");
    }
    // Unanswered, the presentation keeps its v1 tier.
    const base = v1Bundle.rules.find((r) => r.conditions[0]?.symptomCode === symptomCode)!;
    assert.equal(evaluate({ symptomCodes: [symptomCode] }, v2Bundle).tier, base.outcomeTier, symptomCode);
  }
});

test("v2 bundle: an answer that leads to rhu matches its own follow-up rule", () => {
  const cases: [string, string, string, string][] = [
    ["fever_mild", "fever_days", "3 days or more", "R-051"],
    ["cold_cough_no_sob", "cough_weeks", "2 weeks or more", "R-052"],
    ["diarrhea_mild_no_dehydration", "diarrhea_dehydration", "Yes, one or more", "R-053"],
    ["minor_wound_no_infection", "wound_size", "Big or deep cut", "R-054"],
    ["minor_wound_no_infection", "wound_infection", "Yes", "R-055"],
    ["headache_mild_moderate", "headache_danger_signs", "None of these, but it has lasted 3 days or more", "R-056"],
  ];
  for (const [symptomCode, questionKey, answer, ruleCode] of cases) {
    const result = evaluate({ symptomCodes: [symptomCode], clarificationAnswers: [{ questionKey, answer }] }, v2Bundle);
    assert.equal(result.matchedRuleCode, ruleCode, `${questionKey} = "${answer}"`);
  }
});

// The nurse review (2026-11-17, Part B2): the result the nurse approved for each
// answer. The English answers are what the phone submits; five questions were
// recast in the headache pattern to fit the 50-character red-flag column.
const NURSE_RESULTS: [string, string, [string, "home" | "rhu" | "emergency"][]][] = [
  [
    "sore_throat",
    "sore_throat_danger_signs",
    [["No, none of these", "home"], ["None of these, but it has lasted 7 days or more", "rhu"], ["Yes, one or more", "emergency"]],
  ],
  ["runny_blocked_nose", "nose_days", [["Less than 10 days", "home"], ["10 days or more", "rhu"]]],
  [
    "toothache_swollen_gums",
    "tooth_swelling",
    [["No, none of these", "home"], ["No, but swollen cheek or face, or a fever", "rhu"], ["Yes, one or more", "emergency"]],
  ],
  [
    "red_itchy_eyes",
    "eye_danger_signs",
    [["No, only red, itchy or watery", "home"], ["No, but eye pain, blurred vision, or light hurts", "rhu"], ["Yes, one or more", "emergency"]],
  ],
  [
    "back_pain",
    "back_pain_danger_signs",
    [["No, none of these", "home"], ["No, but fever, burning urine, or 2 weeks or more", "rhu"], ["Yes, one or more", "emergency"]],
  ],
  [
    "constipation",
    "constipation_danger_signs",
    [["No, none of these", "home"], ["No, but no stool for 7 days or more", "rhu"], ["Yes, one or more", "emergency"]],
  ],
  [
    "muscle_pain_post_exertion",
    "muscle_pain_danger_signs",
    [["No, none of these", "home"], ["No, but very swollen, fever, or 7 days or more", "rhu"], ["Yes, one or more", "emergency"]],
  ],
  ["nausea_vomiting", "vomiting_danger_signs", [["No, none of these", "rhu"], ["Yes, one or more", "emergency"]]],
  ["insect_sting", "sting_danger_signs", [["No, none of these", "rhu"], ["Yes, one or more", "emergency"]]],
  ["skin_rash_itching", "rash_danger_signs", [["No, none of these", "rhu"], ["Yes, one or more", "emergency"]]],
  ["palpitations", "palpitations_danger_signs", [["No", "rhu"], ["Yes", "emergency"]]],
  ["swollen_feet_legs", "leg_swelling_danger_signs", [["No", "rhu"], ["Yes", "emergency"]]],
  ["numbness_tingling", "numbness_danger_signs", [["No", "rhu"], ["Yes", "emergency"]]],
];

test("v2 bundle: every nurse-review follow-up answer gives the result the nurse approved", () => {
  for (const [symptomCode, questionKey, answers] of NURSE_RESULTS) {
    for (const [answer, tier] of answers) {
      const result = evaluate({ symptomCodes: [symptomCode], clarificationAnswers: [{ questionKey, answer }] }, v2Bundle);
      assert.equal(result.tier, tier, `${symptomCode} / ${questionKey} = "${answer}"`);
      if (tier === "emergency") assert.equal(result.reason, "red_flag_clarification");
    }
    // Unanswered, the presentation keeps the tier it had before the question.
    const base = v2Bundle.rules.find((r) => r.conditions.length === 1 && r.conditions[0]?.symptomCode === symptomCode)!;
    assert.equal(evaluate({ symptomCodes: [symptomCode] }, v2Bundle).tier, base.outcomeTier, symptomCode);
  }
});

test("v2 bundle: a nurse-review answer that leads to rhu matches its own rule, R-057 to R-063", () => {
  const cases: [string, string, string, string][] = [
    ["sore_throat", "sore_throat_danger_signs", "None of these, but it has lasted 7 days or more", "R-057"],
    ["runny_blocked_nose", "nose_days", "10 days or more", "R-058"],
    ["toothache_swollen_gums", "tooth_swelling", "No, but swollen cheek or face, or a fever", "R-059"],
    ["red_itchy_eyes", "eye_danger_signs", "No, but eye pain, blurred vision, or light hurts", "R-060"],
    ["back_pain", "back_pain_danger_signs", "No, but fever, burning urine, or 2 weeks or more", "R-061"],
    ["constipation", "constipation_danger_signs", "No, but no stool for 7 days or more", "R-062"],
    ["muscle_pain_post_exertion", "muscle_pain_danger_signs", "No, but very swollen, fever, or 7 days or more", "R-063"],
  ];
  for (const [symptomCode, questionKey, answer, ruleCode] of cases) {
    const result = evaluate({ symptomCodes: [symptomCode], clarificationAnswers: [{ questionKey, answer }] }, v2Bundle);
    assert.equal(result.matchedRuleCode, ruleCode, `${questionKey} = "${answer}"`);
  }
});

test("v2 bundle: the two wound questions combine; either one alone can raise the result", () => {
  const wound = (size: string, infection: string) =>
    evaluate(
      {
        symptomCodes: ["minor_wound_no_infection"],
        clarificationAnswers: [
          { questionKey: "wound_size", answer: size },
          { questionKey: "wound_infection", answer: infection },
        ],
      },
      v2Bundle
    ).tier;
  assert.equal(wound("Small scrape or shallow cut", "No"), "home");
  assert.equal(wound("Small scrape or shallow cut", "Yes"), "rhu");
  assert.equal(wound("Big or deep cut", "No"), "rhu");
  assert.equal(wound("Bleeding that will not stop", "No"), "emergency");
});

test("v2 bundle: a home follow-up answer cannot pull down another matched presentation", () => {
  const result = evaluate(
    {
      symptomCodes: ["fever_mild", "snake_bite"],
      clarificationAnswers: [{ questionKey: "fever_days", answer: "1 to 2 days" }],
    },
    v2Bundle
  );
  assert.equal(result.tier, "emergency");
});
