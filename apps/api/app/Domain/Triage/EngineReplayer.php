<?php

namespace App\Domain\Triage;

use App\Domain\Ruleset\BundleAssembler;
use App\Models\RulesetVersion;
use App\Models\TriageSession;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Recovers the tier each stored session resolved to, by replaying it through
 * the real triage engine (ADR-0007).
 *
 * TRIAGE_SESSION (Table 13) has no outcome_tier column. The previous
 * SessionTierResolver derived the tier from what the row stores, and was exact
 * only while no ruleset contained an is_override severity threshold — such an
 * escalation leaves no trace in any column, so it read as `rhu`. That was the
 * Phase 4 tripwire.
 *
 * Replay closes it without an amendment and without a second implementation of
 * the engine. The inputs `evaluate()` needs are all stored: the non-negated
 * symptom codes (SESSION_SYMPTOM) and the clarification answers
 * (CLARIFICATION_ANSWER, keyed by their question). The ruleset version is
 * recorded on the session and never changes after publication (ADR-0006). The
 * engine is deterministic. So running the same function over the same inputs
 * and the same rules yields exactly the tier the patient saw — including
 * override and red-flag escalations.
 *
 * This runs packages/engine-replay under Node. If Node or the script is
 * missing it throws: a dashboard built on guessed tiers is worse than one that
 * refuses to refresh.
 */
final class EngineReplayer
{
    public function __construct(private readonly BundleAssembler $assembler)
    {
    }

    /**
     * @param  Collection<int, TriageSession>  $sessions  With symptoms.symptomCode, clarificationAnswers.question, rulesetVersion, matchedRule loaded.
     * @return array<int, ReplayOutcome> keyed by session id
     */
    public function replay(Collection $sessions): array
    {
        if ($sessions->isEmpty()) {
            return [];
        }

        $bundles = [];
        $outcomes = [];

        foreach ($sessions->chunk((int) config('mycare.replay.chunk_size')) as $chunk) {
            $payload = ['bundles' => [], 'sessions' => []];

            foreach ($chunk as $session) {
                $label = $session->rulesetVersion->label;
                $bundles[$label] ??= $this->assembler->assemble($session->rulesetVersion);
                $payload['bundles'][$label] = $bundles[$label];
                $payload['sessions'][] = self::input($session);
            }

            foreach ($this->run($payload) as $result) {
                $session = $chunk->firstWhere('id', $result['id']);

                $outcomes[$result['id']] = new ReplayOutcome(
                    tier: $result['tier'],
                    reason: $result['reason'],
                    matchedRuleCode: $result['matchedRuleCode'],
                    storedRuleCode: $session?->matchedRule?->code,
                    error: $result['error'],
                );
            }
        }

        return $outcomes;
    }

    /**
     * The exact TriageInput the device built, reconstructed from stored rows.
     *
     * @return array<string, mixed>
     */
    public static function input(TriageSession $session): array
    {
        return [
            'id' => $session->getKey(),
            'versionLabel' => $session->rulesetVersion->label,
            'symptomCodes' => $session->symptoms
                ->reject(fn ($symptom): bool => (bool) $symptom->negated)
                ->map(fn ($symptom): string => $symptom->symptomCode->code)
                ->unique()
                ->values()
                ->all(),
            'clarificationAnswers' => $session->clarificationAnswers
                ->map(fn ($answer): array => [
                    'questionKey' => $answer->question->question_key,
                    'answer' => $answer->answer,
                ])
                ->values()
                ->all(),
        ];
    }

    /** Whether the replay tool can run here. Cached briefly for the health screen. */
    public static function available(): bool
    {
        return Cache::remember('engine-replay-available', 60, function (): bool {
            if (! is_readable((string) config('mycare.replay.script'))) {
                return false;
            }

            return Process::timeout(10)->run([config('mycare.replay.node_binary'), '--version'])->successful();
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     */
    private function run(array $payload): array
    {
        $script = (string) config('mycare.replay.script');

        if (! is_readable($script)) {
            throw new RuntimeException(
                "Engine replay script not found at {$script}. Build it with `npm run build -w @mycare/engine-replay`."
            );
        }

        $process = Process::timeout((int) config('mycare.replay.timeout_seconds'))
            ->input(json_encode($payload, JSON_THROW_ON_ERROR))
            ->run([config('mycare.replay.node_binary'), $script]);

        if (! $process->successful()) {
            throw new RuntimeException('Engine replay failed: '.trim($process->errorOutput() ?: $process->output()));
        }

        $decoded = json_decode($process->output(), true, flags: JSON_THROW_ON_ERROR);

        return $decoded['results'];
    }
}
