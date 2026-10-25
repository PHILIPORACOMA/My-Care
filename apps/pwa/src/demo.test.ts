import { v1Bundle } from "@mycare/ruleset";
import { describe, expect, it } from "vitest";
import { demoPhraseTerms, isDemoOnly, withDemoLexicon } from "./demo";
import { canonicalAnswer, chipsFor, matchSymptoms, questionsFor, runTriage, symptomLabel } from "./triage";

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
        expect(chip.label).not.toBe(demo.symptomCodes.find((c) => c.code === chip.code)!.displayName);
      }
    }
    expect(chipsFor(demo, "en").slice(0, v1Bundle.symptomCodes.length)).toEqual(chipsFor(v1Bundle, "en"));
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

  // Invented for demos: ordinary stomach pain asks how bad it is.
  it("asks how bad plain stomach pain is, and lets the answer decide", () => {
    const tierFor = (text: string, answerIndex = 0) => {
      const matches = matchSymptoms(text, demo.lexiconTerms);
      const codes = matches.map((m) => m.symptomCode);
      const questions = questionsFor(demo, codes, "ceb");
      const answers = Object.fromEntries(questions.map((q) => [q.questionKey, canonicalAnswer(demo, q.questionKey, answerIndex)]));
      return { codes, asked: questions.length, tier: runTriage(demo, { picked: [], matches, answers }).tier };
    };

    for (const text of ["sakit sa tiyan", "sakit ng tiyan", "stomach pain", "stomach ache", "my stomach hurts so bad"]) {
      expect(tierFor(text, 0)).toEqual({ codes: ["demo_abdominal_pain"], asked: 1, tier: "rhu" });
      expect(tierFor(text, 1).tier).toBe("rhu");
      expect(tierFor(text, 2).tier).toBe("emergency");
    }
    // The severe phrases still skip the question and go straight to emergency.
    expect(tierFor("grabe nga sakit sa tiyan")).toEqual({ codes: ["abdominal_pain_severe_rigidity"], asked: 0, tier: "emergency" });
  });

  it("keeps checks that used the invented presentation off the sync queue", () => {
    expect(isDemoOnly(["demo_abdominal_pain"])).toBe(true);
    expect(isDemoOnly(["fever_mild", "demo_abdominal_pain"])).toBe(true);
    expect(isDemoOnly(["fever_mild"])).toBe(false);
  });
});
