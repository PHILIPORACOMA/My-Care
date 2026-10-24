import { v1Bundle } from "@mycare/ruleset";
import { describe, expect, it } from "vitest";
import { withDemoLexicon } from "./demo";
import { chipsFor, matchSymptoms, runTriage, symptomLabel } from "./triage";

/*
 * Demo mode (`npm run dev:demo`): draft, unreviewed vocabulary on the device
 * only, so a prototype demo can show typed symptoms and translated chips
 * before the reviewed lexicon is published.
 */

const demo = withDemoLexicon(v1Bundle)!;

describe("demo mode", () => {
  it("never replaces a real lexicon", () => {
    const reviewed = { ...v1Bundle, lexiconTerms: [{ symptomCode: "fever_mild", language: "en" as const, term: "fever", isNegation: false }] };
    expect(withDemoLexicon(reviewed)).toBe(reviewed);
  });

  it("names every chip in Tagalog and Cebuano, and keeps English as v1 wrote it", () => {
    for (const language of ["tl", "ceb"] as const) {
      for (const chip of chipsFor(demo, language)) {
        expect(chip.label).not.toBe(v1Bundle.symptomCodes.find((c) => c.code === chip.code)!.displayName);
      }
    }
    expect(chipsFor(demo, "en")).toEqual(chipsFor(v1Bundle, "en"));
    expect(symptomLabel(demo, "chest_pain_severe_radiating", "tl")).toBe("Matinding sakit ng dibdib na umaabot sa braso o panga");
  });

  it("lets typed symptoms through to the real engine", () => {
    const matches = matchSymptoms("Chest Pain", demo.lexiconTerms);
    expect(matches.map((m) => m.symptomCode)).toEqual(["chest_pain_severe_radiating"]);
    expect(runTriage(demo, { picked: [], matches, answers: {} }).tier).toBe("emergency");
  });
});
