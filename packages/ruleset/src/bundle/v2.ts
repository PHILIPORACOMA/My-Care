import type { ClarificationQuestion, HealthTip, LanguageCode, RulesetBundle, SymptomCode, Tier, TriageRule } from "../schema.js";
import { v1Bundle, v1Rules, v1SymptomCodes } from "./v1.js";

/**
 * v2 draft ruleset: v1's 23 presentations, unchanged, plus 26 common adult
 * complaints from Part D of the Lexicon and Symptom Vocabulary Appraisal Form
 * (Instrument L-1.0, Batch 2, 5 November 2026), completed 2026-11-04 by a
 * nurse with under three years' clinical experience who did not consent to be
 * named. Each complaint the appraiser marked "include" is encoded with the
 * tier they ticked, in form order, as its own atomic symptom code — the same
 * 1-symptom-to-1-rule shape as v1.
 *
 * Two readings were settled by Philipo (2026-11-07), not by the appraiser:
 * - "Insect sting or snake bite" had both RHU and E ticked. It is split into
 *   insect_sting (rhu) and snake_bite (emergency).
 * - "Back pain" had a faint tick on H; read as home.
 *
 * Added after the appraisal, at Philipo's request (2026-11-15), NOT from the
 * form, and needing the appraiser's review:
 * - A "Is the pain severe?" follow-up on ordinary stomach pain and on a new
 *   chest_pain_unspecified presentation, so a plain "my stomach / chest hurts"
 *   does not have to be either Emergency or nothing. "Yes" is the red-flag
 *   answer (Emergency, ADR-0001 step 1). "No" keeps ordinary stomach pain at
 *   the tier the appraiser ticked (home) and, on Philipo's decision of
 *   2026-11-16, sends unspecified chest pain to home as well, with a tip. A
 *   rhu for chest was proposed first, because a patient with a heart problem
 *   may well answer "No"; Philipo chose home, and the tip puts the warning
 *   signs first. The appraiser has never ruled on chest pain "not severe".
 * - Three home tips each for ordinary stomach pain and unspecified chest pain:
 *   what can help, when to get help right away, and what to do if the pain
 *   does not go away. The stomach "does not go away" tip is the appraiser's
 *   own wording (pain over 24 hours with no relief from medication: RHU). The
 *   rest was drafted by Claude at Philipo's request for the appraiser to
 *   review. It names no medicine and gives no dose. All of it, and the tl and
 *   ceb wording, is unreviewed.
 *
 * Deliberately not encoded yet:
 * - The appraiser answered "follow-up needed" for every complaint and wrote
 *   escalation conditions beside some (pain over 24 hours with no relief,
 *   abdominal distention, tinnitus or hearing loss, rule out cardiac). Each
 *   needs a clarification question with fixed answers, which Philipo will
 *   type up; until then every other complaint here resolves to its tier directly.
 * - No lexicon terms: Batch 2 returned no resident words. The new codes are
 *   reachable as chips (English display name) until terms are entered, and
 *   unrecognised free text already falls to the rhu fail-safe.
 * - No other health tips: the form gives none, and they are medical content.
 *
 * One appraiser, unreviewed: this is a draft for clinical review, not a
 * validated ruleset.
 */

interface Presentation {
  code: string;
  displayName: string;
  tier: Tier;
}

const BATCH2_PRESENTATIONS: Presentation[] = [
  { code: "abdominal_pain_ordinary", displayName: "Ordinary stomach / abdominal pain, not severe, no rigidity", tier: "home" },
  { code: "nausea_vomiting", displayName: "Nausea or vomiting", tier: "rhu" },
  { code: "heartburn_acid_reflux", displayName: "Heartburn / acid reflux", tier: "emergency" },
  { code: "constipation", displayName: "Constipation", tier: "home" },
  { code: "blood_in_stool", displayName: "Blood in stool or black stool", tier: "emergency" },
  { code: "sore_throat", displayName: "Sore throat", tier: "home" },
  { code: "runny_blocked_nose", displayName: "Runny or blocked nose, sneezing", tier: "home" },
  { code: "ear_pain_discharge", displayName: "Ear pain or ear discharge", tier: "rhu" },
  { code: "toothache_swollen_gums", displayName: "Toothache or swollen gums", tier: "home" },
  { code: "red_itchy_eyes", displayName: "Red, itchy or discharging eyes", tier: "home" },
  { code: "skin_rash_itching", displayName: "Skin rash or itching", tier: "rhu" },
  { code: "boil_abscess", displayName: "Boil, abscess or skin swelling with pus", tier: "rhu" },
  { code: "burns", displayName: "Burns", tier: "emergency" },
  { code: "sprain_joint_injury", displayName: "Sprain, twisted ankle or joint injury", tier: "rhu" },
  { code: "back_pain", displayName: "Back pain", tier: "home" },
  { code: "joint_pain_swelling", displayName: "Joint pain or swelling", tier: "rhu" },
  { code: "painful_urination", displayName: "Painful or burning urination", tier: "rhu" },
  { code: "dizziness_fainting", displayName: "Dizziness or fainting", tier: "emergency" },
  { code: "palpitations", displayName: "Fast or pounding heartbeat (palpitations)", tier: "rhu" },
  { code: "numbness_tingling", displayName: "Numbness or tingling", tier: "rhu" },
  { code: "swollen_feet_legs", displayName: "Swollen feet or legs", tier: "rhu" },
  { code: "tiredness_weakness", displayName: "Unusual tiredness or weakness", tier: "rhu" },
  { code: "fever_with_rash_or_bleeding", displayName: "Fever with rash, or bleeding gums / nose", tier: "emergency" },
  { code: "insect_sting", displayName: "Insect sting", tier: "rhu" },
  { code: "snake_bite", displayName: "Snake bite", tier: "emergency" },
  { code: "vaginal_discharge_itching", displayName: "Vaginal discharge or itching (not pregnant)", tier: "rhu" },
];

