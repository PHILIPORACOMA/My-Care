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

    /**
     * Whether the replay tool can run here, and why not when it cannot.
     *
     * Never throws. This feeds the System Health screen, and a health check that
     * dies with a 500 tells an operator nothing — which is exactly what happened
     * the first time the console called it: under `php artisan serve` on Windows
     * the child process inherits no TMP/TEMP, so Symfony's Process could not
     * create its pipe files and the endpoint 500ed.
     *
     * @return array{ok: bool, detail: string}
     */
    public static function availability(): array
    {
        return Cache::remember('engine-replay-availability', 60, function (): array {
            $script = (string) config('mycare.replay.script');

            if (! is_readable($script)) {
                return ['ok' => false, 'detail' => "Script missing at {$script}. Run `npm run build -w @mycare/engine-replay`."];
            }

            if (($temp = self::unwritableTempDir()) !== null) {
                return ['ok' => false, 'detail' => $temp];
            }

            try {
                $process = Process::timeout(10)->run([config('mycare.replay.node_binary'), '--version']);
            } catch (\Throwable $e) {
                return ['ok' => false, 'detail' => 'Could not start Node: '.$e->getMessage()];
            }

            return $process->successful()
                ? ['ok' => true, 'detail' => 'Node '.trim($process->output())]
                : ['ok' => false, 'detail' => 'Node did not run: '.trim($process->errorOutput() ?: $process->output())];
        });
    }

    public static function available(): bool
    {
        return self::availability()['ok'];
    }

    /**
     * PHP writes a process's output through temporary files on Windows, so an
     * unwritable temp directory breaks replay before Node is ever reached. The
     * message names the cause, because the raw Symfony error ("fopen(
     * C:\WINDOWS\sf_proc_00.out.lock)") reads like a permissions mystery.
     */
    private static function unwritableTempDir(): ?string
    {
        $temp = sys_get_temp_dir();

        if (is_dir($temp) && is_writable($temp)) {
            return null;
        }

        return "The PHP process has no writable temporary directory (got \"{$temp}\"), so it cannot run Node. "
            .'Set TMP and TEMP for the web server process — under `php artisan serve` on Windows they are not inherited.';
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

        if (($temp = self::unwritableTempDir()) !== null) {
            throw new RuntimeException('Engine replay cannot start. '.$temp);
        }

        try {
            $process = Process::timeout((int) config('mycare.replay.timeout_seconds'))
                ->input(json_encode($payload, JSON_THROW_ON_ERROR))
                ->run([config('mycare.replay.node_binary'), $script]);
        } catch (\Throwable $e) {
            // Aggregation must fail loudly rather than count sessions it could
            // not replay — a wrong dashboard is worse than a stale one.
            throw new RuntimeException('Engine replay could not start: '.$e->getMessage(), previous: $e);
        }

        if (! $process->successful()) {
            throw new RuntimeException('Engine replay failed: '.trim($process->errorOutput() ?: $process->output()));
        }

        $decoded = json_decode($process->output(), true, flags: JSON_THROW_ON_ERROR);

        return $decoded['results'];
    }
}
