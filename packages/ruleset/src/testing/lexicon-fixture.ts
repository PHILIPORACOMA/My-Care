import type { LanguageCode, LexiconTerm } from "../schema.js";

/**
 * TEST FIXTURE ONLY. INVENTED, NOT CLINICALLY REVIEWED. NEVER SHIP IT.
 *
 * These terms are kizaru3214's development draft from PR #2 (commit f1d0a0a,
 * branch feat/pwa-ui-polish), copied without changing a single term. They are
 * a developer's guess at how a patient might phrase each of v1's 23
 * presentations, written by someone who is neither a native Cebuano speaker
 * nor a clinician. The Clinical Appraisal Form defines the presentations and
 * their tiers but no lexicon wording.
 *
 * Philipo approved using them on 2026-09-27 for one purpose: to exercise
 * free-text triage end to end (UT-002 to UT-005) before the reviewed terms
 * exist. So they live here, behind the separate `@mycare/ruleset/testing`
 * entry point, and:
 *
 *  - v1Bundle.lexiconTerms stays empty. testing.test.ts fails if that changes
 *    or if the main entry point ever re-exports this file.
 *  - dist/v1.json never contains them. They go only into
 *    dist/v1-test-lexicon.json (npm run export:test-lexicon), for a
 *    development database, and into the throwaway mycare_e2e schema.
 *  - The reviewed terms replace them wholesale. Never patch a guessed term
 *    into a "real" one here.
 *
 * Known clinical problems, fine for a test and unacceptable for a patient:
 *
 *  - A bare "fever" / "lagnat" / "hilanat" maps to fever_mild, a HOME tier.
 *    A patient with a high or long fever who types only that word is
 *    under-triaged.
 *  - A bare "chest pain" maps straight to chest_pain_severe_radiating, an
 *    EMERGENCY tier.
 *
 * The matcher is packages/lexicon-matcher: negation terms first, then longer
 * terms before shorter ones, with small spelling variations absorbed. So
 * "dugay na hilanat" resolves to fever_persistent, not fever_mild.
 */

interface LexiconDraftEntry {
  code: string;
  /** Positive-mention terms, by language. */
  terms: Partial<Record<LanguageCode, string[]>>;
  /** Terms that mean "I do NOT have this" — suppress the code even if a positive term also matched. */
  negationTerms?: Partial<Record<LanguageCode, string[]>>;
}

