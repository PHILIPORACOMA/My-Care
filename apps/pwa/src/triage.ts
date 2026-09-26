import { matchSymptoms, type SymptomMatch } from "@mycare/lexicon-matcher";
import type { ClarificationQuestion, HealthTip, LanguageCode, RulesetBundle, Tier } from "@mycare/ruleset";
import { evaluate, type TriageResult } from "@mycare/triage-engine";
import type { QueuedSession } from "./storage";

/**
 * One triage, on the device (Figures 22–28).
 *
 * The division of labour is the project's central rule: the lexicon matcher
 * *proposes* symptom codes from what the patient wrote or tapped, and the rule
 * engine *decides* the tier. Nothing here scores, weighs or guesses a tier.
 */

export interface SymptomChoice {
  code: string;
  label: string;
}

/**
 * Chips for the input screen (Figure 22): "pre-built symptom chips drawn
 * directly from the versioned lexicon".
 *
 * A chip's label is the lexicon word in the patient's language when the team
 * has authored one, and the symptom's display name otherwise. Only codes an
 * active rule actually tests are offered — a chip that cannot affect any rule
 * would be a dead end.
 */
export function chipsFor(bundle: RulesetBundle, language: LanguageCode): SymptomChoice[] {
  const used = new Set<string>();
  for (const rule of bundle.rules) {
    if (!rule.isActive) continue;
    for (const condition of rule.conditions) {
      if (condition.symptomCode) used.add(condition.symptomCode);
    }
  }

  return bundle.symptomCodes
    .filter((code) => used.has(code.code))
    .map((code) => ({ code: code.code, label: symptomLabel(bundle, code.code, language) }));
}

/**
 * What a patient sees for a symptom code: the lexicon word in their language
 * when one is authored, the display name otherwise, and the raw code only if
 * the bundle does not know it at all. The chip and the result screen (Figures
 * 22 and 25-27) use this one function so they always agree - a patient who
 * tapped "Severe chest pain" must not be shown `chest_pain_severe_radiating`.
 */
export function symptomLabel(bundle: RulesetBundle, code: string, language: LanguageCode): string {
  const term = bundle.lexiconTerms.find((t) => t.symptomCode === code && t.language === language && !t.isNegation);
  return term?.term ?? bundle.symptomCodes.find((c) => c.code === code)?.displayName ?? code;
}

/**
 * Questions to ask before deciding (Figure 23): only for matched symptoms whose
 * code is flagged `needsClarification`, in the patient's language where a
 * variant exists.
 */
export function questionsFor(bundle: RulesetBundle, codes: string[], language: LanguageCode): ClarificationQuestion[] {
  const needing = new Set(bundle.symptomCodes.filter((c) => c.needsClarification).map((c) => c.code));
  const keys = new Set<string>();
  const questions: ClarificationQuestion[] = [];

  for (const code of codes) {
    if (!needing.has(code)) continue;
    for (const question of bundle.clarificationQuestions) {
      if (question.symptomCode !== code || keys.has(question.questionKey)) continue;
      const preferred =
        bundle.clarificationQuestions.find((q) => q.questionKey === question.questionKey && q.language === language) ??
        question;
      keys.add(question.questionKey);
      questions.push(preferred);
    }
  }

  return questions;
}

/**
 * The answer value to submit for a chosen option.
 *
 * The engine resolves a question by key alone — the first variant in bundle
 * order — so the value sent must be that variant's, at the position the
 * patient chose. Sending the displayed Cebuano label when the engine compares
 * against the English variant's red-flag answer would miss an emergency
 * (ADR-0006 pins the matching rule that makes this safe).
 */
export function canonicalAnswer(bundle: RulesetBundle, questionKey: string, index: number): string {
  const canonical = bundle.clarificationQuestions.find((q) => q.questionKey === questionKey);
  return canonical?.allowedAnswers[index] ?? "";
}

export function isRedFlagAnswer(bundle: RulesetBundle, questionKey: string, answer: string): boolean {
  const canonical = bundle.clarificationQuestions.find((q) => q.questionKey === questionKey);
  return canonical?.redFlagAnswer !== undefined && canonical.redFlagAnswer === answer;
}

export interface TriageInputState {
  /** Codes the patient tapped as chips. */
  picked: string[];
  /** What the lexicon matcher found in their free text. */
  matches: SymptomMatch[];
  /** questionKey → canonical answer. */
  answers: Record<string, string>;
}

/** Everything the engine needs, assembled from what the patient did. */
export function resolveCodes(input: TriageInputState): { present: string[]; negated: string[] } {
  const negated = input.matches.filter((m) => m.negated).map((m) => m.symptomCode);
  const fromText = input.matches.filter((m) => !m.negated).map((m) => m.symptomCode);
  const present = [...new Set([...fromText, ...input.picked])];

  return { present, negated: negated.filter((code) => !present.includes(code)) };
}

export function runTriage(bundle: RulesetBundle, input: TriageInputState): TriageResult {
  const { present } = resolveCodes(input);

  return evaluate(
    {
      symptomCodes: present,
      clarificationAnswers: Object.entries(input.answers).map(([questionKey, answer]) => ({ questionKey, answer })),
    },
    bundle
  );
}

/** Health tips for a result (Figure 28), in the patient's language. */
export function tipsFor(bundle: RulesetBundle, tier: Tier, codes: string[], language: LanguageCode): HealthTip[] {
  return bundle.healthTips
    .filter((tip) => tip.outcomeTier === tier && tip.language === language)
    .filter((tip) => tip.symptomCode === undefined || codes.includes(tip.symptomCode))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * The record that syncs (UT-012).
 *
 * Carries resolved codes, the matched lexicon *entry* (the server's own
 * vocabulary), and answers chosen from a fixed list. **The patient's own words
 * are not in this object and have nowhere to go** — the request schema has no
 * field that could carry them.
 */
export function buildSession(args: {
  bundle: RulesetBundle;
  input: TriageInputState;
  result: TriageResult;
  barangayId: number;
  language: LanguageCode;
  startedAt: string;
}): QueuedSession {
  const { present, negated } = resolveCodes(args.input);
  const matchFor = (code: string) => args.input.matches.find((m) => m.symptomCode === code);

  return {
    client_session_uuid: crypto.randomUUID(),
    barangay_id: args.barangayId,
    ruleset_version_label: args.bundle.versionLabel,
    matched_rule_code: args.result.matchedRuleCode ?? null,
    language: args.language,
    started_at: args.startedAt,
    completed_at: new Date().toISOString(),
    symptoms: [
      ...present.map((code) => ({
        symptom_code: code,
        negated: false,
        matched_term: matchFor(code)?.matchedTerm ?? null,
      })),
      ...negated.map((code) => ({
        symptom_code: code,
        negated: true,
        matched_term: matchFor(code)?.matchedTerm ?? null,
      })),
    ],
    clarification_answers: Object.entries(args.input.answers).map(([question_key, answer]) => ({
      question_key,
      answer,
      is_red_flag: isRedFlagAnswer(args.bundle, question_key, answer),
    })),
  };
}

export { matchSymptoms };
