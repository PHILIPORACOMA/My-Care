import type { LanguageCode } from "@mycare/ruleset";

/**
 * Patient-facing copy in English, Tagalog and Cebuano.
 *
 * ⚠️ REVIEW STATUS
 *
 * - **English (`en`) is the team's own wording**, taken from the design canvas
 *   "UI regeneration from storyboards" (Figures 17–29). Treat it as approved
 *   copy.
 * - **Tagalog (`tl`) and Cebuano (`ceb`) are DRAFTS written during
 *   implementation.** No native speaker and no clinician has reviewed them.
 *   They must be checked before the app is used by a patient, because several
 *   strings carry clinical weight: the three result verdicts, the advice under
 *   each, the disclaimer, and the emergency instruction.
 *
 * Nothing here is clinical *content* — no symptom names, no lexicon terms, no
 * health tips. Those live in the published ruleset and are authored by the
 * team (CLAUDE.md: never invent Cebuano or Tagalog symptom vocabulary).
 *
 * The keys below are identical across the three dictionaries; a test enforces
 * that, so a missing translation can never silently fall back mid-screen.
 */

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "tl", label: "Filipino", native: "Filipino (Tagalog)" },
  { code: "ceb", label: "Cebuano", native: "Cebuano (Bisaya)" },
];

const en = {
  // Figure 17
  tagline: "Your health guide, wherever you are.",
  worksOffline: "Works offline",
  offlineReady: "Offline ready",
  getStarted: "Get started",

  // Figures 18–20
  stepOf: "Step {n} of 3",
  chooseLanguage: "Choose your language",
  selectToContinue: "Select a language to continue",
  continue: "Continue",
  ageQuestion: "Are you 18 years old or older?",
  adultsOnly: "My Care is for adults only.",
  yesAdult: "Yes, I'm 18 or older",
  no: "No",
  ageDeclined: "My Care is for adults only. Please ask a health worker for help.",
  selectBarangay: "Select your barangay",
  searchBarangay: "Search barangay",
  confirmBarangay: "Confirm barangay",
  whyAsk: "Why do we ask?",
  whyAskBody:
    "Your barangay is the only location we record. It lets health workers see how many people in your area report the same symptoms. We never ask for your name and never use GPS.",
  back: "Back",

  // Figure 21
  hello: "Hello!",
  howAreYouFeeling: "How are you feeling today?",
  barangayLine: "Brgy. {barangay}, Carcar City",
  checkSymptoms: "Check symptoms",
  describeHowYouFeel: "Describe how you feel and we'll guide you.",
  notADiagnosisShort: "This is not a diagnosis. For guidance only.",
  settings: "Settings",

  // Figure 22
  whatAreYourSymptoms: "What are your symptoms?",
  symptomPlaceholder: "Describe how you feel, in your own words…",
  orSelectCommon: "Or select a common symptom:",
  notADiagnosis: "This is not a diagnosis.",
  noSymptomsYet: "Type how you feel, or tap a symptom above.",
  noChipsYet: "Your health office has not published symptom words yet. You can still type how you feel.",

  // Figure 23
  clarifyIntro: "A few more questions to ensure the right guidance.",
  questionCounter: "Question {n} of {total} · tap your answer",

  // Figure 24
  analyzing: "Analyzing your symptoms…",
  onDeviceAnalysis: "On-device analysis",

  // Figures 25–27
  resultHome: "Can be managed at home.",
  resultRhu: "Go to the nearest Rural Health Unit.",
  resultEmergency: "Seek emergency help immediately.",
  adviceHome: "Based on your symptoms, you can manage this at home. Rest and drink plenty of fluids.",
  adviceRhu: "You need to visit the Rural Health Unit within 24 hours. Show this screen to a health worker.",
  adviceEmergency:
    "Your symptoms may be serious. Go to a hospital immediately or call your barangay emergency hotline.",
  longDisclaimer: "This is not a diagnosis. Consult a doctor for recurring or worrying symptoms.",
  viewHealthTips: "View health tips",
  checkAgain: "Check again",
  callForHelp: "Call for help",
  basedOn: "Based on what you told us",

  // Figure 28
  healthTips: "Health tips",
  showToHealthWorker: "Show this screen to your health worker.",
  noTips: "Your health office has not published tips for this result yet. Follow the guidance above.",

  // Figure 29
  language: "Language",
  dataAndStorage: "Data",
  lastUpdated: "Rules last updated: {when}",
  neverUpdated: "Rules not downloaded yet",
  waitingToSend: "{count} finished checks waiting to send",
  allSent: "Everything has been sent",
  aboutMyCare: "About My Care",
  aboutBody:
    "My Care checks your symptoms on your own phone, without sending what you type anywhere. Only de-identified results are shared with your health office.",
  startOver: "Start over (clear data)",
  startOverConfirm: "This clears your language, barangay and any checks waiting to send. Continue?",
  cancel: "Cancel",

  // Connectivity and errors
  needConnectionTitle: "Connect once to get started",
  needConnectionBody:
    "My Care needs an internet connection the first time, to download the triage rules for your area. After that it works offline.",
  noRulesTitle: "Not ready yet",
  noRulesBody:
    "My Care reached the health office, but no triage rules have been published for your area yet. Your connection is fine — please try again later, or ask your barangay health worker.",
  serverProblemTitle: "Cannot reach the health office",
  serverProblemBody:
    "Your connection is working, but the health office system did not answer. Please try again in a little while.",
  retry: "Try again",
  offlineNotice: "You are offline. Your check still works, and results are sent when you have signal again.",
} as const;

