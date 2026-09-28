import type { Tier } from "@mycare/ruleset";
import { v1TestLexiconBundle } from "@mycare/ruleset/testing";
import { describe, expect, it } from "vitest";
import { matchSymptoms, resolveCodes, runTriage } from "./triage";

/*
 * Free text all the way to a tier: the patient's words, the real lexicon
 * matcher, the real v1 rules and the real engine. Nothing is mocked.
 *
 * The lexicon is the INVENTED TEST FIXTURE (@mycare/ruleset/testing, see
 * lexicon-fixture.ts), not reviewed vocabulary. These tests prove the
 * mechanism works in all three languages; they say nothing about whether a
 * given Cebuano or Tagalog phrase is the right one. The expected tiers are
 * v1's, from the Clinical Appraisal Form.
 */

const bundle = v1TestLexiconBundle;

function triage(text: string) {
  const matches = matchSymptoms(text, bundle.lexiconTerms);
  const input = { picked: [], matches, answers: {} };
  return { ...resolveCodes(input), result: runTriage(bundle, input) };
}

describe("free text to a tier, with the test lexicon (UT-002, UT-005)", () => {
  const cases: [language: string, text: string, code: string, tier: Tier][] = [
    ["Cebuano", "hilanat", "fever_mild", "home"],
    ["Cebuano", "sakit sa ulo", "headache_mild_moderate", "home"],
    ["Cebuano", "dugay na ubo", "cough_persistent", "rhu"],
    ["Cebuano", "kagat sa iro", "animal_bite_stable", "rhu"],
    ["Cebuano", "lisod ginhawa", "difficulty_breathing", "emergency"],
    ["Tagalog", "lagnat", "fever_mild", "home"],
    ["Tagalog", "mataas na presyon", "elevated_bp_mild_stable", "rhu"],
    ["Tagalog", "hirap huminga", "difficulty_breathing", "emergency"],
    ["English", "shortness of breath", "difficulty_breathing", "emergency"],
  ];

  it.each(cases)("%s: %j gives %s, %s", (_language, text, code, tier) => {
    const { present, result } = triage(text);
    expect(present).toEqual([code]);
    expect(result.tier).toBe(tier);
  });
});

describe("the matcher's rules, on real phrases", () => {
  it("UT-003: absorbs a spelling variation (sip-on and sipon)", () => {
    expect(triage("sip-on").present).toEqual(["cold_cough_no_sob"]);
    expect(triage("sipon").present).toEqual(["cold_cough_no_sob"]);
  });

  it("UT-004: 'walay hilanat' excludes fever rather than flagging it", () => {
    const { present, negated } = triage("walay hilanat");
    expect(present).toEqual([]);
    expect(negated).toEqual(["fever_mild"]);
  });

  it("a negation in the same sentence excludes only its own symptom", () => {
    const { present, negated, result } = triage("sakit sa ulo, walay hilanat");
    expect(present).toEqual(["headache_mild_moderate"]);
    expect(negated).toEqual(["fever_mild"]);
    expect(result.tier).toBe("home");
  });

  it("a longer phrase beats a word inside it: 'dugay na hilanat' is a persistent fever", () => {
    const { present, result } = triage("dugay na hilanat");
    expect(present).toEqual(["fever_persistent"]);
    expect(result.tier).toBe("rhu");
  });

  it("several symptoms, mixed languages: the highest tier wins", () => {
    const { present, result } = triage("hilanat, ubo, hirap huminga");
    expect(present).toEqual(expect.arrayContaining(["fever_mild", "cold_cough_no_sob", "difficulty_breathing"]));
    expect(result.tier).toBe("emergency");
  });

  it("words the lexicon does not know resolve to nothing, never to a guess", () => {
    expect(triage("qwerty asdf").present).toEqual([]);
  });
});

describe("known limits of the test lexicon, pinned so nobody mistakes them for correct", () => {
  it("README's example sentence: the duration is not understood, so it reads as mild fever and cold", () => {
    // "hilanat ug ubo, tulo ka adlaw na" = fever and cough, three days now.
    // Nothing in the fixture encodes a duration, so this is home. Reviewed
    // terms (or a clarification question) must decide what three days means.
    const { present, result } = triage("hilanat ug ubo, tulo ka adlaw na");
    expect(present).toEqual(expect.arrayContaining(["fever_mild", "cold_cough_no_sob"]));
    expect(result.tier).toBe("home");
  });

  it("a bare 'chest pain' goes straight to emergency", () => {
    expect(triage("chest pain").result.tier).toBe("emergency");
  });
});
