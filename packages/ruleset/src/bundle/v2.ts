import type {
  ClarificationQuestion,
  HealthTip,
  LanguageCode,
  RulesetBundle,
  SeverityThreshold,
  SymptomCode,
  Tier,
  TriageRule,
} from "../schema.js";
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
 * Added from Part C of the same form (2026-11-16): seven follow-up questions
 * on six v1 presentations and an animal-bite tip. See FOLLOW_UPS below.
 *
 * Deliberately not encoded yet:
 * - The appraiser answered "follow-up needed" for every Part D complaint and
 *   wrote escalation conditions beside some (pain over 24 hours with no relief,
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

/**
 * Batch 2 Part C follow-up questions on six v1 presentations. The appraiser's
 * Part C wording was mostly illegible, so Claude drafted these at Philipo's
 * request from what was legible; the appraiser approved all of them, and the
 * Tagalog and Cebuano, on the 2026-11-16 review sheet (BUILD-LOG 9an, 9ao).
 * MEDICAL CONTENT from one appraiser: a draft for clinical review, not a
 * validated ruleset.
 *
 * Each answer leads to a result:
 * - the `home` answer keeps the presentation at its v1 tier (home). Any other
 *   answer matches a new rhu rule, "<questionKey> != <home answer>", whose
 *   threshold holds the English home answer (ADR-0001: text comparison);
 * - the `redFlag` answer is Emergency at once (ADR-0001 step 1);
 * - a question can only keep or raise a result. The v1 rule still matches.
 * A question the patient does not answer keeps the v1 tier, as with the
 * stomach and chest questions above.
 *
 * English is listed first. The phone submits, and the server stores, the
 * answer worded as in the English variant (ADR-0006), so the threshold values
 * are English and every English answer fits the 50-character answer column.
 */
interface FollowUp {
  key: string;
  symptomCode: string;
  prompt: Words;
  answers: Record<LanguageCode, string[]>;
  /** Position of the answer that keeps the v1 tier (home); undefined if none does. */
  home?: number;
  /** Position of the answer that is Emergency; undefined if none is. */
  redFlag?: number;
}

const FOLLOW_UPS: FollowUp[] = [
  {
    key: "fever_days",
    symptomCode: "fever_mild",
    prompt: { en: "How many days have you had the fever?", tl: "Ilang araw ka nang may lagnat?", ceb: "Pila na ka adlaw nga naa kay hilanat?" },
    answers: {
      en: ["1 to 2 days", "3 days or more"],
      tl: ["1 hanggang 2 araw", "3 araw o higit pa"],
      ceb: ["1 hangtod 2 ka adlaw", "3 ka adlaw o labaw pa"],
    },
    home: 0,
  },
  {
    key: "cough_weeks",
    symptomCode: "cold_cough_no_sob",
    prompt: { en: "How long have you had the cough?", tl: "Gaano katagal ka nang inuubo?", ceb: "Unsa na kadugay ang imong ubo?" },
    answers: {
      en: ["Less than 2 weeks", "2 weeks or more"],
      tl: ["Wala pang 2 linggo", "2 linggo o higit pa"],
      ceb: ["Wala pay 2 ka semana", "2 ka semana o labaw pa"],
    },
    home: 0,
  },
  {
    key: "diarrhea_dehydration",
    symptomCode: "diarrhea_mild_no_dehydration",
    prompt: {
      en: "Do you have any of these: very thirsty, dry mouth, little urine or dark urine, or dizzy when you stand up?",
      tl: "Mayroon ka ba ng alinman dito: sobrang uhaw, tuyong bibig, kaunti o madilim ang kulay ng ihi, o nahihilo kapag tumatayo?",
      ceb: "Naa ba kay bisan usa niini: grabe nga kauhaw, uga nga baba, gamay o itom-itom nga ihi, o malipong kung motindog?",
    },
    answers: {
      en: ["None of these", "Yes, one or more", "Very weak, confused, or cannot drink"],
      tl: ["Wala sa mga ito", "Oo, isa o higit pa", "Sobrang hina, nalilito, o hindi makainom"],
      ceb: ["Wala niini", "Oo, usa o labaw pa", "Grabe ka luya, naglibog, o dili makainom"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "wound_size",
    symptomCode: "minor_wound_no_infection",
    prompt: { en: "How big is the wound?", tl: "Gaano kalaki ang sugat?", ceb: "Unsa kadako ang samad?" },
    answers: {
      en: ["Small scrape or shallow cut", "Big or deep cut", "Bleeding that will not stop"],
      tl: ["Maliit na gasgas o mababaw na hiwa", "Malaki o malalim na hiwa", "Pagdurugong hindi tumitigil"],
      ceb: ["Gamay nga garas o mabaw nga samad", "Dako o lawom nga samad", "Pagdugo nga dili moundang"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "wound_infection",
    symptomCode: "minor_wound_no_infection",
    prompt: {
      en: "Is the wound red, swollen, warm, or more painful each day?",
      tl: "Namumula, namamaga, mainit, o lalong sumasakit ba ang sugat araw-araw?",
      ceb: "Pula, hubag, init, o nagkagrabe ba ang sakit sa samad matag adlaw?",
    },
    answers: YES_NO,
    home: 0,
  },
  {
    key: "headache_danger_signs",
    symptomCode: "headache_mild_moderate",
    prompt: {
      en: "With the headache, do you have any of these: sudden, very bad headache (the worst ever), weakness or numbness on one side, trouble speaking or seeing, fainting or confusion, or a stiff neck with fever?",
      tl: "Kasabay ng sakit ng ulo, mayroon ka ba ng alinman dito: biglaan at napakatinding sakit ng ulo (pinakamatindi kailanman), panghihina o pamamanhid ng isang bahagi ng katawan, hirap magsalita o makakita, pagkahimatay o pagkalito, o paninigas ng leeg na may lagnat?",
      ceb: "Uban sa sakit sa ulo, naa ba kay bisan usa niini: kalit ug grabe kaayo nga sakit sa ulo (pinakagrabe sukad), kahuyang o pagkamanhid sa usa ka bahin sa lawas, lisod mosulti o makakita, paghimatay o kalibog, o gahi nga liog nga naay hilanat?",
    },
    answers: {
      en: ["No, none of these", "None of these, but it has lasted 3 days or more", "Yes, one or more"],
      tl: ["Wala, wala sa mga ito", "Wala sa mga ito, pero 3 araw o higit pa na", "Oo, isa o higit pa"],
      ceb: ["Wala, wala niini", "Wala niini, pero 3 ka adlaw o labaw na", "Oo, usa o labaw pa"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    // v1 already sends this presentation to rhu, so no answer is home and no new
    // rule is needed: only the red flag changes anything.
    key: "spotting_pads",
    symptomCode: "spotting_first_trimester_mild",
    prompt: { en: "How many pads are you soaking with blood?", tl: "Ilang pad na ang nababasa mo ng dugo?", ceb: "Pila na ka pad ang nabasa sa dugo?" },
    answers: {
      en: ["Only spots, less than 1 pad a day", "1 pad or more a day, but less than 1 an hour", "1 pad or more every hour"],
      tl: ["Patak-patak lang, wala pang 1 pad sa isang araw", "1 pad o higit pa sa isang araw, pero wala pang 1 kada oras", "1 pad o higit pa kada oras"],
      ceb: ["Tulo-tulo ra, wala pay 1 ka pad sa usa ka adlaw", "1 ka pad o labaw pa sa usa ka adlaw, pero wala pay 1 matag oras", "1 ka pad o labaw pa matag oras"],
    },
    redFlag: 2,
  },
];

export const followUpQuestions: ClarificationQuestion[] = FOLLOW_UPS.flatMap((q) =>
  (["en", "tl", "ceb"] as const).map((language) => ({
    questionKey: q.key,
    symptomCode: q.symptomCode,
    language,
    prompt: q.prompt[language],
    answerType: "single_select" as const,
    allowedAnswers: q.answers[language],
    ...(q.redFlag === undefined ? {} : { redFlagAnswer: q.answers[language][q.redFlag]! }),
  }))
);

const HOME_ANSWERED = FOLLOW_UPS.filter((q): q is FollowUp & { home: number } => q.home !== undefined);

/** Not an override: each only feeds its rule's "!=" condition (ADR-0001 step 3). */
export const followUpThresholds: SeverityThreshold[] = HOME_ANSWERED.map((q) => ({
  key: `${q.key}_home`,
  label: `The ${q.key} answer that keeps the result at home`,
  value: q.answers.en[q.home]!,
  tier: "rhu",
  isOverride: false,
}));

// R-051 onwards, after the 50 presentation rules.
export const followUpRules: TriageRule[] = HOME_ANSWERED.map((q, index) => {
  const n = v1Rules.length + batch2Rules.length + index + 1;
  const value = q.answers.en[q.home]!;
  return {
    code: `R-${String(n).padStart(3, "0")}`,
    name: `${v1SymptomCodes.find((c) => c.code === q.symptomCode)!.displayName}: follow-up answer other than "${value}"`,
    expression: `IF ${q.symptomCode} AND ${q.key} != "${value}" THEN rhu`,
    conditions: [
      { symptomCode: q.symptomCode, operator: "AND" },
      { attribute: q.key, comparator: "!=", severityThresholdKey: `${q.key}_home`, operator: "AND" },
    ],
    outcomeTier: "rhu",
    priority: n,
    isActive: true,
  };
});

const ASKS_FOLLOW_UP = new Set(FOLLOW_UPS.map((q) => q.symptomCode));

/**
 * RHU tip for an animal bite (R-013 stays rhu: the form says to consult
 * immediately whatever the signs, so no question is asked). Drafted by Claude,
 * approved by the appraiser with the follow-up questions (BUILD-LOG 9ao).
 */
const ANIMAL_BITE_TIP: { title: Words; body: Words } = {
  title: { en: "Get the bite checked today", tl: "Ipasuri ang kagat ngayong araw", ceb: "Ipatan-aw ang paak karong adlawa" },
  body: {
    en: "Wash the bite with soap and running water for 15 minutes. Go to the RHU or an animal bite center today for anti-rabies care. Do not wait for danger signs.",
    tl: "Hugasan ang kagat ng sabon at umaagos na tubig nang 15 minuto. Pumunta sa RHU o sa animal bite center ngayong araw para sa bakuna laban sa rabies. Huwag nang hintayin ang mga senyales ng panganib.",
    ceb: "Hugasi ang paak og sabon ug nagdagayday nga tubig sulod sa 15 minutos. Adto sa RHU o sa animal bite center karong adlawa para sa bakuna batok sa rabies. Ayaw na hulata ang mga timailhan sa peligro.",
  },
};

export const followUpHealthTips: HealthTip[] = (["en", "tl", "ceb"] as const).map((language) => ({
  symptomCode: "animal_bite_stable",
  outcomeTier: "rhu" as const,
  language,
  title: ANIMAL_BITE_TIP.title[language],
  body: ANIMAL_BITE_TIP.body[language],
  displayOrder: 1,
}));

// The v1 codes keep their names; only the six with a follow-up now ask first.
export const v2SymptomCodes: SymptomCode[] = [
  ...v1SymptomCodes.map((c) => (ASKS_FOLLOW_UP.has(c.code) ? { ...c, needsClarification: true } : c)),
  ...batch2SymptomCodes,
];

export const v2Rules: TriageRule[] = [...v1Rules, ...batch2Rules, ...followUpRules];

export const v2Bundle: RulesetBundle = {
  ...v1Bundle,
  versionLabel: "v2-draft",
  symptomCodes: v2SymptomCodes,
  severityThresholds: [...v1Bundle.severityThresholds, ...followUpThresholds],
  rules: v2Rules,
  clarificationQuestions: [...v1Bundle.clarificationQuestions, ...batch2Questions, ...followUpQuestions],
  healthTips: [...v1Bundle.healthTips, ...batch2HealthTips, ...followUpHealthTips],
};
