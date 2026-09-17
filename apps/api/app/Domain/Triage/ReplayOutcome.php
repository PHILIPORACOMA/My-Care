<?php

namespace App\Domain\Triage;

/**
 * One session's replayed result.
 *
 * `storedRuleCode` is what the device reported as the matched rule. When the
 * replay disagrees with it, something is wrong — a tampered or buggy client, or
 * a device that triaged against content the server does not have — and the
 * aggregation run counts it so the System Health screen can show it. The
 * replayed tier is still the one used: it comes from the published rules.
 */
final class ReplayOutcome
{
    public function __construct(
        public readonly ?string $tier,
        public readonly ?string $reason,
        public readonly ?string $matchedRuleCode,
        public readonly ?string $storedRuleCode,
        public readonly ?string $error,
    ) {
    }

    public function failed(): bool
    {
        return $this->tier === null;
    }

    public function disagreesWithDevice(): bool
    {
        return ! $this->failed() && $this->matchedRuleCode !== $this->storedRuleCode;
    }
}
