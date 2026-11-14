import type {
  ClarificationQuestion,
  LanguageCode,
  LexiconTerm,
  RulesetBundle,
  SeverityThreshold,
  SymptomCode,
  TriageRule,
} from "@mycare/ruleset";
import { testLexiconTerms } from "@mycare/ruleset/testing";

/**
 * DEMO MODE ONLY (`npm run dev:demo`). NOT CLINICALLY REVIEWED.
 *
 * The published v1 ruleset has no lexicon yet, so free text matches nothing
 * and chips show v1's English display names in every language. For a
 * prototype demo, this fills the gap on the device only:
 *
 *  - typed words come from the invented test lexicon (@mycare/ruleset/testing,
 *    kizaru3214's PR #2 draft, with its known under-triage problems);
 *  - chips and the result screen get draft Tagalog and Cebuano names below;
 *  - DEMO_PHRASES adds more ways of saying each presentation;
 *  - one invented presentation, ordinary abdominal pain, shows a follow-up
 *    question deciding the tier;
 *  - invented follow-up questions on v1's milder presentations (fever, cough,
 *    headache and others), which can only raise the tier.
 * Checks that use any invented content never sync.
 *
 * Nothing here reaches the server's ruleset. App.tsx imports this module only
 * in demo mode, so a normal build does not contain it, and a bundle that
 * already carries reviewed terms is left untouched: real vocabulary wins.
 */

/** Draft translations of v1's display names, for chip labels only. */
const DEMO_LABELS: Record<string, Partial<Record<LanguageCode, string>>> = {
  fever_mild: {
    tl: "Banayad na lagnat, wala pang 3 araw, walang babalang senyales",
    ceb: "Hinay nga hilanat, ubos sa 3 ka adlaw, walay delikado nga senyales",
  },
  cold_cough_no_sob: {
    tl: "Sipon / ubo, hindi hinihingal",
    ceb: "Sip-on / ubo, dili ginahangos",
  },
  headache_mild_moderate: {
    tl: "Banayad hanggang katamtamang sakit ng ulo, walang senyales sa nerbiyos",
    ceb: "Hinay hangtod kasarangan nga sakit sa ulo, walay senyales sa nerbiyos",
  },
  minor_wound_no_infection: {
    tl: "Maliit na hiwa o gasgas, walang senyales ng impeksyon",
    ceb: "Gamay nga samad o gasgas, walay senyales sa impeksyon",
  },
  diarrhea_mild_no_dehydration: {
    tl: "Banayad na pagtatae, wala pang 2 araw, hindi dehydrated",
    ceb: "Hinay nga kalibanga, ubos sa 2 ka adlaw, dili dehydrated",
  },
  muscle_pain_post_exertion: {
    tl: "Pananakit ng katawan / kalamnan pagkatapos magpagod, walang pinsala",
    ceb: "Sakit sa lawas / kaunuran human sa kakapoy, walay samad",
  },
  fever_persistent: {
    tl: "Lagnat na lampas 3 araw na",
    ceb: "Hilanat nga labaw na sa 3 ka adlaw",
  },
  cough_persistent: {
    tl: "Ubo na lampas 2 linggo na",
    ceb: "Ubo nga labaw na sa 2 ka semana",
  },
  diarrhea_mild_dehydration: {
    tl: "Pagtatae na may kaunting senyales ng dehydration",
    ceb: "Kalibanga nga adunay gamay nga senyales sa dehydration",
  },
  elevated_bp_mild_stable: {
    tl: "Mataas na presyon na may banayad na sintomas, stable ang pasyente",
    ceb: "Taas nga presyon nga adunay hinay nga sintomas, stable ang pasyente",
  },
  wound_early_infection: {
    tl: "Sugat na may maagang senyales ng impeksyon (pamumula, pamamaga, init)",
    ceb: "Samad nga adunay sayo nga senyales sa impeksyon (pula, hubag, init)",
  },
  spotting_first_trimester_mild: {
    tl: "Kaunting spotting sa unang tatlong buwan ng pagbubuntis, walang matinding sakit",
    ceb: "Gamay nga spotting sa unang tulo ka bulan sa pagmabdos, walay grabe nga sakit",
  },
  animal_bite_stable: {
    tl: "Kagat ng hayop na sumugat sa balat, stable, walang senyales ng rabies",
    ceb: "Paak sa hayop nga nisamad sa panit, stable, walay senyales sa rabies",
  },
  excessive_thirst_urination: {
    tl: "Labis na pagkauhaw / pag-ihi, malinaw ang isip",
    ceb: "Sobra nga kauhaw / pag-ihi, klaro ang panghunahuna",
  },
  difficulty_breathing: {
    tl: "Hirap sa paghinga / paninikip ng dibdib",
    ceb: "Lisod pagginhawa / hugot sa dughan",
  },
  chest_pain_severe_radiating: {
    tl: "Matinding sakit ng dibdib na umaabot sa braso o panga",
    ceb: "Grabe nga sakit sa dughan nga moabot sa bukton o apapangig",
  },
  stroke_signs: {
    tl: "Biglang pagngiwi ng mukha, utal na pananalita, o panghihina ng isang bahagi ng katawan",
    ceb: "Kalit nga pagkiwi sa nawong, dili klaro nga pagsulti, o kahuyang sa usa ka kilid sa lawas",
  },
  abdominal_pain_severe_rigidity: {
    tl: "Matinding sakit ng tiyan na matigas o masakit hawakan",
    ceb: "Grabe nga sakit sa tiyan nga gahi o sakit hikapon",
  },
  vaginal_bleeding_heavy_pregnancy: {
    tl: "Malakas na pagdurugo sa ari habang buntis",
    ceb: "Grabe nga pagdugo sa kinatawo samtang mabdos",
  },
  seizure_loss_of_consciousness: {
    tl: "Kombulsyon o pagkawala ng malay",
    ceb: "Kombulsyon o pagkawala sa panimuot",
  },
  allergic_reaction_severe: {
    tl: "Matinding allergy na may pamamaga ng mukha o lalamunan",
    ceb: "Grabe nga allergy nga adunay hubag sa nawong o tutunlan",
  },
  bleeding_severe_uncontrolled: {
    tl: "Malakas at hindi mapigilang pagdurugo mula sa sugat",
    ceb: "Grabe ug dili mapugngan nga pagdugo gikan sa samad",
  },
  fever_high_stiff_neck_altered_consciousness: {
    tl: "Mataas na lagnat na may paninigas ng leeg at pagbabago ng malay",
    ceb: "Taas nga hilanat nga adunay gahi nga liog ug kausaban sa panimuot",
  },
};

