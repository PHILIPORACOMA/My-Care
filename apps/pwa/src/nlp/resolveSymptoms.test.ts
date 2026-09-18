import { describe, expect, it } from "vitest";
import { buildLexiconIndex } from "./lexicon.js";
import { resolveSymptoms } from "./resolveSymptoms.js";

const index = buildLexiconIndex([
  { symptomCode: "fever_mild", language: "ceb", term: "hilanat", isNegation: false },
  { symptomCode: "fever_mild", language: "ceb", term: "walay hilanat", isNegation: true },
  { symptomCode: "cold_cough_no_sob", language: "ceb", term: "ubo", isNegation: false },
  { symptomCode: "fever_persistent", language: "en", term: "persistent fever", isNegation: false },
  { symptomCode: "fever_mild", language: "en", term: "fever", isNegation: false },
  { symptomCode: "difficulty_breathing", language: "en", term: "shortness of breath", isNegation: false },
]);

describe("resolveSymptoms", () => {
  it("resolves a single matching term to its symptom code", () => {
    expect(resolveSymptoms("hilanat", index)).toEqual(["fever_mild"]);
  });

  it("resolves multiple distinct symptom codes from one free-text input", () => {
    expect(resolveSymptoms("hilanat ug ubo", index).sort()).toEqual(["cold_cough_no_sob", "fever_mild"]);
  });

  it("is case-insensitive", () => {
    expect(resolveSymptoms("HILANAT", index)).toEqual(["fever_mild"]);
  });

  it("ignores tokens with no lexicon match", () => {
    expect(resolveSymptoms("wala koy sakit", index)).toEqual([]);
  });

  it("a phrase-level negation term suppresses its symptom code, even alongside a positive mention", () => {
    expect(resolveSymptoms("walay hilanat", index)).toEqual([]);
  });

  it("returns no symptom codes for empty input", () => {
    expect(resolveSymptoms("", index)).toEqual([]);
  });

  it("matches a multi-word phrase embedded in a longer sentence", () => {
    expect(resolveSymptoms("i have shortness of breath since morning", index)).toEqual(["difficulty_breathing"]);
  });

  it("greedy longest-match: a specific phrase wins over a shorter generic term it contains", () => {
    expect(resolveSymptoms("i have a persistent fever", index)).toEqual(["fever_persistent"]);
  });

  it("falls back to the shorter generic term when the longer phrase isn't present", () => {
    expect(resolveSymptoms("i have a fever", index)).toEqual(["fever_mild"]);
  });
});
