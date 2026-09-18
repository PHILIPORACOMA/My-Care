import type { LanguageCode, LexiconTerm } from "../schema.js";

/**
 * UNVALIDATED DEVELOPMENT DRAFT — not sourced from the Clinical Plausibility
 * and Content Validity Appraisal Form, unlike the rest of v1 (see v1.ts's
 * header and docs/REPO.md). That form defines the 23 symptom presentations
 * and their tiers, but does not specify lexicon wording, so there was
 * nothing to encode here without inventing it.
 *
 * This file exists to unblock free-text NLP testing in apps/pwa before that
 * clinical content exists. Every term below is a developer's plain-language
 * guess at how a patient might phrase each presentation in English, Filipino,
 * or Cebuano — written by someone who is not a native Cebuano speaker and not
 * a clinician. Expect wrong, incomplete, or clinically-imprecise entries.
 *
 * Do not treat this as clinically reviewed. Replace it wholesale once the
 * appraisal form (or an equivalent clinician-reviewed source) specifies real
 * lexicon content — do not incrementally patch guessed terms into "real"
 * ones in place, since that risks leaving unreviewed guesses undetected
 * alongside reviewed content.
 *
 * Matching model: apps/pwa's resolveSymptoms() does exact, case-insensitive,
 * whole-phrase matching (greedy longest-match over word tokens) — no
 * stemming, spelling correction, or synonym expansion beyond what's listed
 * here. A single generic word (e.g. "fever") is deliberately mapped only to
 * the mildest/most common presentation for that symptom family; the more
 * specific presentations (e.g. a persistent or high fever) require a longer,
 * more distinctive phrase, which greedy longest-match prefers automatically
 * (docs: apps/pwa/src/nlp/resolveSymptoms.ts).
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

export const v1LexiconTermsDraft: LexiconTerm[] = LEXICON_DRAFT_ENTRIES.flatMap((entry) => [
  ...toLexiconTerms(entry.code, entry.terms, false),
  ...toLexiconTerms(entry.code, entry.negationTerms ?? {}, true),
]);
