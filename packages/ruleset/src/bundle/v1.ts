import type { RulesetBundle, SymptomCode, Tier, TriageRule } from "../schema.js";

/**
 * v1 draft ruleset: a literal, 1-symptom-to-1-rule encoding of the 23 example
 * presentations in Part C of the Clinical Plausibility and Content Validity
 * Appraisal Form (6 home / 8 rhu / 9 emergency). Each presentation is kept as
 * its own atomic symptom code rather than merged with others under shared
 * attributes (e.g. duration) — that kind of clinical grouping is exactly what
 * Part C asks a reviewer to judge, so it is not inferred here. This bundle has
 * not yet been through clinician sign-off via that form; treat it as a v1
 * draft, not a validated ruleset.
 *
 * Scope note: clarificationQuestions and severityThresholds are intentionally
 * empty in v1. None of the 23 presentations are phrased as a follow-up-question
 * flow (e.g. Figure 23's "how severe is your chest pain?"), so building that
 * content now would mean inventing clinical logic beyond what the appraisal
 * form actually specifies.
 */

interface Presentation {
  code: string;
  displayName: string;
  tier: Tier;
}

const PRESENTATIONS: Presentation[] = [
  // Home
  { code: "fever_mild", displayName: "Fever, mild, <3 days, no red flags", tier: "home" },
  { code: "cold_cough_no_sob", displayName: "Common cold / cough, no shortness of breath", tier: "home" },
  { code: "headache_mild_moderate", displayName: "Mild-to-moderate headache, no neurological red flags", tier: "home" },
  { code: "minor_wound_no_infection", displayName: "Minor cuts or abrasions, no signs of infection", tier: "home" },
  { code: "diarrhea_mild_no_dehydration", displayName: "Mild diarrhea, <2 days, no dehydration signs", tier: "home" },
  { code: "muscle_pain_post_exertion", displayName: "Body / muscle pain after physical exertion, no trauma", tier: "home" },

  // RHU
  { code: "fever_persistent", displayName: "Fever persisting more than 3 days", tier: "rhu" },
  { code: "cough_persistent", displayName: "Persistent cough lasting more than 2 weeks", tier: "rhu" },
  { code: "diarrhea_mild_dehydration", displayName: "Diarrhea with mild dehydration signs", tier: "rhu" },
  { code: "elevated_bp_mild_stable", displayName: "Elevated blood pressure reading with mild symptoms, patient stable", tier: "rhu" },
  { code: "wound_early_infection", displayName: "Wound with early signs of infection (redness, swelling, warmth)", tier: "rhu" },
  { code: "spotting_first_trimester_mild", displayName: "Mild first-trimester spotting, no severe pain", tier: "rhu" },
  { code: "animal_bite_stable", displayName: "Animal bite, skin broken, patient stable, no rabies red flags", tier: "rhu" },
  { code: "excessive_thirst_urination", displayName: "Excessive thirst / urination, no altered consciousness", tier: "rhu" },

  // Emergency
  { code: "difficulty_breathing", displayName: "Difficulty breathing / chest tightness", tier: "emergency" },
  { code: "chest_pain_severe_radiating", displayName: "Severe chest pain radiating to arm or jaw", tier: "emergency" },
  { code: "stroke_signs", displayName: "Sudden facial drooping, slurred speech, or one-sided weakness", tier: "emergency" },
  { code: "abdominal_pain_severe_rigidity", displayName: "Severe abdominal pain with rigidity or guarding", tier: "emergency" },
  { code: "vaginal_bleeding_heavy_pregnancy", displayName: "Heavy vaginal bleeding during pregnancy", tier: "emergency" },
  { code: "seizure_loss_of_consciousness", displayName: "Seizure activity or loss of consciousness", tier: "emergency" },
  { code: "allergic_reaction_severe", displayName: "Severe allergic reaction with facial or throat swelling", tier: "emergency" },
  { code: "bleeding_severe_uncontrolled", displayName: "Severe, uncontrolled bleeding from injury", tier: "emergency" },
  { code: "fever_high_stiff_neck_altered_consciousness", displayName: "High fever with stiff neck and altered consciousness", tier: "emergency" },
];

export const v1SymptomCodes: SymptomCode[] = PRESENTATIONS.map((p) => ({
  code: p.code,
  displayName: p.displayName,
  needsClarification: false,
}));

export const v1Rules: TriageRule[] = PRESENTATIONS.map((p, index) => ({
  code: `R-${String(index + 1).padStart(3, "0")}`,
  name: p.displayName,
  expression: `IF ${p.code} THEN ${p.tier}`,
  conditions: [{ symptomCode: p.code, operator: "AND" }],
  outcomeTier: p.tier,
  priority: index + 1,
  isActive: true,
}));

export const v1Bundle: RulesetBundle = {
  versionLabel: "v1-draft",
  symptomCodes: v1SymptomCodes,
  lexiconTerms: [],
  severityThresholds: [],
  clarificationQuestions: [],
  rules: v1Rules,
  // Empty for the same reason as clarificationQuestions and severityThresholds:
  // the appraisal form specifies 23 presentations and their tiers, not the
  // plain-language advice that accompanies them. Health tips are medical
  // content and must come from the clinical source, not be invented here.
  healthTips: [],
};
