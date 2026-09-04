<?php

namespace App\Domain\Triage;

use App\Models\TriageSession;

/**
 * Derives the tier a stored session resolved to.
 *
 * TRIAGE_SESSION (Data Dictionary Table 13) has no outcome_tier column, so the
 * tier is reconstructed from what the session does store, following the same
 * precedence the engine used (ADR-0001):
 *
 *   1. a red-flag clarification answer  -> emergency
 *   2. a matched rule                   -> that rule's outcome_tier
 *   3. nothing matched                  -> rhu, the fail-safe default
 *
 * Step 1 must be checked before step 2, not after: a red-flag answer outranks
 * a rule match in the engine, so a session with both resolved to emergency at
 * the time, and reading the rule's tier here would silently under-report it.
 *
 * ---------------------------------------------------------------------------
 * KNOWN LIMIT — becomes a live defect in Phase 4
 *
 * ADR-0001 step 2 (an is_override severity threshold escalating directly to a
 * tier) leaves no trace in the schema: no column links a session to the
 * threshold that fired. Such a session has no matched rule and no red-flag
 * answer, so it falls through to step 3 and reads as `rhu` — when the tier at
 * the time may well have been `emergency`.
 *
 * This is unreachable today: the v1 bundle ships zero severity thresholds and
 * zero clarification questions, so only steps 2 and 3 can occur and derivation
 * is exact. It stops being unreachable the moment a super-admin authors an
 * override threshold in the console (UT-009), which is Phase 4 scope.
 *
 * The fix is a manuscript amendment adding outcome_tier (and ideally
 * resolution_source) to Table 13. Do not paper over it here — a resolver that
 * guesses would produce a plausible wrong number, which is worse for
 * surveillance data than an obvious gap. See docs/STATUS.md.
 * ---------------------------------------------------------------------------
 */
final class SessionTierResolver
{
    public const TIER_HOME = 'home';
    public const TIER_RHU = 'rhu';
    public const TIER_EMERGENCY = 'emergency';

    /** Ranked low to high; used by callers that need to compare tiers. */
    public const TIER_ORDER = [self::TIER_HOME, self::TIER_RHU, self::TIER_EMERGENCY];

    public function resolve(TriageSession $session): string
    {
        if ($this->hasRedFlagAnswer($session)) {
            return self::TIER_EMERGENCY;
        }

        $rule = $session->relationLoaded('matchedRule')
            ? $session->getRelation('matchedRule')
            : $session->matchedRule;

        if ($rule !== null) {
            return $rule->outcome_tier;
        }

        // Fail-safe. An unrecognised presentation is worth a health worker's
        // judgment; it is never silently downgraded to `home`.
        return self::TIER_RHU;
    }

    private function hasRedFlagAnswer(TriageSession $session): bool
    {
        if ($session->relationLoaded('clarificationAnswers')) {
            return $session->getRelation('clarificationAnswers')
                ->contains(fn ($answer): bool => (bool) $answer->is_red_flag);
        }

        return $session->clarificationAnswers()->where('is_red_flag', true)->exists();
    }
}