/**
 * Presentations added after the appraisal form (see the header). Kept apart from
 * the form's 26 so those stay exactly as appraised.
 */
const FOLLOW_UP_PRESENTATIONS: Presentation[] = [
  { code: "chest_pain_unspecified", displayName: "Chest pain (any kind)", tier: "home" },
];

/** Codes that ask "Is the pain severe?" before a tier is decided. */
const ASKS_IF_SEVERE = new Set(["abdominal_pain_ordinary", "chest_pain_unspecified"]);

export const batch2SymptomCodes: SymptomCode[] = [...BATCH2_PRESENTATIONS, ...FOLLOW_UP_PRESENTATIONS].map((p) => ({
  code: p.code,
  displayName: p.displayName,
  needsClarification: ASKS_IF_SEVERE.has(p.code),
}));

// Numbering and priority continue from v1's, so R-001..R-023 mean the same
// rule in both versions.
export const batch2Rules: TriageRule[] = [...BATCH2_PRESENTATIONS, ...FOLLOW_UP_PRESENTATIONS].map((p, index) => {
  const n = v1Rules.length + index + 1;
  return {
    code: `R-${String(n).padStart(3, "0")}`,
    name: p.displayName,
    expression: `IF ${p.code} THEN ${p.tier}`,
    conditions: [{ symptomCode: p.code, operator: "AND" }],
    outcomeTier: p.tier,
    priority: n,
    isActive: true,
  };
});

/** English first: the engine checks an answer against the first variant (canonicalAnswer in the app). */
const YES_NO: Record<LanguageCode, string[]> = { en: ["No", "Yes"], tl: ["Hindi", "Oo"], ceb: ["Dili", "Oo"] };

const SEVERE_PROMPTS: { key: string; symptomCode: string; prompt: Record<LanguageCode, string> }[] = [
  {
    key: "abdominal_pain_severe",
    symptomCode: "abdominal_pain_ordinary",
    prompt: { en: "Is the stomach pain severe?", tl: "Matindi ba ang sakit ng tiyan?", ceb: "Grabe ba ang sakit sa tiyan?" },
  },
  {
    key: "chest_pain_severe",
    symptomCode: "chest_pain_unspecified",
    prompt: { en: "Is the chest pain severe?", tl: "Matindi ba ang sakit ng dibdib?", ceb: "Grabe ba ang sakit sa dughan?" },
  },
];

/** "Yes" is the red-flag answer in every language: Emergency at once (ADR-0001 step 1). */
export const batch2Questions: ClarificationQuestion[] = SEVERE_PROMPTS.flatMap((q) =>
  (["en", "tl", "ceb"] as const).map((language) => ({
    questionKey: q.key,
    symptomCode: q.symptomCode,
    language,
    prompt: q.prompt[language],
    answerType: "single_select" as const,
    allowedAnswers: YES_NO[language],
    redFlagAnswer: YES_NO[language][1]!,
  }))
);

type Words = Record<LanguageCode, string>;

/**
 * Home-tier tips shown after "No" to "Is the pain severe?" (Figure 28). MEDICAL
 * CONTENT drafted by Claude for the appraiser's review, in the order shown. The
 * one exception is stomach tip 3, which is the appraiser's own condition. No
 * medicine is named and no dose given. The chest warning signs come first on
 * purpose: a patient with a heart problem may well have answered "No".
 */