/**
 * More ways to say each presentation, so a demo can type whole sentences.
 * Claude's draft at Philipo's request (2026-10-25), on top of the test
 * lexicon. INVENTED, NOT CLINICALLY REVIEWED, NEVER A SOURCE FOR THE REVIEWED
 * TERMS.
 *
 * Each phrase states its code's presentation, severity included, so no
 * phrase moves a patient to a lower tier than its words describe:
 *
 *  - A plain "sakit sa tiyan" / "stomach pain" is deliberately absent. v1's
 *    only abdominal code is the emergency one; ordinary stomach pain has no
 *    code to go to.
 *  - Duration phrases ("tulo ka adlaw nga hilanat") outrank the bare word,
 *    because the matcher tries longer terms first.
 *  - No negation phrases ("wala koy hilanat"). The matcher can read a near
 *    twin such as "naay hilanat" as the negation (see BUILD-LOG 9k); more
 *    negations would give that bug more to misread.
 */
const DEMO_PHRASES: Record<string, Partial<Record<LanguageCode, string[]>>> = {
  // Home
  fever_mild: {
    en: ["feverish", "i have a fever", "mild fever", "slight fever", "low grade fever", "feeling hot"],
    tl: ["nilalagnat", "may lagnat ako", "sinat", "may sinat", "mainit ang katawan", "medyo nilalagnat"],
    ceb: ["gihilantan", "hilanaton", "init akong lawas", "init ang lawas", "gamay nga hilanat", "naa koy hilanat"],
  },
  cold_cough_no_sob: {
    en: ["runny nose", "stuffy nose", "sore throat", "coughing", "colds", "sneezing"],
    tl: ["inuubo", "sinisipon", "barado ang ilong", "tumutulo ang sipon", "masakit ang lalamunan"],
    ceb: ["giubo", "gisip-on", "ubohon", "sip-onon", "barado akong ilong", "sakit akong tutunlan"],
  },
  headache_mild_moderate: {
    en: ["head hurts", "my head hurts", "mild headache", "head ache"],
    tl: ["masakit ang ulo", "sumasakit ang ulo", "kumikirot ang ulo"],
    ceb: ["sakit akong ulo", "nagsakit akong ulo", "labad sa ulo", "labad akong ulo", "gilabdan"],
  },
  minor_wound_no_infection: {
    en: ["small cut", "minor cut", "scratch", "abrasion", "scraped knee"],
    tl: ["maliit na sugat", "nagasgas", "nahiwa", "nasugatan"],
    ceb: ["gamay nga samad", "nasamad", "nasamaran"],
  },
  diarrhea_mild_no_dehydration: {
    en: ["lbm", "loose bowel movement", "watery stool", "watery stools"],
    tl: ["nagtatae", "pagdudumi", "malambot na dumi"],
    ceb: ["gikalibang", "kalibanga", "nagkalibang", "nagkalibanga"],
  },
  muscle_pain_post_exertion: {
    en: ["sore muscles", "muscle ache", "body ache", "aching body", "sore after exercise"],
    tl: ["nangangalay", "masakit ang katawan", "pananakit ng kalamnan"],
    ceb: ["sakit akong lawas", "nagsakit akong lawas", "sakit sa kaunoran"],
  },

  // RHU
  fever_persistent: {
    en: ["fever for 3 days", "fever for three days", "fever for 4 days", "fever for a week", "fever that wont go away", "long fever"],
    tl: ["lagnat ng tatlong araw", "ilang araw nang lagnat", "tatlong araw nang nilalagnat", "isang linggo nang lagnat", "hindi nawawala ang lagnat", "pabalik balik na lagnat"],
    ceb: ["tulo ka adlaw nga hilanat", "3 ka adlaw nga hilanat", "pila na ka adlaw nga hilanat", "usa ka semana nga hilanat", "dili mawala ang hilanat", "balik balik nga hilanat", "dugay na nga hilanat"],
  },
  cough_persistent: {
    en: ["cough for 2 weeks", "cough for two weeks", "cough for a month", "cough that wont go away", "chronic cough", "long cough"],
    tl: ["dalawang linggo nang ubo", "isang buwan nang ubo", "matagal nang inuubo", "hindi nawawala ang ubo"],
    ceb: ["duha ka semana nga ubo", "usa ka bulan nga ubo", "dugay na nga ubo", "dili mawala ang ubo", "dugay na ko giubo"],
  },
  diarrhea_mild_dehydration: {
    en: ["diarrhea and dry mouth", "diarrhea and dizzy", "diarrhea and weak", "very thirsty with diarrhea"],
    tl: ["nagtatae at nahihilo", "nagtatae at nanghihina", "nagtatae at uhaw na uhaw"],
    ceb: ["kalibanga ug lipong", "gikalibang ug luya", "kalibanga ug uhaw kaayo"],
  },
  elevated_bp_mild_stable: {
    en: ["high bp", "high blood", "hypertension", "blood pressure is high"],
    tl: ["mataas ang presyon", "high blood ako", "altapresyon"],
    ceb: ["taas akong presyon", "taas ang presyon", "high blood ko"],
  },
  wound_early_infection: {
    en: ["wound is red", "red and swollen wound", "wound has pus", "wound is warm", "infected cut"],
    tl: ["namamagang sugat", "namumula ang sugat", "may nana ang sugat", "nagnanana ang sugat"],
    ceb: ["nanghubag ang samad", "namula ang samad", "naay nana ang samad", "nagnana ang samad"],
  },
  spotting_first_trimester_mild: {
    en: ["spotting while pregnant", "pregnant and spotting"],
    tl: ["may spotting habang buntis", "kaunting dugo habang buntis", "buntis at may spotting"],
    ceb: ["naay spotting samtang mabdos", "gamay nga dugo samtang mabdos", "mabdos ug nag spotting"],
  },
  animal_bite_stable: {
    en: ["bitten by a dog", "bitten by a cat", "cat bite", "dog bit me"],
    tl: ["kinagat ng aso", "kinagat ng pusa", "kagat ng aso", "kagat ng pusa"],
    ceb: ["gipaak sa iro", "gipaak sa iring", "paak sa iro", "paak sa iring"],
  },
  excessive_thirst_urination: {
    en: ["always thirsty", "very thirsty", "urinating often", "peeing a lot", "frequent peeing"],
    tl: ["laging nauuhaw", "madalas umihi", "palaging umiihi", "uhaw na uhaw"],
    ceb: ["kanunay giuhaw", "pirmi giuhaw", "kanunay mangihi", "pirmi mangihi"],
  },

  // Emergency
  difficulty_breathing: {
    en: ["cant breathe", "short of breath", "chest tightness", "tight chest", "breathless", "gasping"],
    tl: ["hindi makahinga", "nahihirapang huminga", "hinihingal", "naninikip ang dibdib", "kinakapos sa hininga"],
    ceb: ["dili makaginhawa", "lisod moginhawa", "ginahangos", "naghangos", "hugot ang dughan", "kulang sa ginhawa"],
  },
  chest_pain_severe_radiating: {
    en: ["crushing chest pain", "chest pain spreading to arm", "pain in chest and left arm", "heart attack"],
    tl: ["masakit ang dibdib", "sumasakit ang dibdib", "kumikirot ang dibdib"],
    ceb: ["sakit akong dughan", "nagsakit akong dughan", "sakit sa dughan", "sakit kaayo akong dughan"],
  },
  stroke_signs: {
    en: ["face is drooping", "cant speak properly", "numb on one side", "cannot move one side", "stroke"],
    tl: ["ngiwi ang mukha", "hindi maigalaw ang isang braso", "manhid ang kalahati ng katawan", "utal magsalita"],
    ceb: ["ngiwi ang nawong", "dili malihok ang usa ka bukton", "manhid ang katunga sa lawas", "dili klaro mosulti"],
  },
  abdominal_pain_severe_rigidity: {
    en: ["very bad stomach pain", "terrible stomach pain", "severe abdominal pain", "worst stomach pain", "stomach is hard"],
    tl: ["sobrang sakit ng tiyan", "napakasakit ng tiyan", "matigas ang tiyan", "hindi matiis ang sakit ng tiyan"],
    ceb: ["sakit kaayo akong tiyan", "grabe kaayo nga sakit sa tiyan", "grabe sakit sa tiyan", "gahi ang tiyan", "dili maagwanta ang sakit sa tiyan"],
  },
  vaginal_bleeding_heavy_pregnancy: {
    en: ["bleeding a lot while pregnant", "pregnant and bleeding heavily"],
    tl: ["dinudugo habang buntis", "maraming dugo habang buntis"],
    ceb: ["daghang dugo samtang mabdos", "nagdugo samtang mabdos", "mabdos ug nagdugo"],
  },
  seizure_loss_of_consciousness: {
    en: ["fainted", "passed out", "lost consciousness", "shaking uncontrollably"],
    tl: ["nahimatay", "nawalan ng malay", "kinukumbulsyon", "nangisay"],
    ceb: ["nakuyapan", "nawad-an og panimuot", "nawad-an sa panimuot", "gikombulsyon"],
  },
  allergic_reaction_severe: {
    en: ["swollen lips", "lips swelling", "tongue swelling", "face swelling"],
    tl: ["namamaga ang mukha", "namamaga ang labi", "namamaga ang lalamunan", "matinding allergy"],
    ceb: ["nanghubag ang nawong", "nanghubag ang ngabil", "nanghubag ang tutunlan", "grabe nga allergy"],
  },
  bleeding_severe_uncontrolled: {
    en: ["bleeding a lot", "bleeding heavily", "cant stop the bleeding", "lots of blood"],
    tl: ["hindi tumitigil ang dugo", "malakas ang pagdurugo", "sobrang dugo"],
    ceb: ["dili mohunong ang dugo", "daghan kaayong dugo", "grabe ang pagdugo"],
  },
  fever_high_stiff_neck_altered_consciousness: {
    en: ["high fever and stiff neck", "fever and confused", "high fever and confused"],
    tl: ["mataas na lagnat at matigas ang leeg", "nilalagnat at nalilito", "mataas na lagnat at nalilito"],
    ceb: ["taas nga hilanat ug gahi ang liog", "hilanat ug naglibog", "taas nga hilanat ug naglibog"],
  },
};