export type CopyKey = keyof typeof en;
type Dictionary = Record<CopyKey, string>;

/** ⚠️ DRAFT — needs native speaker and clinical review before field use. */
const tl: Dictionary = {
  tagline: "Ang iyong gabay sa kalusugan, kahit saan.",
  worksOffline: "Gumagana offline",
  offlineReady: "Handa kahit walang internet",
  getStarted: "Magsimula",

  stepOf: "Hakbang {n} ng 3",
  chooseLanguage: "Piliin ang iyong wika",
  selectToContinue: "Pumili ng wika para magpatuloy",
  continue: "Magpatuloy",
  ageQuestion: "Ikaw ba ay 18 taong gulang o mas matanda?",
  adultsOnly: "Ang My Care ay para sa may edad na 18 pataas.",
  yesAdult: "Oo, 18 o mas matanda ako",
  no: "Hindi",
  ageDeclined: "Ang My Care ay para lamang sa nasa hustong gulang. Magpatulong sa isang health worker.",
  selectBarangay: "Piliin ang iyong barangay",
  searchBarangay: "Maghanap ng barangay",
  confirmBarangay: "Kumpirmahin ang barangay",
  whyAsk: "Bakit namin itinatanong?",
  whyAskBody:
    "Ang barangay mo lang ang aming itinatala. Nakikita ng mga health worker kung ilan sa inyong lugar ang may parehong sintomas. Hindi namin hinihingi ang iyong pangalan at hindi kami gumagamit ng GPS.",
  back: "Bumalik",

  hello: "Kumusta!",
  howAreYouFeeling: "Kumusta ang pakiramdam mo ngayon?",
  barangayLine: "Brgy. {barangay}, Carcar City",
  checkSymptoms: "Suriin ang sintomas",
  describeHowYouFeel: "Ilarawan ang nararamdaman mo at kami ang gagabay sa iyo.",
  notADiagnosisShort: "Hindi ito diagnosis. Para lamang sa gabay.",
  settings: "Mga setting",

  whatAreYourSymptoms: "Ano ang iyong nararamdaman?",
  symptomPlaceholder: "Ilarawan ang nararamdaman mo, sa sarili mong salita…",
  orSelectCommon: "O pumili ng karaniwang sintomas:",
  notADiagnosis: "Hindi ito diagnosis.",
  noSymptomsYet: "I-type ang nararamdaman mo, o pumindot ng sintomas sa itaas.",
  noChipsYet:
    "Wala pang nailathalang mga salita para sa sintomas ang inyong health office. Maaari ka pa ring mag-type ng nararamdaman mo.",

  clarifyIntro: "Ilang tanong pa para masiguro ang tamang gabay.",
  questionCounter: "Tanong {n} ng {total} · pindutin ang iyong sagot",

  analyzing: "Sinusuri ang iyong mga sintomas…",
  onDeviceAnalysis: "Sinusuri sa iyong telepono",

  resultHome: "Maaaring alagaan sa bahay.",
  resultRhu: "Pumunta sa pinakamalapit na Rural Health Unit.",
  resultEmergency: "Humingi agad ng emergency na tulong.",
  adviceHome:
    "Batay sa iyong mga sintomas, maaari mo itong alagaan sa bahay. Magpahinga at uminom ng maraming tubig.",
  adviceRhu:
    "Kailangan mong pumunta sa Rural Health Unit sa loob ng 24 oras. Ipakita ang screen na ito sa health worker.",
  adviceEmergency:
    "Maaaring malubha ang iyong mga sintomas. Pumunta agad sa ospital o tumawag sa emergency hotline ng inyong barangay.",
  longDisclaimer: "Hindi ito diagnosis. Kumonsulta sa doktor kung paulit-ulit o nakababahala ang sintomas.",
  viewHealthTips: "Tingnan ang mga payo sa kalusugan",
  checkAgain: "Suriin muli",
  callForHelp: "Tumawag para sa tulong",
  basedOn: "Batay sa sinabi mo sa amin",

  healthTips: "Mga payo sa kalusugan",
  showToHealthWorker: "Ipakita ang screen na ito sa iyong health worker.",
  noTips:
    "Wala pang nailathalang payo ang inyong health office para sa resultang ito. Sundin ang gabay sa itaas.",

  language: "Wika",
  dataAndStorage: "Datos",
  lastUpdated: "Huling update ng mga panuntunan: {when}",
  neverUpdated: "Hindi pa na-download ang mga panuntunan",
  waitingToSend: "{count} natapos na pagsusuri ang naghihintay maipadala",
  allSent: "Naipadala na ang lahat",
  aboutMyCare: "Tungkol sa My Care",
  aboutBody:
    "Sinusuri ng My Care ang iyong mga sintomas sa loob mismo ng iyong telepono. Hindi ipinapadala kahit saan ang iyong isinulat. Ang de-identified na resulta lamang ang ibinabahagi sa inyong health office.",
  startOver: "Magsimula muli (burahin ang datos)",
  startOverConfirm:
    "Buburahin nito ang iyong wika, barangay, at anumang pagsusuring naghihintay maipadala. Magpatuloy?",
  cancel: "Kanselahin",

  needConnectionTitle: "Kumonekta muna nang isang beses",
  needConnectionBody:
    "Kailangan ng My Care ng internet sa unang pagkakataon, para ma-download ang mga panuntunan sa triage para sa inyong lugar. Pagkatapos nito, gumagana na ito offline.",
  noRulesTitle: "Hindi pa handa",
  noRulesBody:
    "Naabot ng My Care ang health office, pero wala pang nailalathalang panuntunan sa triage para sa inyong lugar. Maayos ang inyong koneksyon — subukan muli mamaya, o magtanong sa inyong barangay health worker.",
  serverProblemTitle: "Hindi maabot ang health office",
  serverProblemBody:
    "Gumagana ang inyong koneksyon, pero hindi sumagot ang sistema ng health office. Pakisubukan muli maya-maya.",
  retry: "Subukan muli",
  offlineNotice:
    "Offline ka ngayon. Gumagana pa rin ang pagsusuri, at ipapadala ang resulta kapag may signal ka na ulit.",
};

