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
 * Added from the nurse's phrase review (2026-11-17): thirteen danger-sign
 * follow-ups on presentations that asked nothing before. See NURSE_FOLLOW_UPS.
 *
 * Deliberately not encoded yet:
 * - The appraiser answered "follow-up needed" for every Part D complaint and
 *   wrote escalation conditions beside some (pain over 24 hours with no relief,
 *   abdominal distention, tinnitus or hearing loss, rule out cardiac). Each
 *   needs a clarification question with fixed answers, which Philipo will
 *   type up; until then every other complaint here resolves to its tier directly.
 *   (Twelve of them, and v1's muscle pain, now ask the nurse review's danger-sign
 *   questions instead; see NURSE_FOLLOW_UPS. That review did not use the
 *   appraiser's escalation notes, which are still to be typed up.)
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

/**
 * Danger-sign follow-ups from the nurse's phrase review (2026-11-17,
 * `My_Care_Cebuano_Phrase_Review_for_Nurse_2026-11-17.docx`, Part B2). Claude
 * drafted them from common primary-care danger signs; a nurse (not named here)
 * went through the sheet with Philipo and approved all thirteen, English and
 * Cebuano, as written, for the pilot. MEDICAL CONTENT:
 * a draft for clinical review, not a validated ruleset.
 *
 * Two changes after approval, both waiting for the nurse's confirmation:
 * - The Tagalog is Claude's translation of the approved English (the sheet
 *   left it for later). Unreviewed.
 * - Five questions (toothache, eye, back pain, constipation, muscle pain) had
 *   Emergency answers longer than 50 characters. The red-flag answer is
 *   VARCHAR(50) in every language (CLARIFICATION_QUESTION.red_flag_answer),
 *   and the English answer the phone submits is held to 50 too. Rather than
 *   abbreviate the Cebuano, they now follow the approved headache pattern:
 *   the Emergency signs move word for word into the question, the Emergency
 *   answer is "Yes, one or more" / "Oo, usa o labaw pa", and the rhu answer
 *   is "No, but ..." / "Wala niini, pero ..." plus the approved wording.
 *   Each answer still gives the result the nurse approved.
 *
 * The seven Home presentations get a rhu rule each (R-057 to R-063), the same
 * "!=" shape as Part C. The six rhu presentations only gain a red flag: "No"
 * keeps them at rhu, so no rule is needed. On swollen legs, the nurse approved
 * the wording as drafted, so one swollen, red, painful leg stays rhu.
 */
const YES_ONE_OR_MORE: Record<LanguageCode, string[]> = {
  en: ["No, none of these", "Yes, one or more"],
  tl: ["Wala, wala sa mga ito", "Oo, isa o higit pa"],
  ceb: ["Wala, wala niini", "Oo, usa o labaw pa"],
};

const NURSE_FOLLOW_UPS: FollowUp[] = [
  {
    key: "sore_throat_danger_signs",
    symptomCode: "sore_throat",
    prompt: {
      en: "With the sore throat, do you have any of these: cannot swallow even your own saliva, drooling, trouble breathing, or cannot open your mouth fully?",
      tl: "Kasabay ng pananakit ng lalamunan, mayroon ka ba ng alinman dito: hindi makalunok kahit ng sariling laway, tumutulo ang laway, hirap huminga, o hindi maibuka nang buo ang bibig?",
      ceb: "Uban sa sakit sa tutunlan, naa ba kay bisan usa niini: dili makatulon bisan sa imong laway, nagtulo ang laway, lisod moginhawa, o dili maabli og maayo ang baba?",
    },
    answers: {
      en: ["No, none of these", "None of these, but it has lasted 7 days or more", "Yes, one or more"],
      tl: ["Wala, wala sa mga ito", "Wala sa mga ito, pero 7 araw o higit pa na", "Oo, isa o higit pa"],
      ceb: ["Wala, wala niini", "Wala niini, pero 7 ka adlaw o labaw na", "Oo, usa o labaw pa"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "nose_days",
    symptomCode: "runny_blocked_nose",
    prompt: {
      en: "How long have you had the runny or blocked nose?",
      tl: "Gaano katagal ka nang may sipon o barado ang ilong?",
      ceb: "Unsa na kadugay nga nagsip-on o barado ang imong ilong?",
    },
    answers: {
      en: ["Less than 10 days", "10 days or more"],
      tl: ["Wala pang 10 araw", "10 araw o higit pa"],
      ceb: ["Wala pay 10 ka adlaw", "10 ka adlaw o labaw pa"],
    },
    home: 0,
  },
  {
    key: "tooth_swelling",
    symptomCode: "toothache_swollen_gums",
    prompt: {
      en: "With the toothache, do you have any of these: swelling down to the neck or under the jaw, or trouble swallowing or breathing?",
      tl: "Kasabay ng sakit ng ngipin, mayroon ka ba ng alinman dito: umabot na ang pamamaga sa leeg o ilalim ng panga, o hirap lumunok o huminga?",
      ceb: "Uban sa sakit sa ngipon, naa ba kay bisan usa niini: ang hubag miabot na sa liog o ilawom sa apapangig, o lisod motulon o moginhawa?",
    },
    answers: {
      en: ["No, none of these", "No, but swollen cheek or face, or a fever", "Yes, one or more"],
      tl: ["Wala, wala sa mga ito", "Wala sa mga ito, pero namamaga ang pisngi o mukha, o may lagnat", "Oo, isa o higit pa"],
      ceb: ["Wala, wala niini", "Wala niini, pero hubag ang aping o nawong, o naa kay hilanat", "Oo, usa o labaw pa"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "eye_danger_signs",
    symptomCode: "red_itchy_eyes",
    prompt: {
      en: "With the eye problem, do you have any of these: something hit or got into the eye (injury or chemical), or sudden loss of sight?",
      tl: "Sa iyong mata, mayroon ka ba ng alinman dito: natamaan o napasukan ang mata (sugat o kemikal), o biglang hindi makakita?",
      ceb: "Sa imong mata, naa ba kay bisan usa niini: naigo o nasudlan ang mata (samad o kemikal), o kalit nga dili makakita?",
    },
    answers: {
      en: ["No, only red, itchy or watery", "No, but eye pain, blurred vision, or light hurts", "Yes, one or more"],
      tl: [
        "Wala, mapula, makati o nagluluha lang",
        "Wala, pero masakit ang mata, malabo ang paningin, o masakit sa liwanag",
        "Oo, isa o higit pa",
      ],
      ceb: ["Wala, pula, katol o luha-on ra", "Wala, pero sakit ang mata, lubog ang panan-aw, o masakitan sa kahayag", "Oo, usa o labaw pa"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "back_pain_danger_signs",
    symptomCode: "back_pain",
    prompt: {
      en: "With the back pain, do you have any of these: it started after a fall or accident, the legs are weak or numb, or you cannot hold your urine or stool?",
      tl: "Kasabay ng sakit ng likod, mayroon ka ba ng alinman dito: nagsimula matapos mahulog o maaksidente, nanghihina o namamanhid ang binti, o hindi mapigil ang ihi o dumi?",
      ceb: "Uban sa sakit sa likod, naa ba kay bisan usa niini: nagsugod human sa pagkahulog o aksidente, maluya o manhid ang tiil, o dili makapugong sa ihi o tae?",
    },
    answers: {
      en: ["No, none of these", "No, but fever, burning urine, or 2 weeks or more", "Yes, one or more"],
      tl: [
        "Wala, wala sa mga ito",
        "Wala sa mga ito, pero may lagnat, mahapdi ang pag-ihi, o 2 linggo o higit pa na",
        "Oo, isa o higit pa",
      ],
      ceb: ["Wala, wala niini", "Wala niini, pero naay hilanat, mahapdos ang pag-ihi, o 2 ka semana o labaw na", "Oo, usa o labaw pa"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "constipation_danger_signs",
    symptomCode: "constipation",
    prompt: {
      en: "With the constipation, do you have any of these: a swollen, hard belly with vomiting, or you cannot pass gas?",
      tl: "Kasabay ng pagtitibi, mayroon ka ba ng alinman dito: namamaga at matigas ang tiyan at nagsusuka, o hindi mailabas ang hangin (utot)?",
      ceb: "Uban sa pagkatibi, naa ba kay bisan usa niini: hubag ug gahi ang tiyan ug nagsuka, o dili makagawas ang hangin (utot)?",
    },
    answers: {
      en: ["No, none of these", "No, but no stool for 7 days or more", "Yes, one or more"],
      tl: ["Wala, wala sa mga ito", "Wala sa mga ito, pero 7 araw o higit pa nang hindi nakakadumi", "Oo, isa o higit pa"],
      ceb: ["Wala, wala niini", "Wala niini, pero 7 ka adlaw o labaw na nga wala makakalibang", "Oo, usa o labaw pa"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "muscle_pain_danger_signs",
    symptomCode: "muscle_pain_post_exertion",
    prompt: {
      en: "With the body or muscle pain, do you have any of these: brown, cola-coloured urine, or too weak to stand?",
      tl: "Kasabay ng pananakit ng katawan o kalamnan, mayroon ka ba ng alinman dito: kulay-kape na ihi, o sobrang hina at hindi makatayo?",
      ceb: "Uban sa sakit sa lawas o kaunuran, naa ba kay bisan usa niini: kolor-kape nga ihi, o luya kaayo nga dili makatindog?",
    },
    answers: {
      en: ["No, none of these", "No, but very swollen, fever, or 7 days or more", "Yes, one or more"],
      tl: ["Wala, wala sa mga ito", "Wala sa mga ito, pero sobrang maga, may lagnat, o 7 araw o higit pa na", "Oo, isa o higit pa"],
      ceb: ["Wala, wala niini", "Wala niini, pero hubag kaayo, naay hilanat, o 7 ka adlaw o labaw na", "Oo, usa o labaw pa"],
    },
    home: 0,
    redFlag: 2,
  },
  {
    key: "vomiting_danger_signs",
    symptomCode: "nausea_vomiting",
    prompt: {
      en: "With the vomiting, do you have any of these: vomiting blood or something black like coffee grounds, even water comes back up for a whole day, severe stomach pain, or confusion?",
      tl: "Kasabay ng pagsusuka, mayroon ka ba ng alinman dito: nagsusuka ng dugo o ng itim na parang giniling na kape, isinusuka kahit ang tubig nang buong araw, matinding sakit ng tiyan, o pagkalito?",
      ceb: "Uban sa pagsuka, naa ba kay bisan usa niini: nagsuka og dugo o itom nga murag kape, bisan tubig isuka ra sulod sa usa ka adlaw, grabe nga sakit sa tiyan, o naglibog?",
    },
    answers: YES_ONE_OR_MORE,
    redFlag: 1,
  },
  {
    key: "sting_danger_signs",
    symptomCode: "insect_sting",
    prompt: {
      en: "After the sting, do you have any of these: swelling of the face, lips or throat, trouble breathing, many stings at once, or dizziness or fainting?",
      tl: "Matapos makagat o matusok ng insekto, mayroon ka ba ng alinman dito: namamaga ang mukha, labi o lalamunan, hirap huminga, napakaraming kagat, o nahilo o nahimatay?",
      ceb: "Human ka napaak sa insekto, naa ba kay bisan usa niini: nanghubag ang nawong, ngabil o tutunlan, lisod moginhawa, daghan kaayo nga paak, o nalipong o nahimatay?",
    },
    answers: YES_ONE_OR_MORE,
    redFlag: 1,
  },
  {
    key: "rash_danger_signs",
    symptomCode: "skin_rash_itching",
    prompt: {
      en: "With the rash, do you have any of these: fever with red or purple spots that do not fade when pressed, swelling of the face or lips, trouble breathing, or blisters or peeling of the skin, mouth or eyes?",
      tl: "Kasabay ng pantal o pangangati, mayroon ka ba ng alinman dito: lagnat na may pula o lilang batik na hindi nawawala kapag pinindot, namamaga ang mukha o labi, hirap huminga, o nagpapaltos o nagbabakbak ang balat, bibig o mata?",
      ceb: "Uban sa pantal o katol, naa ba kay bisan usa niini: hilanat nga naay pula o ube nga tulbok nga dili mawala inig pislit, nanghubag ang nawong o ngabil, lisod moginhawa, o nagpaltos o nanuklap ang panit, baba o mata?",
    },
    answers: YES_ONE_OR_MORE,
    redFlag: 1,
  },
  {
    key: "palpitations_danger_signs",
    symptomCode: "palpitations",
    prompt: {
      en: "With the fast heartbeat, do you have chest pain or trouble breathing, or have you fainted?",
      tl: "Kasabay ng mabilis na tibok ng puso, may sakit ka ba sa dibdib o hirap huminga, o nahimatay ka ba?",
      ceb: "Uban sa kusog nga pitik sa kasingkasing, naa ba kay sakit sa dughan o lisod moginhawa, o nahimatay ka?",
    },
    answers: { en: ["No", "Yes"], tl: ["Wala", "Oo"], ceb: ["Wala", "Oo"] },
    redFlag: 1,
  },
  {
    key: "leg_swelling_danger_signs",
    symptomCode: "swollen_feet_legs",
    prompt: {
      en: "With the swelling, do you have sudden trouble breathing or chest pain?",
      tl: "Kasabay ng pamamaga ng paa o binti, bigla ka bang nahirapang huminga o sumakit ang dibdib?",
      ceb: "Uban sa hubag sa tiil, naa ba kay kalit nga lisod moginhawa o sakit sa dughan?",
    },
    answers: { en: ["No", "Yes"], tl: ["Hindi", "Oo"], ceb: ["Wala", "Oo"] },
    redFlag: 1,
  },
  {
    key: "numbness_danger_signs",
    symptomCode: "numbness_tingling",
    prompt: {
      en: "Did the numbness start suddenly on one side of the body, or come with a drooping face, unclear speech or weakness?",
      tl: "Bigla bang nagsimula ang pamamanhid sa isang bahagi ng katawan, o may kasamang nakalaylay na mukha, hindi malinaw na pagsasalita, o panghihina?",
      ceb: "Kalit ba nga nagsugod ang pagkamanhid sa usa ka bahin sa lawas, o uban sa kiwi nga nawong, dili klaro nga pagsulti, o kahuyang?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
];

const ALL_FOLLOW_UPS = [...FOLLOW_UPS, ...NURSE_FOLLOW_UPS];

export const followUpQuestions: ClarificationQuestion[] = ALL_FOLLOW_UPS.flatMap((q) =>
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

const HOME_ANSWERED = ALL_FOLLOW_UPS.filter((q): q is FollowUp & { home: number } => q.home !== undefined);
const DISPLAY_NAME = new Map([...v1SymptomCodes, ...batch2SymptomCodes].map((c) => [c.code, c.displayName]));

/** Not an override: each only feeds its rule's "!=" condition (ADR-0001 step 3). */
export const followUpThresholds: SeverityThreshold[] = HOME_ANSWERED.map((q) => ({
  key: `${q.key}_home`,
  label: `The ${q.key} answer that keeps the result at home`,
  value: q.answers.en[q.home]!,
  tier: "rhu",
  isOverride: false,
}));

// R-051 onwards, after the 50 presentation rules: Part C's R-051..R-056, then
// the nurse review's R-057..R-063.
export const followUpRules: TriageRule[] = HOME_ANSWERED.map((q, index) => {
  const n = v1Rules.length + batch2Rules.length + index + 1;
  const value = q.answers.en[q.home]!;
  return {
    code: `R-${String(n).padStart(3, "0")}`,
    name: `${DISPLAY_NAME.get(q.symptomCode)!}: follow-up answer other than "${value}"`,
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

const ASKS_FOLLOW_UP = new Set(ALL_FOLLOW_UPS.map((q) => q.symptomCode));

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

// The codes keep their names; only those with a follow-up now ask first
// (Part C's six v1 codes, then the nurse review's thirteen).
const asking = (c: SymptomCode): SymptomCode => (ASKS_FOLLOW_UP.has(c.code) ? { ...c, needsClarification: true } : c);
export const v2SymptomCodes: SymptomCode[] = [...v1SymptomCodes.map(asking), ...batch2SymptomCodes.map(asking)];

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
