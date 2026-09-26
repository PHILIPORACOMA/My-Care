import type { RulesetBundle } from "@mycare/ruleset";
import { describe, expect, it } from "vitest";
import { DICTIONARIES, translate } from "./i18n";
import { buildSession, canonicalAnswer, chipsFor, matchSymptoms, questionsFor, resolveCodes, runTriage, symptomLabel, tipsFor } from "./triage";

/*
 * Fixture bundle. "sipon", "hilanat" and "walay hilanat" are the manuscript's
 * own examples (Table 31); the codes they map to are fixtures, not the
 * clinical mapping.
 */
const bundle: RulesetBundle = {
  versionLabel: "v9",
  symptomCodes: [
    { code: "code_cold", displayName: "Fixture cold", needsClarification: false },
    { code: "code_fever", displayName: "Fixture fever", needsClarification: true },
    { code: "code_unused", displayName: "Fixture unused", needsClarification: false },
  ],
  lexiconTerms: [
    { symptomCode: "code_cold", language: "ceb", term: "sipon", isNegation: false },
    { symptomCode: "code_fever", language: "ceb", term: "hilanat", isNegation: false },
    { symptomCode: "code_fever", language: "ceb", term: "walay hilanat", isNegation: true },
  ],
  severityThresholds: [],
  clarificationQuestions: [
    {
      questionKey: "fever_severity",
      symptomCode: "code_fever",
      language: "en",
      prompt: "How bad is it?",
      answerType: "single_select",
      allowedAnswers: ["mild", "severe"],
      redFlagAnswer: "severe",
    },
    {
      questionKey: "fever_severity",
      symptomCode: "code_fever",
      language: "ceb",
      prompt: "Unsa ka grabe?",
      answerType: "single_select",
      allowedAnswers: ["gamay", "grabe"],
      redFlagAnswer: "grabe",
    },
  ],
  rules: [
    {
      code: "R-001",
      name: "cold",
      expression: "IF code_cold THEN home",
      conditions: [{ symptomCode: "code_cold", operator: "AND" }],
      outcomeTier: "home",
      priority: 1,
      isActive: true,
    },
    {
      code: "R-002",
      name: "fever",
      expression: "IF code_fever THEN rhu",
      conditions: [{ symptomCode: "code_fever", operator: "AND" }],
      outcomeTier: "rhu",
      priority: 2,
      isActive: true,
    },
  ],
  healthTips: [
    { outcomeTier: "home", language: "ceb", title: "Fixture tip", body: "Fixture body", displayOrder: 1 },
    { outcomeTier: "home", language: "en", title: "English tip", body: "English body", displayOrder: 1 },
  ],
};

const state = (overrides: Partial<Parameters<typeof runTriage>[1]> = {}) => ({
  picked: [],
  matches: [],
  answers: {},
  ...overrides,
});

describe("what the patient typed", () => {
  it("resolves free text to codes through the lexicon (UT-002, UT-003)", () => {
    const matches = matchSymptoms("naa koy sip-on", bundle.lexiconTerms);
    const result = runTriage(bundle, state({ matches }));

    expect(matches[0]?.symptomCode).toBe("code_cold");
    expect(result.tier).toBe("home");
    expect(result.matchedRuleCode).toBe("R-001");
  });

  it("excludes a negated symptom (UT-004) and falls back to rhu, never home", () => {
    const matches = matchSymptoms("walay hilanat", bundle.lexiconTerms);
    const { present, negated } = resolveCodes(state({ matches }));

    expect(present).toEqual([]);
    expect(negated).toEqual(["code_fever"]);
    expect(runTriage(bundle, state({ matches })).tier).toBe("rhu");
  });

  it("treats a tapped chip and typed text the same way", () => {
    const typed = runTriage(bundle, state({ matches: matchSymptoms("hilanat", bundle.lexiconTerms) }));
    const tapped = runTriage(bundle, state({ picked: ["code_fever"] }));

    expect(tapped.tier).toBe(typed.tier);
    expect(tapped.matchedRuleCode).toBe(typed.matchedRuleCode);
  });
});