/*
 * INVENTED CLINICAL LOGIC, FOR DEMOS ONLY. Claude's draft at Philipo's
 * request (2026-10-25). Not from the Clinical Appraisal Form, not reviewed.
 *
 * v1 has no presentation for ordinary abdominal pain (its only abdominal
 * code is the emergency one), so "stomach pain" had nowhere to go. This shows
 * how the follow-up-question flow (Figure 23, ADR-0001 step 1) closes such a
 * gap: two words are enough, and severity is asked for rather than guessed.
 *
 *  - "Severe, or my belly is hard and painful to touch" is the red-flag
 *    answer: emergency at once.
 *  - Any other answer: RHU, by the rule below. Never home; choosing a home
 *    tier for abdominal pain is a clinician's call, not a demo's.
 *
 * The longer severe phrases (demo and test lexicon) still outrank these and
 * go straight to abdominal_pain_severe_rigidity.
 */
const DEMO_SYMPTOM: SymptomCode = {
  code: "demo_abdominal_pain",
  displayName: "Abdominal pain (demo)",
  needsClarification: true,
};

DEMO_LABELS[DEMO_SYMPTOM.code] = { tl: "Sakit ng tiyan (demo)", ceb: "Sakit sa tiyan (demo)" };

DEMO_PHRASES[DEMO_SYMPTOM.code] = {
  en: ["stomach pain", "stomach ache", "stomachache", "abdominal pain", "belly pain", "tummy ache", "stomach hurts", "my stomach hurts"],
  tl: ["sakit ng tiyan", "masakit ang tiyan", "sumasakit ang tiyan", "masakit ang sikmura", "masakit ang tiyan ko"],
  ceb: ["sakit sa tiyan", "sakit akong tiyan", "nagsakit akong tiyan", "sakit ang tiyan", "nagsakit ang tiyan"],
};

