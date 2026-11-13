import type { CopyKey } from "./i18n";
import type { IconName } from "./screens/Icon";
import type { SymptomChoice } from "./triage";

/**
 * Body-area groups for the symptom chips on Figure 22.
 *
 * Layout only. A group never changes a tier, a rule or what syncs: the chips
 * inside it toggle exactly the codes they did before. The grouping lives here,
 * in the patient app, because SYMPTOM_CODE (Table 7) has no category column
 * and adding one would amend the manuscript.
 *
 * ⚠️ Which group a presentation sits in is a judgement call that decides where
 * a patient looks for it. Drafted during implementation; it needs the same
 * clinical review as the ruleset.
 *
 * Rules the screen relies on:
 *  - Groups are ordered by body area, NEVER by urgency, so the layout does not
 *    hint at the answer. Emergency presentations sit inside their normal group.
 *  - Every group is shown open: no presentation is ever behind an extra tap.
 *  - A code missing from this map lands in "Other", so a chip can never vanish
 *    when the ruleset gains a code before this file does.
 *  - A group with no chips is not shown.
 */
export interface ChipGroupDefinition {
  id: string;
  label: CopyKey;
  /** The tile name in the body-area shortcuts. */
  short: CopyKey;
  icon: IconName;
  codes: readonly string[];
}

export const CHIP_GROUPS: readonly ChipGroupDefinition[] = [
  {
    id: "fever",
    short: "shortFever",
    label: "groupFever",
    icon: "thermometer",
    codes: [
      "fever_mild",
      "fever_persistent",
      "fever_high_stiff_neck_altered_consciousness",
      "fever_with_rash_or_bleeding",
      "tiredness_weakness",
      "excessive_thirst_urination",
    ],
  },
  {
    id: "breathing",
    short: "shortBreathing",
    label: "groupBreathing",
    icon: "wind",
    codes: ["cold_cough_no_sob", "cough_persistent", "difficulty_breathing", "sore_throat", "runny_blocked_nose"],
  },
  {
    id: "heart",
    short: "shortHeart",
    label: "groupHeart",
    icon: "heart",
    codes: ["chest_pain_severe_radiating", "palpitations", "elevated_bp_mild_stable", "swollen_feet_legs"],
  },
  {
    id: "stomach",
    short: "shortStomach",
    label: "groupStomach",
    icon: "stomach",
    codes: [
      "abdominal_pain_ordinary",
      "demo_abdominal_pain",
      "abdominal_pain_severe_rigidity",
      "nausea_vomiting",
      "heartburn_acid_reflux",
      "diarrhea_mild_no_dehydration",
      "diarrhea_mild_dehydration",
      "constipation",
      "blood_in_stool",
    ],
  },
  {
    id: "head",
    short: "shortHead",
    label: "groupHead",
    icon: "head",
    codes: ["headache_mild_moderate", "dizziness_fainting", "numbness_tingling", "stroke_signs", "seizure_loss_of_consciousness"],
  },
  {
    id: "senses",
    short: "shortSenses",
    label: "groupSenses",
    icon: "eye",
    codes: ["red_itchy_eyes", "ear_pain_discharge", "toothache_swollen_gums"],
  },
  {
    id: "skin",
    short: "shortSkin",
    label: "groupSkin",
    icon: "bandage",
    codes: [
      "minor_wound_no_infection",
      "wound_early_infection",
      "bleeding_severe_uncontrolled",
      "burns",
      "skin_rash_itching",
      "boil_abscess",
      "allergic_reaction_severe",
      "insect_sting",
      "animal_bite_stable",
      "snake_bite",
    ],
  },
  {
    id: "muscles",
    short: "shortMuscles",
    label: "groupMuscles",
    icon: "bone",
    codes: ["muscle_pain_post_exertion", "back_pain", "joint_pain_swelling", "sprain_joint_injury"],
  },
  {
    id: "women",
    short: "shortWomen",
    label: "groupWomen",
    icon: "female",
    codes: [
      "painful_urination",
      "vaginal_discharge_itching",
      "spotting_first_trimester_mild",
      "vaginal_bleeding_heavy_pregnancy",
    ],
  },
];

export const OTHER_GROUP: Omit<ChipGroupDefinition, "codes"> = { id: "other", label: "groupOther", short: "shortOther", icon: "more" };

export interface ChipGroup {
  id: string;
  label: CopyKey;
  short: CopyKey;
  icon: IconName;
  chips: SymptomChoice[];
}

/**
 * Sorts chips into their groups, in the order above. Within a group, chips
 * follow the order listed in its `codes`; unmapped chips keep the bundle's
 * order inside "Other". Every chip comes out exactly once.
 */
export function groupChips(chips: SymptomChoice[]): ChipGroup[] {
  const groups: ChipGroup[] = [];
  const placed = new Set<string>();

  for (const definition of CHIP_GROUPS) {
    const inGroup = definition.codes
      .map((code) => chips.find((chip) => chip.code === code))
      .filter((chip): chip is SymptomChoice => chip !== undefined && !placed.has(chip.code));
    inGroup.forEach((chip) => placed.add(chip.code));
    if (inGroup.length > 0) {
      groups.push({ id: definition.id, label: definition.label, short: definition.short, icon: definition.icon, chips: inGroup });
    }
  }

  const rest = chips.filter((chip) => !placed.has(chip.code));
  if (rest.length > 0) groups.push({ ...OTHER_GROUP, chips: rest });

  return groups;
}
