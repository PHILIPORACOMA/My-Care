import type { LanguageCode, LexiconTerm, RulesetBundle } from "@mycare/ruleset";
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
 *  - chips and the result screen get draft Tagalog and Cebuano names below.
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
 * The bundle with the demo vocabulary added, when it has no lexicon of its own.
 *
 * symptomLabel() shows a code's first term in the patient's language, so each
 * code's label goes in first (the display name itself for English, keeping
 * English chips as they are), followed by the test lexicon's words.
 */
export function withDemoLexicon(bundle: RulesetBundle | undefined): RulesetBundle | undefined {
  if (!bundle || bundle.lexiconTerms.length > 0) return bundle;

  const known = new Set(bundle.symptomCodes.map((c) => c.code));
  const labels: LexiconTerm[] = bundle.symptomCodes.flatMap((code) => [
    { symptomCode: code.code, language: "en" as const, term: code.displayName, isNegation: false },
    ...(["tl", "ceb"] as const).flatMap((language) => {
      const term = DEMO_LABELS[code.code]?.[language];
      return term ? [{ symptomCode: code.code, language, term, isNegation: false }] : [];
    }),
  ]);

  return {
    ...bundle,
    lexiconTerms: [...labels, ...testLexiconTerms.filter((t) => known.has(t.symptomCode))],
  };
}