const DEMO_QUESTION_VARIANTS: { language: LanguageCode; prompt: string; allowedAnswers: string[] }[] = [
  // English first: the engine checks answers against the first variant
  // (canonicalAnswer in ./triage), so the others list theirs in the same order.
  {
    language: "en",
    prompt: "How bad is your stomach pain?",
    allowedAnswers: ["Mild, I can do my usual activities", "Strong, but I can still move around", "Severe, or my belly is hard and painful to touch"],
  },
  {
    language: "tl",
    prompt: "Gaano kasakit ang iyong tiyan?",
    allowedAnswers: ["Banayad, nagagawa ko pa ang karaniwang gawain", "Malakas, pero nakakagalaw pa ako", "Matindi, o matigas at masakit hawakan ang tiyan"],
  },
  {
    language: "ceb",
    prompt: "Unsa ka grabe ang sakit sa imong tiyan?",
    allowedAnswers: ["Hinay ra, makabuhat pa ko sa akong naandan", "Kusog, pero makalihok pa ko", "Grabe kaayo, o gahi ug sakit hikapon ang tiyan"],
  },
];

const DEMO_QUESTIONS: ClarificationQuestion[] = DEMO_QUESTION_VARIANTS.map((variant) => ({
  ...variant,
  questionKey: "demo_abdominal_pain_severity",
  symptomCode: DEMO_SYMPTOM.code,
  answerType: "single_select",
  redFlagAnswer: variant.allowedAnswers[2]!,
}));

