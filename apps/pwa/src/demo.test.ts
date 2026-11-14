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

  // Invented for demos: the milder v1 presentations ask, and can only go up.
  it("asks follow-up questions that can only raise a mild presentation's tier", () => {
    /** Triage `text`, answering each question by key with the given position (0 if unlisted). */
    const triage = (text: string, picks: Record<string, number> = {}) => {
      const matches = matchSymptoms(text, demo.lexiconTerms);
      const codes = matches.filter((m) => !m.negated).map((m) => m.symptomCode);
      const questions = questionsFor(demo, codes, "tl");
      const answers = Object.fromEntries(
        questions.map((q) => [q.questionKey, canonicalAnswer(demo, q.questionKey, picks[q.questionKey] ?? 0)])
      );
      return { asked: questions.map((q) => q.questionKey), tier: runTriage(demo, { picked: [], matches, answers }).tier };
    };

    // Fever: days, then red flags. Answer positions: "1".."7", "No"/"Yes".
    expect(triage("hilanat")).toEqual({ asked: ["demo_fever_days", "demo_fever_red_flags"], tier: "home" });
    expect(triage("hilanat", { demo_fever_days: 1 }).tier).toBe("home");
    expect(triage("hilanat", { demo_fever_days: 2 }).tier).toBe("rhu");
    expect(triage("hilanat", { demo_fever_days: 6 }).tier).toBe("rhu");
    expect(triage("hilanat", { demo_fever_red_flags: 1 }).tier).toBe("emergency");

    // Cough: weeks, then red flags.
    expect(triage("ubo").asked).toEqual(["demo_cough_weeks", "demo_cough_red_flags"]);
    expect(triage("ubo", { demo_cough_weeks: 1 }).tier).toBe("home");
    expect(triage("ubo", { demo_cough_weeks: 2 }).tier).toBe("rhu");
    expect(triage("ubo", { demo_cough_red_flags: 1 }).tier).toBe("emergency");

    // Diarrhea: days, then red flags.
    expect(triage("nagtatae", { demo_diarrhea_days: 0 }).tier).toBe("home");
    expect(triage("nagtatae", { demo_diarrhea_days: 1 }).tier).toBe("rhu");
    expect(triage("nagtatae", { demo_diarrhea_red_flags: 1 }).tier).toBe("emergency");

    // Red-flag questions alone: "No" keeps v1's tier, "Yes" is emergency.
    for (const [text, key, v1Tier] of [
      ["sakit sa ulo", "demo_headache_red_flags", "home"],
      ["gamay nga samad", "demo_wound_red_flags", "home"],
      ["high blood", "demo_bp_red_flags", "rhu"],
      ["spotting while pregnant", "demo_spotting_red_flags", "rhu"],
      ["always thirsty", "demo_thirst_red_flags", "rhu"],
    ] as const) {
      expect(triage(text)).toEqual({ asked: [key], tier: v1Tier });
      expect(triage(text, { [key]: 1 }).tier).toBe("emergency");
    }

    // Emergency presentations ask nothing.
    expect(triage("hindi makahinga")).toEqual({ asked: [], tier: "emergency" });
  });

  it("asks every follow-up in all three languages, with the same answers in the same order", () => {
    const keys = [...new Set(demo.clarificationQuestions.map((q) => q.questionKey))];
    for (const key of keys) {
      const variants = demo.clarificationQuestions.filter((q) => q.questionKey === key);
      expect(variants.map((q) => q.language)).toEqual(["en", "tl", "ceb"]);
      const lengths = new Set(variants.map((q) => q.allowedAnswers.length));
      expect(lengths.size).toBe(1);
      const redFlagAt = new Set(variants.map((q) => (q.redFlagAnswer === undefined ? -1 : q.allowedAnswers.indexOf(q.redFlagAnswer))));
      expect(redFlagAt.size).toBe(1);
    }
  });

  it("keeps checks that used invented content off the sync queue", () => {
    expect(isDemoOnly(["demo_abdominal_pain"])).toBe(true);
    expect(isDemoOnly(["fever_mild", "demo_abdominal_pain"])).toBe(true);
    expect(isDemoOnly(["fever_mild"], ["demo_fever_days"])).toBe(true);
    expect(isDemoOnly(["fever_mild"])).toBe(false);
    expect(isDemoOnly(["chest_pain_severe_radiating"], [])).toBe(false);
  });
});
