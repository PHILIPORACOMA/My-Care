import type {
  ClarificationQuestion,
  Comparator,
  RuleCondition,
  RulesetBundle,
  SeverityThreshold,
  Tier,
  TriageRule,
} from "@mycare/ruleset";

export interface ClarificationAnswerInput {
  /** Doubles as the attribute name in `RuleCondition`/`SeverityThreshold` lookups. */
  questionKey: string;
  answer: string;
}

export interface TriageInput {
  symptomCodes: string[];
  attributes?: Record<string, string | number>;
  clarificationAnswers?: ClarificationAnswerInput[];
}

export type TriageReason =
  | "red_flag_clarification"
  | "severity_override"
  | "rule_match"
  | "fail_safe_default";

export interface TriageResult {
  tier: Tier;
  reason: TriageReason;
  matchedRuleCode?: string;
  matchedThresholdKey?: string;
  matchedQuestionKey?: string;
}

const TIER_RANK: Record<Tier, number> = {
  home: 0,
  rhu: 1,
  emergency: 2,
};

function compare(comparator: Comparator, actual: number, expected: number): boolean {
  switch (comparator) {
    case "=":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return actual > expected;
    case ">=":
      return actual >= expected;
    case "<":
      return actual < expected;
    case "<=":
      return actual <= expected;
  }
}

function conditionHolds(
  condition: RuleCondition,
  symptomCodes: string[],
  attributes: Record<string, string | number>,
  thresholdsByKey: Map<string, SeverityThreshold>
): boolean {
  if (condition.symptomCode !== undefined) {
    return symptomCodes.includes(condition.symptomCode);
  }
  if (
    condition.attribute !== undefined &&
    condition.comparator !== undefined &&
    condition.severityThresholdKey !== undefined
  ) {
    const actual = attributes[condition.attribute];
    const threshold = thresholdsByKey.get(condition.severityThresholdKey);
    if (actual === undefined || threshold === undefined) {
      return false;
    }
    return compare(condition.comparator, Number(actual), Number(threshold.value));
  }
  return false;
}

/**
 * Conditions combine left to right: the first condition's operator is ignored
 * (there is nothing to combine with yet), and each following condition folds
 * into the running result via its own operator. NOT means "this condition
 * must not hold", folded in via AND.
 */
function ruleMatches(
  rule: TriageRule,
  symptomCodes: string[],
  attributes: Record<string, string | number>,
  thresholdsByKey: Map<string, SeverityThreshold>
): boolean {
  let result: boolean | undefined;
  for (const condition of rule.conditions) {
    const holds = conditionHolds(condition, symptomCodes, attributes, thresholdsByKey);
    if (result === undefined) {
      result = condition.operator === "NOT" ? !holds : holds;
      continue;
    }
    switch (condition.operator) {
      case "AND":
        result = result && holds;
        break;
      case "OR":
        result = result || holds;
        break;
      case "NOT":
        result = result && !holds;
        break;
    }
  }
  return result ?? false;
}

/**
 * A clarification answer's `questionKey` doubles as the attribute name a
 * RuleCondition or SeverityThreshold can reference — e.g. a question keyed
 * "fever_duration_days" feeds attributes["fever_duration_days"] directly.
 * This avoids needing a separate attribute column on CLARIFICATION_QUESTION
 * (see docs/adr/0001-triage-resolution.md). Explicit `input.attributes`
 * are applied first so a clarification answer can override a stale value.
 */
function resolveAttributes(input: TriageInput): Record<string, string | number> {
  const attributes: Record<string, string | number> = { ...input.attributes };
  for (const answer of input.clarificationAnswers ?? []) {
    attributes[answer.questionKey] = answer.answer;
  }
  return attributes;
}

function findRedFlagClarification(
  input: TriageInput,
  questions: ClarificationQuestion[]
): ClarificationQuestion | undefined {
  if (!input.clarificationAnswers) {
    return undefined;
  }
  for (const answer of input.clarificationAnswers) {
    const question = questions.find((q) => q.questionKey === answer.questionKey);
    if (question?.redFlagAnswer !== undefined && question.redFlagAnswer === answer.answer) {
      return question;
    }
  }
  return undefined;
}

function findOverrideThreshold(
  attributes: Record<string, string | number>,
  thresholds: SeverityThreshold[]
): SeverityThreshold | undefined {
  return thresholds.find((threshold) => {
    if (!threshold.isOverride) {
      return false;
    }
    const actual = attributes[threshold.key];
    return actual !== undefined && Number(actual) >= Number(threshold.value);
  });
}

/**
 * Deterministic triage resolution (ADR-0001): a red-flag clarification answer,
 * then a red-flag severity threshold, then the highest tier among matching
 * rules (lowest `priority` breaks ties), then `rhu` as the fail-safe default.
 * Synchronous and referentially transparent — no I/O, no clock, no randomness.
 */
export function evaluate(input: TriageInput, bundle: RulesetBundle): TriageResult {
  const redFlagQuestion = findRedFlagClarification(input, bundle.clarificationQuestions);
  if (redFlagQuestion) {
    return {
      tier: "emergency",
      reason: "red_flag_clarification",
      matchedQuestionKey: redFlagQuestion.questionKey,
    };
  }

  const attributes = resolveAttributes(input);

  const overrideThreshold = findOverrideThreshold(attributes, bundle.severityThresholds);
  if (overrideThreshold) {
    return {
      tier: overrideThreshold.tier,
      reason: "severity_override",
      matchedThresholdKey: overrideThreshold.key,
    };
  }

  const thresholdsByKey = new Map(bundle.severityThresholds.map((t) => [t.key, t]));
  const matches = bundle.rules.filter(
    (rule) => rule.isActive && ruleMatches(rule, input.symptomCodes, attributes, thresholdsByKey)
  );

  if (matches.length === 0) {
    return { tier: "rhu", reason: "fail_safe_default" };
  }

  const best = matches.reduce((winner, candidate) => {
    const winnerRank = TIER_RANK[winner.outcomeTier];
    const candidateRank = TIER_RANK[candidate.outcomeTier];
    if (candidateRank > winnerRank) {
      return candidate;
    }
    if (candidateRank === winnerRank && candidate.priority < winner.priority) {
      return candidate;
    }
    return winner;
  });

  return { tier: best.outcomeTier, reason: "rule_match", matchedRuleCode: best.code };
}