const DEMO_RULE: TriageRule = {
  code: "R-DEMO-1",
  name: "Abdominal pain (demo), no red-flag answer",
  expression: `IF ${DEMO_SYMPTOM.code} THEN rhu`,
  conditions: [{ symptomCode: DEMO_SYMPTOM.code, operator: "AND" }],
  outcomeTier: "rhu",
  priority: 999,
  isActive: true,
};

/*
 * INVENTED FOLLOW-UP QUESTIONS, FOR DEMOS ONLY. Claude's draft at Philipo's
 * request (2026-10-25). Not from the Clinical Appraisal Form, not reviewed.
 *
 * Where one of v1's plain presentations ("fever", "ubo", "sakit sa ulo")
 * could be milder or worse than its tier assumes, the demo asks. Two kinds:
 *
 *  - "How many days?" The engine compares an answer as a number (ADR-0001's
 *    question_key-as-attribute wiring), so the buttons are numbers and a
 *    demo rule moves the check up to RHU past v1's own cut-off.
 *  - A yes/no red-flag question. "Yes" is emergency at once (ADR-0001 step 1).
 *
 * Every question can only move a check UP from its v1 tier, never down.
 * Emergency presentations ask nothing: they are already the top tier.
 */
interface FollowUp {
  key: string;
  symptomCode: string;
  prompt: Record<LanguageCode, string>;
  answers: Record<LanguageCode, string[]>;
  /** Position of the red-flag answer, for a yes/no red-flag question. */
  redFlag?: number;
}

