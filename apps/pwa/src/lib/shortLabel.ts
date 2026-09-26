/**
 * Hand-picked short chip labels for the symptom codes most likely to appear
 * in a v1 demo session (matches the manuscript's result-screen mockups,
 * e.g. "Fever" / "Cough" rather than the full clinical displayName). Falls
 * back to the first clause of the symptom's displayName for anything not
 * listed here.
 */
const SHORT_LABELS: Record<string, string> = {
  fever_mild: "Fever",
  cold_cough_no_sob: "Cough",
  spotting_first_trimester_mild: "Spotting",
vaginal_bleeding_heavy_pregnancy: "Heavy bleeding",
fever_high_stiff_neck_altered_consciousness: "Stiff neck",
  headache_mild_moderate: "Headache",
  minor_wound_no_infection: "Minor wound",
  diarrhea_mild_no_dehydration: "Diarrhea",
  muscle_pain_post_exertion: "Body pain",
  fever_persistent: "Fever",
  cough_persistent: "Cough",
  diarrhea_mild_dehydration: "Diarrhea",
  elevated_bp_mild_stable: "Elevated BP",
  wound_early_infection: "Wound",
  animal_bite_stable: "Animal bite",
  excessive_thirst_urination: "Excessive thirst",
  difficulty_breathing: "Difficulty breathing",
  chest_pain_severe_radiating: "Chest pain",
  stroke_signs: "Stroke signs",
  abdominal_pain_severe_rigidity: "Abdominal pain",
  seizure_loss_of_consciousness: "Seizure",
  allergic_reaction_severe: "Allergic reaction",
  bleeding_severe_uncontrolled: "Severe bleeding",
};

export function shortLabel(symptomCode: string, fallbackDisplayName: string): string {
  return SHORT_LABELS[symptomCode] ?? fallbackDisplayName.split(",")[0] ?? fallbackDisplayName;
}
