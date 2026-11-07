import type { RulesetBundle, SymptomCode, Tier, TriageRule } from "../schema.js";
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
 * Deliberately not encoded yet:
 * - The appraiser answered "follow-up needed" for every complaint and wrote
 *   escalation conditions beside some (pain over 24 hours with no relief,
 *   abdominal distention, tinnitus or hearing loss, rule out cardiac). Each
 *   needs a clarification question with fixed answers, which Philipo will
 *   type up; until then every complaint here resolves to its tier directly.
 * - No lexicon terms: Batch 2 returned no resident words. The new codes are
 *   reachable as chips (English display name) until terms are entered, and
 *   unrecognised free text already falls to the rhu fail-safe.
 * - No health tips: the form gives none, and they are medical content.
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

export const batch2SymptomCodes: SymptomCode[] = BATCH2_PRESENTATIONS.map((p) => ({
  code: p.code,
  displayName: p.displayName,
  needsClarification: false,
}));

// Numbering and priority continue from v1's, so R-001..R-023 mean the same
// rule in both versions.
export const batch2Rules: TriageRule[] = BATCH2_PRESENTATIONS.map((p, index) => {
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

export const v2SymptomCodes: SymptomCode[] = [...v1SymptomCodes, ...batch2SymptomCodes];

export const v2Rules: TriageRule[] = [...v1Rules, ...batch2Rules];

export const v2Bundle: RulesetBundle = {
  ...v1Bundle,
  versionLabel: "v2-draft",
  symptomCodes: v2SymptomCodes,
  rules: v2Rules,
};