describe("chips and questions", () => {
  it("offers only codes a live rule tests, labelled in the patient's language", () => {
    const chips = chipsFor(bundle, "ceb");

    expect(chips.map((c) => c.code)).toEqual(["code_cold", "code_fever"]);
    expect(chips[0]?.label).toBe("sipon");
    // English has no lexicon term here, so the display name stands in.
    expect(chipsFor(bundle, "en")[0]?.label).toBe("Fixture cold");
  });

  it("labels a symptom on the result screen exactly as its chip did, never as a raw code", () => {
    for (const language of ["ceb", "en"] as const) {
      for (const chip of chipsFor(bundle, language)) {
        expect(symptomLabel(bundle, chip.code, language)).toBe(chip.label);
      }
    }
    expect(symptomLabel(bundle, "code_cold", "en")).not.toBe("code_cold");
    // A code the bundle does not know falls back to itself rather than vanishing.
    expect(symptomLabel(bundle, "code_unknown", "en")).toBe("code_unknown");
  });

  it("asks only for symptoms flagged as needing clarification, in the chosen language", () => {
    expect(questionsFor(bundle, ["code_cold"], "ceb")).toHaveLength(0);
    expect(questionsFor(bundle, ["code_fever"], "ceb")[0]?.prompt).toBe("Unsa ka grabe?");
  });

  /*
   * The engine resolves a question by key alone, taking the first variant in
   * bundle order. So the answer SENT must be that variant's value at the
   * position the patient chose — otherwise a red-flag answer given in Cebuano
   * would not be recognised, and an emergency would read as routine.
   */
  it("submits the canonical answer for the position tapped, not the translated label", () => {
    const canonical = canonicalAnswer(bundle, "fever_severity", 1);
    expect(canonical).toBe("severe");

    const result = runTriage(bundle, state({ picked: ["code_fever"], answers: { fever_severity: canonical } }));
    expect(result.tier).toBe("emergency");
    expect(result.reason).toBe("red_flag_clarification");
  });
});

describe("the record that syncs", () => {
  it("carries codes and lexicon entries, never the patient's words (UT-012)", () => {
    const text = "naa koy sip-on ug hilanat, sakit kaayo akong ulo";
    const matches = matchSymptoms(text, bundle.lexiconTerms);
    const input = state({ matches, picked: ["code_fever"] });
    const session = buildSession({
      bundle,
      input,
      result: runTriage(bundle, input),
      barangayId: 4,
      language: "ceb",
      startedAt: "2026-09-18T01:00:00.000Z",
    });

    const json = JSON.stringify(session);
    expect(json).not.toContain("sakit kaayo akong ulo");
    expect(json).not.toContain(text);

    expect(session.symptoms.map((s) => s.symptom_code).sort()).toEqual(["code_cold", "code_fever"]);
    // The matched term is the server's own published vocabulary.
    expect(session.symptoms[0]?.matched_term).toEqual({ term: "sipon", language: "ceb" });
    expect(session.ruleset_version_label).toBe("v9");
    expect(session.barangay_id).toBe(4);
  });

  it("records a negated symptom as negated rather than dropping it", () => {
    const input = state({ matches: matchSymptoms("walay hilanat", bundle.lexiconTerms) });
    const session = buildSession({
      bundle,
      input,
      result: runTriage(bundle, input),
      barangayId: 1,
      language: "ceb",
      startedAt: "2026-09-18T01:00:00.000Z",
    });

    expect(session.symptoms).toEqual([
      { symptom_code: "code_fever", negated: true, matched_term: { term: "walay hilanat", language: "ceb" } },
    ]);
  });

  it("flags a red-flag answer so the server can see it too", () => {
    const input = state({ picked: ["code_fever"], answers: { fever_severity: "severe" } });
    const session = buildSession({
      bundle,
      input,
      result: runTriage(bundle, input),
      barangayId: 1,
      language: "en",
      startedAt: "2026-09-18T01:00:00.000Z",
    });

    expect(session.clarification_answers).toEqual([{ question_key: "fever_severity", answer: "severe", is_red_flag: true }]);
  });
});

describe("health tips", () => {
  it("shows tips for the tier in the patient's language only", () => {
    expect(tipsFor(bundle, "home", ["code_cold"], "ceb").map((t) => t.title)).toEqual(["Fixture tip"]);
    expect(tipsFor(bundle, "emergency", ["code_cold"], "ceb")).toEqual([]);
  });
});

describe("copy", () => {
  it("has every key in all three languages, so nothing falls back mid-screen", () => {
    const keys = Object.keys(DICTIONARIES.en).sort();
    expect(Object.keys(DICTIONARIES.tl).sort()).toEqual(keys);
    expect(Object.keys(DICTIONARIES.ceb).sort()).toEqual(keys);
  });

  it("fills placeholders", () => {
    expect(translate("en", "stepOf", { n: 2 })).toBe("Step 2 of 3");
    expect(translate("ceb", "barangayLine", { barangay: "Valladolid" })).toContain("Valladolid");
  });

  it("carries the disclaimer in every language, since it is on every result", () => {
    for (const language of ["en", "tl", "ceb"] as const) {
      expect(translate(language, "longDisclaimer").length).toBeGreaterThan(20);
    }
  });
});