const HOME_TIPS: { symptomCode: string; tips: { title: Words; body: Words }[] }[] = [
  {
    symptomCode: "abdominal_pain_ordinary",
    tips: [
      {
        title: { en: "What can help", tl: "Ano ang makakatulong", ceb: "Unsa ang makatabang" },
        body: {
          en: "Rest. Drink water in small sips. Eat light, plain food such as rice porridge. Avoid oily or spicy food, coffee, soft drinks and alcohol until the pain is gone.",
          tl: "Magpahinga. Uminom ng tubig nang paunti-unti. Kumain ng magaan at simpleng pagkain tulad ng lugaw. Iwasan ang mamantika o maanghang na pagkain, kape, softdrinks at alak hanggang mawala ang sakit.",
          ceb: "Pahulay. Imnon ang tubig sa gagmay nga hugop. Kaon ug magaan ug yano nga pagkaon sama sa lugaw. Likayi ang tambok o maanghang nga pagkaon, kape, softdrinks ug bino hangtod mawala ang sakit.",
        },
      },
      {
        title: { en: "Get help right away if", tl: "Humingi agad ng tulong kung", ceb: "Pagpangayo dayon ug tabang kung" },
        body: {
          en: "Go to the nearest hospital now if the pain gets much worse, your belly becomes hard or swollen, you vomit blood, you have black stool, or you cannot stop vomiting.",
          tl: "Pumunta agad sa pinakamalapit na ospital kung lumalala nang husto ang sakit, tumigas o namaga ang tiyan, nagsuka ka ng dugo, may maitim kang dumi, o hindi ka tumitigil sa pagsusuka.",
          ceb: "Adto dayon sa pinakaduol nga ospital kung mograbe pag-ayo ang sakit, mogahi o mohubag ang tiyan, nagsuka ka ug dugo, naay itom nga tae, o dili ka mohunong sa pagsuka.",
        },
      },
      {
        // The appraiser's own condition, unchanged.
        title: { en: "If the pain does not go away", tl: "Kung hindi nawawala ang sakit", ceb: "Kung dili mawala ang sakit" },
        body: {
          en: "If the pain lasts more than 24 hours, or medicine does not help, go to your Rural Health Unit.",
          tl: "Kung tumagal ang sakit nang higit sa 24 oras, o hindi ito nawawala kahit uminom ng gamot, pumunta sa Rural Health Unit.",
          ceb: "Kung molapas sa 24 ka oras ang sakit, o dili kini mawala bisan nakainom na ug tambal, adto sa Rural Health Unit.",
        },
      },
    ],
  },
  {
    symptomCode: "chest_pain_unspecified",
    tips: [
      {
        title: { en: "Get help right away if", tl: "Humingi agad ng tulong kung", ceb: "Pagpangayo dayon ug tabang kung" },
        body: {
          en: "Go to the nearest hospital now if the pain spreads to your arm, jaw or back, or comes with trouble breathing, cold sweat or feeling faint, or if it gets worse.",
          tl: "Pumunta agad sa pinakamalapit na ospital kung kumakalat ang sakit sa braso, panga o likod, o may kasamang hirap sa paghinga, malamig na pawis o pakiramdam na mahihimatay, o kung lumalala ito.",
          ceb: "Adto dayon sa pinakaduol nga ospital kung mokaylap ang sakit sa bukton, apapangig o likod, o naay kauban nga lisod ginhawa, bugnaw nga singot o gibati nga mahimatay, o kung mograbe kini.",
        },
      },
      {
        title: { en: "What can help", tl: "Ano ang makakatulong", ceb: "Unsa ang makatabang" },
        body: {
          en: "Stop what you are doing and rest sitting up. Avoid heavy work, smoking and coffee for now.",
          tl: "Itigil ang ginagawa at magpahinga nang nakaupo. Iwasan muna ang mabibigat na gawain, paninigarilyo at kape.",
          ceb: "Undanga ang imong gihimo ug pahulay nga naglingkod. Likayi una ang bug-at nga trabaho, pagsigarilyo ug kape.",
        },
      },
      {
        title: { en: "If the pain does not go away", tl: "Kung hindi nawawala ang sakit", ceb: "Kung dili mawala ang sakit" },
        body: {
          en: "If the pain does not go away after resting, or it keeps coming back, go to your Rural Health Unit the same day.",
          tl: "Kung hindi nawawala ang sakit pagkatapos magpahinga, o paulit-ulit itong bumabalik, pumunta sa Rural Health Unit sa araw ding iyon.",
          ceb: "Kung dili mawala ang sakit human mopahulay, o balik-balik kini, adto sa Rural Health Unit niana ding adlawa.",
        },
      },
    ],
  },
];

export const batch2HealthTips: HealthTip[] = HOME_TIPS.flatMap(({ symptomCode, tips }) =>
  tips.flatMap((tip, index) =>
    (["en", "tl", "ceb"] as const).map((language) => ({
      symptomCode,
      outcomeTier: "home" as const,
      language,
      title: tip.title[language],
      body: tip.body[language],
      displayOrder: index + 1,
    }))
  )
);

export const v2SymptomCodes: SymptomCode[] = [...v1SymptomCodes, ...batch2SymptomCodes];

export const v2Rules: TriageRule[] = [...v1Rules, ...batch2Rules];

export const v2Bundle: RulesetBundle = {
  ...v1Bundle,
  versionLabel: "v2-draft",
  symptomCodes: v2SymptomCodes,
  rules: v2Rules,
  clarificationQuestions: [...v1Bundle.clarificationQuestions, ...batch2Questions],
  healthTips: [...v1Bundle.healthTips, ...batch2HealthTips],
};
