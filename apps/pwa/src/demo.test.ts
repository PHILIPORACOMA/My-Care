import { v1Bundle } from "@mycare/ruleset";
import { describe, expect, it } from "vitest";
import { demoPhraseTerms, withDemoLexicon } from "./demo";
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

  // Typo tolerance must never carry one phrase onto another symptom.
  it("reads every demo phrase, typed alone, as its own symptom and nothing else", () => {
    const wrong = demoPhraseTerms
      .map((t) => ({ term: t.term, want: t.symptomCode, got: matchSymptoms(t.term, demo.lexiconTerms) }))
      .filter(({ want, got }) => got.length !== 1 || got[0]!.symptomCode !== want || got[0]!.negated);
    expect(wrong).toEqual([]);
  });

  it("finds the phrases inside whole sentences, and triages them", () => {
    const tierOf = (text: string) => runTriage(demo, { picked: [], matches: matchSymptoms(text, demo.lexiconTerms), answers: {} }).tier;

    expect(tierOf("Naa koy hilanat ug giubo ko sukad gahapon")).toBe("home");
    expect(tierOf("labad akong ulo ug sakit akong lawas human sa trabaho")).toBe("home");
    expect(tierOf("tulo ka adlaw nga hilanat na ko")).toBe("rhu");
    expect(tierOf("gipaak sa iro akong tiil ganina")).toBe("rhu");
    expect(tierOf("may lagnat ako at hindi makahinga")).toBe("emergency");
    expect(tierOf("sakit kaayo akong tiyan karon")).toBe("emergency");
    expect(tierOf("I have a fever for 3 days now")).toBe("rhu");
  });

  // v1 has no code for ordinary stomach pain; the only abdominal one is emergency.
  it("leaves plain stomach pain unrecognised rather than calling it an emergency", () => {
    for (const text of ["sakit sa tiyan", "sakit ng tiyan", "stomach pain", "abdominal pain"]) {
      expect(matchSymptoms(text, demo.lexiconTerms)).toEqual([]);
    }
  });
});