/** ⚠️ DRAFT — needs native speaker and clinical review before field use. */
const ceb: Dictionary = {
  tagline: "Ang imong giya sa panglawas, bisan asa ka.",
  worksOffline: "Molihok bisan walay internet",
  offlineReady: "Andam bisan offline",
  getStarted: "Sugdi",

  stepOf: "Lakang {n} sa 3",
  chooseLanguage: "Pilia ang imong pinulongan",
  selectToContinue: "Pagpili ug pinulongan aron magpadayon",
  continue: "Padayon",
  ageQuestion: "Ikaw ba 18 anyos o mas magulang?",
  adultsOnly: "Ang My Care para sa 18 anyos pataas.",
  yesAdult: "Oo, 18 o mas magulang ko",
  no: "Dili",
  ageDeclined: "Ang My Care para ra sa mga hamtong. Palihug pangayo ug tabang sa health worker.",
  selectBarangay: "Pilia ang imong barangay",
  searchBarangay: "Pangitaa ang barangay",
  confirmBarangay: "Kumpirmaha ang barangay",
  whyAsk: "Nganong among gipangutana?",
  whyAskBody:
    "Ang imong barangay ra ang among girekord. Makita sa mga health worker kung pila ka tawo sa inyong lugar ang parehas ug sintomas. Wala mi mangayo sa imong ngalan ug wala mi mogamit ug GPS.",
  back: "Balik",

  hello: "Kumusta!",
  howAreYouFeeling: "Kumusta imong pamati karon?",
  barangayLine: "Brgy. {barangay}, Carcar City",
  checkSymptoms: "Susiha ang sintomas",
  describeHowYouFeel: "Isulti kung unsa imong gibati ug kami ang mogiya nimo.",
  notADiagnosisShort: "Dili kini diagnosis. Giya lamang.",
  settings: "Mga setting",

  whatAreYourSymptoms: "Unsa imong gibati?",
  symptomPlaceholder: "Isulat kung unsa imong gibati, sa imong kaugalingong pulong…",
  orSelectCommon: "O pagpili ug komon nga sintomas:",
  notADiagnosis: "Dili kini diagnosis.",
  noSymptomsYet: "I-type kung unsa imong gibati, o i-tap ang sintomas sa taas.",
  noChipsYet:
    "Wala pa nakapatik ug mga pulong para sa sintomas ang inyong health office. Makasulat gihapon ka sa imong gibati.",

  clarifyIntro: "Pipila pa ka pangutana aron masiguro ang husto nga giya.",
  questionCounter: "Pangutana {n} sa {total} · i-tap ang imong tubag",

  analyzing: "Gisusi ang imong mga sintomas…",
  onDeviceAnalysis: "Gisusi sa imong telepono",

  resultHome: "Mahimong atimanon sa balay.",
  resultRhu: "Adto sa pinakaduol nga Rural Health Unit.",
  resultEmergency: "Pangayo dayon ug emergency nga tabang.",
  adviceHome:
    "Base sa imong mga sintomas, mahimo nimo kini atimanon sa balay. Pagpahulay ug pag-inom ug daghang tubig.",
  adviceRhu:
    "Kinahanglan ka moadto sa Rural Health Unit sulod sa 24 ka oras. Ipakita kini nga screen sa health worker.",
  adviceEmergency:
    "Ang imong mga sintomas mahimong grabe. Adto dayon sa ospital o tawagi ang emergency hotline sa inyong barangay.",
  longDisclaimer: "Dili kini diagnosis. Pagkonsulta sa doktor kung magbalik-balik o makahasol ang sintomas.",
  viewHealthTips: "Tan-awa ang mga tambag sa panglawas",
  checkAgain: "Susiha pag-usab",
  callForHelp: "Tawag para sa tabang",
  basedOn: "Base sa imong gisulti",

  healthTips: "Mga tambag sa panglawas",
  showToHealthWorker: "Ipakita kini nga screen sa imong health worker.",
  noTips:
    "Wala pa nakapatik ug tambag ang inyong health office para niini nga resulta. Sunda ang giya sa taas.",

  language: "Pinulongan",
  dataAndStorage: "Datos",
  lastUpdated: "Katapusang update sa mga lagda: {when}",
  neverUpdated: "Wala pa na-download ang mga lagda",
  waitingToSend: "{count} nahuman nga pagsusi ang naghulat ipadala",
  allSent: "Napadala na ang tanan",
  aboutMyCare: "Mahitungod sa My Care",
  aboutBody:
    "Gisusi sa My Care ang imong mga sintomas sulod mismo sa imong telepono. Ang imong gisulat wala ipadala bisan asa. Ang de-identified nga resulta ra ang gipaambit sa inyong health office.",
  startOver: "Sugdi pag-usab (papasa ang datos)",
  startOverConfirm:
    "Mapapas niini ang imong pinulongan, barangay, ug bisan unsang pagsusi nga naghulat ipadala. Padayon?",
  cancel: "Kanselahon",

  needConnectionTitle: "Kumonekta usa sa makausa",
  needConnectionBody:
    "Nagkinahanglan ang My Care ug internet sa unang higayon, aron ma-download ang mga lagda sa triage para sa inyong lugar. Human niini, molihok na kini bisan offline.",
  noRulesTitle: "Dili pa andam",
  noRulesBody:
    "Naabot sa My Care ang health office, apan wala pay gipatik nga mga lagda sa triage para sa inyong lugar. Maayo ang inyong koneksyon — sulayi pag-usab unya, o pangutana sa inyong barangay health worker.",
  serverProblemTitle: "Dili maabot ang health office",
  serverProblemBody:
    "Naglihok ang inyong koneksyon, apan wala mitubag ang sistema sa health office. Palihug sulayi pag-usab sa makadiyot.",
  retry: "Sulayi pag-usab",
  offlineNotice:
    "Offline ka karon. Molihok gihapon ang pagsusi, ug ipadala ang resulta kung naa na kay signal.",
};

export const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, tl, ceb };

/**
 * Look up a string, filling {placeholders}.
 *
 * A missing key falls back to English rather than showing a key name — but the
 * dictionaries are key-identical by test, so that path should be unreachable.
 */
export function translate(language: LanguageCode, key: CopyKey, values: Record<string, string | number> = {}): string {
  const template = DICTIONARIES[language]?.[key] ?? en[key];

  return Object.entries(values).reduce<string>(
    (text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value)),
    template
  );
}

export type Translator = (key: CopyKey, values?: Record<string, string | number>) => string;

export function translatorFor(language: LanguageCode): Translator {
  return (key, values) => translate(language, key, values);
}
