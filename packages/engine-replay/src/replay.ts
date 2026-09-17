import type { RulesetBundle, Tier } from "@mycare/ruleset";
import { evaluate, type TriageReason } from "@mycare/triage-engine";

/**
 * The replay protocol between the Laravel API and the triage engine (ADR-0007).
 *
 * TRIAGE_SESSION (Table 13) has no outcome_tier column. Rather than add one by
 * amendment, or re-implement the engine in PHP, the server replays each stored
 * session through this — the very same `evaluate()` the patient's phone ran —
 * against the exact ruleset version the session was triaged under. Because the
 * engine is deterministic and published versions never change, the replayed
 * tier IS the tier the patient was shown. This is Figure 41's reconstruction
 * claim, used for real.
 *
 * Pure: no I/O here. The CLI wrapper in cli.ts owns stdin/stdout.
 */

export interface ReplaySession {
  /** TRIAGE_SESSION.id — echoed back so the caller can join results. */
  id: number;
  versionLabel: string;
  /** Non-negated SESSION_SYMPTOM codes only. A negated symptom was not reported. */
  symptomCodes: string[];
  clarificationAnswers: { questionKey: string; answer: string }[];
}

export interface ReplayRequest {
  bundles: Record<string, RulesetBundle>;
  sessions: ReplaySession[];
}

export interface ReplayResult {
  id: number;
  tier: Tier | null;
  reason: TriageReason | null;
  matchedRuleCode: string | null;
  /** Set when the session could not be replayed; tier is then null. */
  error: string | null;
}

export function replay(request: ReplayRequest): ReplayResult[] {
  return request.sessions.map((session) => {
    const bundle = request.bundles[session.versionLabel];

    if (bundle === undefined) {
      return { id: session.id, tier: null, reason: null, matchedRuleCode: null, error: `No bundle for version ${session.versionLabel}` };
    }

    const result = evaluate(
      { symptomCodes: session.symptomCodes, clarificationAnswers: session.clarificationAnswers },
      bundle
    );

    return {
      id: session.id,
      tier: result.tier,
      reason: result.reason,
      matchedRuleCode: result.matchedRuleCode ?? null,
      error: null,
    };
  });
}