const YES_NO: Record<LanguageCode, string[]> = { en: ["No", "Yes"], tl: ["Hindi", "Oo"], ceb: ["Dili", "Oo"] };
const DAYS = ["1", "2", "3", "4", "5", "6", "7"];
const WEEKS = ["1", "2", "3", "4"];
const same = (answers: string[]): Record<LanguageCode, string[]> => ({ en: answers, tl: answers, ceb: answers });

const DEMO_FOLLOW_UPS: FollowUp[] = [
  {
    key: "demo_fever_days",
    symptomCode: "fever_mild",
    prompt: {
      en: "How many days have you had the fever? (7 means a week or more)",
      tl: "Ilang araw ka nang nilalagnat? (7 kung isang linggo o higit pa)",
      ceb: "Pila na ka adlaw ang imong hilanat? (7 kung usa ka semana o labaw pa)",
    },
    answers: same(DAYS),
  },
  {
    key: "demo_fever_red_flags",
    symptomCode: "fever_mild",
    prompt: {
      en: "Do you also have a stiff neck, confusion, or are you very hard to wake up?",
      tl: "May paninigas ba ng leeg, pagkalito, o napakahirap mong gisingin?",
      ceb: "Naa ba kay gahi nga liog, naglibog, o lisod kaayo ka pukawon?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
  {
    key: "demo_cough_weeks",
    symptomCode: "cold_cough_no_sob",
    prompt: {
      en: "How many weeks have you been coughing? (4 means a month or more)",
      tl: "Ilang linggo ka nang inuubo? (4 kung isang buwan o higit pa)",
      ceb: "Pila na ka semana ang imong ubo? (4 kung usa ka bulan o labaw pa)",
    },
    answers: same(WEEKS),
  },
  {
    key: "demo_cough_red_flags",
    symptomCode: "cold_cough_no_sob",
    prompt: {
      en: "Are you struggling to breathe, or coughing up a lot of blood?",
      tl: "Nahihirapan ka bang huminga, o umuubo ng maraming dugo?",
      ceb: "Lisod ba ka moginhawa, o nag-ubo og daghang dugo?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
  {
    key: "demo_headache_red_flags",
    symptomCode: "headache_mild_moderate",
    prompt: {
      en: "Is it sudden and the worst headache of your life, or do you also have weakness, slurred speech or a stiff neck?",
      tl: "Bigla ba at ito ang pinakamatinding sakit ng ulo sa buhay mo, o may panghihina, utal na pananalita, o paninigas ng leeg?",
      ceb: "Kalit ba ug mao ang pinakagrabe nga sakit sa ulo sa imong kinabuhi, o naa kay kahuyang, dili klaro nga pagsulti, o gahi nga liog?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
  {
    key: "demo_diarrhea_days",
    symptomCode: "diarrhea_mild_no_dehydration",
    prompt: {
      en: "How many days have you had diarrhea? (7 means a week or more)",
      tl: "Ilang araw ka nang nagtatae? (7 kung isang linggo o higit pa)",
      ceb: "Pila na ka adlaw ang imong kalibanga? (7 kung usa ka semana o labaw pa)",
    },
    answers: same(DAYS),
  },
  {
    key: "demo_diarrhea_red_flags",
    symptomCode: "diarrhea_mild_no_dehydration",
    prompt: {
      en: "Are you confused, fainting, or unable to keep any fluids down?",
      tl: "Nalilito ka ba, nahihimatay, o hindi makainom nang hindi nagsusuka?",
      ceb: "Naglibog ka ba, nakuyapan, o dili makainom nga dili mosuka?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
  {
    key: "demo_wound_red_flags",
    symptomCode: "minor_wound_no_infection",
    prompt: {
      en: "Is it bleeding heavily and not stopping when you press on it?",
      tl: "Malakas ba ang pagdurugo at hindi tumitigil kahit diinan?",
      ceb: "Grabe ba ang pagdugo ug dili mohunong bisan pug-on?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
  {
    key: "demo_bp_red_flags",
    symptomCode: "elevated_bp_mild_stable",
    prompt: {
      en: "Do you also have chest pain, a sudden severe headache, blurred vision, or weakness on one side?",
      tl: "May sakit ba ng dibdib, biglaang matinding sakit ng ulo, malabong paningin, o panghihina ng isang bahagi ng katawan?",
      ceb: "Naa ba kay sakit sa dughan, kalit nga grabe nga sakit sa ulo, lubog nga panan-aw, o kahuyang sa usa ka kilid sa lawas?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
  {
    key: "demo_spotting_red_flags",
    symptomCode: "spotting_first_trimester_mild",
    prompt: {
      en: "Is the bleeding heavy, or do you have severe pain in your belly?",
      tl: "Malakas ba ang pagdurugo, o may matinding sakit sa tiyan?",
      ceb: "Grabe ba ang pagdugo, o naa kay grabe nga sakit sa tiyan?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
  {
    key: "demo_thirst_red_flags",
    symptomCode: "excessive_thirst_urination",
    prompt: {
      en: "Are you confused, very drowsy, or breathing fast?",
      tl: "Nalilito ka ba, sobrang antok, o mabilis ang paghinga?",
      ceb: "Naglibog ka ba, katulgon kaayo, o paspas ang pagginhawa?",
    },
    answers: YES_NO,
    redFlag: 1,
  },
];

// English first in each group: the engine checks an answer against the first
// variant (canonicalAnswer in ./triage).
const DEMO_FOLLOW_UP_QUESTIONS: ClarificationQuestion[] = DEMO_FOLLOW_UPS.flatMap((followUp) =>
  (["en", "tl", "ceb"] as const).map((language) => ({
    questionKey: followUp.key,
    symptomCode: followUp.symptomCode,
    language,
    prompt: followUp.prompt[language],
    answerType: "single_select" as const,
    allowedAnswers: followUp.answers[language],
    ...(followUp.redFlag === undefined ? {} : { redFlagAnswer: followUp.answers[language][followUp.redFlag]! }),
  }))
);

/** "More than N" past v1's own cut-off: fever over 3 days, cough over 2 weeks, diarrhea 2 days or more. */
const DEMO_DURATION_RULES: { key: string; symptomCode: string; atLeast: string; name: string }[] = [
  { key: "demo_fever_days", symptomCode: "fever_mild", atLeast: "3", name: "Fever 3 days or more (demo)" },
  { key: "demo_cough_weeks", symptomCode: "cold_cough_no_sob", atLeast: "3", name: "Cough 3 weeks or more (demo)" },
  { key: "demo_diarrhea_days", symptomCode: "diarrhea_mild_no_dehydration", atLeast: "2", name: "Diarrhea 2 days or more (demo)" },
];

const DEMO_THRESHOLDS: SeverityThreshold[] = DEMO_DURATION_RULES.map((rule) => ({
  key: `${rule.key}_rhu`,
  label: rule.name,
  value: rule.atLeast,
  tier: "rhu",
  isOverride: false,
}));

const DEMO_DURATION_TRIAGE_RULES: TriageRule[] = DEMO_DURATION_RULES.map((rule, index) => ({
  code: `R-DEMO-${index + 2}`,
  name: rule.name,
  expression: `IF ${rule.symptomCode} AND ${rule.key} >= ${rule.atLeast} THEN rhu`,
  conditions: [
    { symptomCode: rule.symptomCode, operator: "AND" },
    { attribute: rule.key, comparator: ">=", severityThresholdKey: `${rule.key}_rhu`, operator: "AND" },
  ],
  outcomeTier: "rhu",
  priority: 1000 + index,
  isActive: true,
}));

const ASKS = new Set(DEMO_FOLLOW_UPS.map((followUp) => followUp.symptomCode));

/** DEMO_PHRASES as lexicon terms, for the demo and its tests. */
export const demoPhraseTerms: LexiconTerm[] = Object.entries(DEMO_PHRASES).flatMap(([symptomCode, byLanguage]) =>
  (Object.entries(byLanguage) as [LanguageCode, string[]][]).flatMap(([language, terms]) =>
    terms.map((term) => ({ symptomCode, language, term, isNegation: false }))
  )
);

/**
 * The bundle with the demo vocabulary added, when it has no lexicon of its own.
 *
 * symptomLabel() shows a code's first term in the patient's language, so each
 * code's label goes in first (the display name itself for English, keeping
 * English chips as they are), followed by the test lexicon's words.
 */
export function withDemoLexicon(bundle: RulesetBundle | undefined): RulesetBundle | undefined {
  if (!bundle || bundle.lexiconTerms.length > 0) return bundle;

  const symptomCodes = [
    ...bundle.symptomCodes.map((code) => (ASKS.has(code.code) ? { ...code, needsClarification: true } : code)),
    DEMO_SYMPTOM,
  ];
  const known = new Set(symptomCodes.map((c) => c.code));
  const labels: LexiconTerm[] = symptomCodes.flatMap((code) => [
    { symptomCode: code.code, language: "en" as const, term: code.displayName, isNegation: false },
    ...(["tl", "ceb"] as const).flatMap((language) => {
      const term = DEMO_LABELS[code.code]?.[language];
      return term ? [{ symptomCode: code.code, language, term, isNegation: false }] : [];
    }),
  ]);

  return {
    ...bundle,
    symptomCodes,
    lexiconTerms: [...labels, ...[...testLexiconTerms, ...demoPhraseTerms].filter((t) => known.has(t.symptomCode))],
    severityThresholds: [...bundle.severityThresholds, ...DEMO_THRESHOLDS],
    clarificationQuestions: [...bundle.clarificationQuestions, ...DEMO_QUESTIONS, ...DEMO_FOLLOW_UP_QUESTIONS],
    rules: [...bundle.rules, DEMO_RULE, ...DEMO_DURATION_TRIAGE_RULES],
  };
}

/**
 * Whether a check used anything invented: the demo presentation or a demo
 * follow-up question. Such a check must stay on the phone: the server rejects
 * a batch naming a symptom code or question it does not know, which would
 * hold every real check queued behind it.
 */
export function isDemoOnly(codes: readonly string[], answeredKeys: readonly string[] = []): boolean {
  return codes.includes(DEMO_SYMPTOM.code) || answeredKeys.some((key) => key.startsWith("demo_"));
}
