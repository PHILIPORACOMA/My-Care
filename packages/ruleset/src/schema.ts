/**
 * The ruleset bundle contract shared between the Laravel API (author/publish side)
 * and the on-device triage engine (consume side). Field names mirror the Data
 * Dictionary (manuscript Tables 6-11, 15-16) so a bundle can be losslessly
 * reconstructed from, or persisted back to, those tables.
 */

export type Tier = "home" | "rhu" | "emergency";

export type LanguageCode = "en" | "tl" | "ceb";

/** Table 6: SYMPTOM_CODE */
export interface SymptomCode {
  code: string;
  displayName: string;
  needsClarification: boolean;
}

/** Table 8: LEXICON_TERM */
export interface LexiconTerm {
  symptomCode: string;
  language: LanguageCode;
  term: string;
  isNegation: boolean;
}

/**
 * Table 11: SEVERITY_THRESHOLD. `value` is compared against a matching
 * RuleCondition's `attribute` (e.g. key "fever_duration_days", value "3").
 * `isOverride` marks a threshold that, once satisfied, escalates directly to
 * `tier` ahead of normal rule evaluation (ADR-0001 step 2).
 */
export interface SeverityThreshold {
  key: string;
  label: string;
  value: string;
  tier: Tier;
  isOverride: boolean;
}

export type ConditionOperator = "AND" | "OR" | "NOT";
export type Comparator = "=" | "!=" | ">" | ">=" | "<" | "<=";

/**
 * Table 10: RULE_CONDITION. A condition tests either the presence of a
 * symptom code, or an attribute (e.g. "fever_duration_days") against a named
 * SeverityThreshold's value. `operator` says how this condition combines with
 * the ones before it in the parent rule's `conditions` array (the first
 * condition's operator is ignored — there is nothing to combine yet).
 */
export interface RuleCondition {
  symptomCode?: string;
  attribute?: string;
  comparator?: Comparator;
  severityThresholdKey?: string;
  operator: ConditionOperator;
}

/** Table 9: TRIAGE_RULE */
export interface TriageRule {
  code: string;
  name: string;
  /** Human-readable mirror of `conditions`, for the rule-authoring UI (Figure 39). */
  expression: string;
  conditions: RuleCondition[];
  outcomeTier: Tier;
  /** Conflict order: lower number wins when multiple matched rules share the same tier. */
  priority: number;
  isActive: boolean;
}

/** Table 15: CLARIFICATION_QUESTION */
export interface ClarificationQuestion {
  questionKey: string;
  symptomCode: string;
  language: LanguageCode;
  prompt: string;
  answerType: "single_select";
  allowedAnswers: string[];
  /** If the patient's answer equals this value, it is a red-flag response (ADR-0001 step 1). */
  redFlagAnswer?: string;
}

/**
 * Table 21: HEALTH_TIP. Plain-language guidance shown alongside a result
 * (Figure 28), scoped to a ruleset version so it ships to devices with the
 * bundle. Purely presentational: a health tip never influences a tier, and
 * `evaluate()` does not read this field.
 *
 * `symptomCode` is optional — a tip may be general to a tier (e.g. what to do
 * while travelling to the RHU) rather than tied to one symptom.
 */
export interface HealthTip {
  symptomCode?: string;
  outcomeTier: Tier;
  language: LanguageCode;
  title: string;
  body: string;
  /** Ascending; ties broken by the order the API returns them in. */
  displayOrder: number;
}

/** Table 7: RULESET_VERSION plus the versioned content it governs. */
export interface RulesetBundle {
  versionLabel: string;
  symptomCodes: SymptomCode[];
  lexiconTerms: LexiconTerm[];
  severityThresholds: SeverityThreshold[];
  clarificationQuestions: ClarificationQuestion[];
  rules: TriageRule[];
  healthTips: HealthTip[];
}