const LEXICON_DRAFT_ENTRIES: LexiconDraftEntry[] = [
  // Home
  {
    code: "fever_mild",
    terms: { en: ["fever"], tl: ["lagnat"], ceb: ["hilanat"] },
    negationTerms: { en: ["no fever"], tl: ["walang lagnat"], ceb: ["walay hilanat"] },
  },
  {
    code: "cold_cough_no_sob",
    terms: { en: ["cough", "cold"], tl: ["ubo", "sipon"], ceb: ["ubo", "sip-on"] },
    negationTerms: { en: ["no cough"], tl: ["walang ubo"], ceb: ["walay ubo"] },
  },
  {
    code: "headache_mild_moderate",
    terms: { en: ["headache"], tl: ["sakit ng ulo"], ceb: ["sakit sa ulo"] },
  },
  {
    code: "minor_wound_no_infection",
    terms: { en: ["wound", "cut", "scrape"], tl: ["sugat", "gasgas"], ceb: ["samad", "gasgas"] },
  },
  {
    code: "diarrhea_mild_no_dehydration",
    terms: { en: ["diarrhea", "loose stools"], tl: ["pagtatae"], ceb: ["kalibang", "libang"] },
  },
  {
    code: "muscle_pain_post_exertion",
    terms: { en: ["body pain", "muscle pain"], tl: ["sakit ng katawan"], ceb: ["sakit sa lawas"] },
  },

  // RHU
  {
    code: "fever_persistent",
    terms: {
      en: ["persistent fever", "fever for days"],
      tl: ["matagal na lagnat"],
      ceb: ["dugay na hilanat"],
    },
  },
  {
    code: "cough_persistent",
    terms: { en: ["persistent cough", "cough for weeks"], tl: ["matagal na ubo"], ceb: ["dugay na ubo"] },
  },
  {
    code: "diarrhea_mild_dehydration",
    terms: {
      en: ["dehydrated", "dizzy and diarrhea"],
      tl: ["na-dehydrate", "nahihilo at pagtatae"],
      ceb: ["na-dehydrate", "nalipong ug kalibang"],
    },
  },
  {
    code: "elevated_bp_mild_stable",
    terms: {
      en: ["high blood pressure", "elevated blood pressure"],
      tl: ["mataas na presyon"],
      ceb: ["taas nga presyon"],
    },
  },
  {
    code: "wound_early_infection",
    terms: {
      en: ["infected wound", "swollen wound"],
      tl: ["namamagang sugat"],
      ceb: ["nanghubag nga samad"],
    },
  },
  {
    code: "spotting_first_trimester_mild",
    terms: {
      en: ["light bleeding while pregnant", "spotting pregnant"],
      tl: ["kaunting dugo habang buntis"],
      ceb: ["gamay nga dugo samtang mabdos"],
    },
  },
  {
    code: "animal_bite_stable",
    terms: {
      en: ["animal bite", "dog bite"],
      tl: ["kagat ng hayop", "kagat ng aso"],
      ceb: ["kagat sa hayop", "kagat sa iro"],
    },
  },
  {
    code: "excessive_thirst_urination",
    terms: {
      en: ["excessive thirst", "frequent urination"],
      tl: ["sobrang uhaw", "madalas umihi"],
      ceb: ["sobra nga kauhaw", "kanunay mihi"],
    },
  },

  // Emergency
  {
    code: "difficulty_breathing",
    terms: {
      en: ["difficulty breathing", "shortness of breath", "hard to breathe"],
      tl: ["hirap huminga"],
      ceb: ["lisod ginhawa"],
    },
    negationTerms: {
      en: ["no difficulty breathing"],
      tl: ["hindi hirap huminga"],
      ceb: ["dili lisod ginhawa"],
    },
  },
  {
    code: "chest_pain_severe_radiating",
    terms: {
      en: ["chest pain", "severe chest pain"],
      tl: ["matinding sakit ng dibdib"],
      ceb: ["grabe nga sakit sa dughan"],
    },
  },
  {
    code: "stroke_signs",
    terms: {
      en: ["face drooping", "slurred speech", "weak on one side"],
      tl: ["baluktot ang mukha", "nauutal ang pagsasalita"],
      ceb: ["baliko nga nawong", "lisod mosulti"],
    },
  },
  {
    code: "abdominal_pain_severe_rigidity",
    terms: {
      en: ["severe stomach pain", "rigid abdomen", "hard stomach"],
      tl: ["matinding sakit ng tiyan", "matigas na tiyan"],
      ceb: ["grabe nga sakit sa tiyan", "gahi nga tiyan"],
    },
  },
  {
    code: "vaginal_bleeding_heavy_pregnancy",
    terms: {
      en: ["heavy bleeding while pregnant", "heavy vaginal bleeding"],
      tl: ["malakas na pagdurugo habang buntis"],
      ceb: ["kusog nga pagdugo samtang mabdos"],
    },
  },
  {
    code: "seizure_loss_of_consciousness",
    terms: {
      en: ["seizure", "convulsions", "unconscious"],
      tl: ["kombulsyon", "nawalan ng malay"],
      ceb: ["kombulsyon", "nawad-an og panimuot"],
    },
  },
  {
    code: "allergic_reaction_severe",
    terms: {
      en: ["allergic reaction", "swollen face", "throat swelling"],
      tl: ["namamagang mukha", "namamagang lalamunan"],
      ceb: ["nanghubag nga nawong", "nanghubag nga tutunlan"],
    },
  },
  {
    code: "bleeding_severe_uncontrolled",
    terms: {
      en: ["severe bleeding", "won't stop bleeding"],
      tl: ["matinding pagdurugo"],
      ceb: ["grabe nga pagdugo"],
    },
  },
  {
    code: "fever_high_stiff_neck_altered_consciousness",
    terms: {
      en: ["stiff neck", "neck stiffness"],
      tl: ["matigas na leeg"],
      ceb: ["gahi nga liog"],
    },
  },
];

function toLexiconTerms(
  code: string,
  byLanguage: Partial<Record<LanguageCode, string[]>>,
  isNegation: boolean
): LexiconTerm[] {
  return (Object.entries(byLanguage) as [LanguageCode, string[]][]).flatMap(([language, terms]) =>
    terms.map((term) => ({ symptomCode: code, language, term, isNegation }))
  );
}

export const testLexiconTerms: LexiconTerm[] = LEXICON_DRAFT_ENTRIES.flatMap((entry) => [
  ...toLexiconTerms(entry.code, entry.terms, false),
  ...toLexiconTerms(entry.code, entry.negationTerms ?? {}, true),
]);
