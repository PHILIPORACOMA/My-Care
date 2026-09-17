<?php

namespace App\Domain\Aggregation;

use App\Domain\Triage\EngineReplayer;
use App\Models\TriageSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Rebuilds AGGREGATE_STAT (Table 23) from stored sessions (UT-017).
 *
 * Every session in the window is replayed through the triage engine to recover
 * its tier (ADR-0007), then counted into daily buckets per barangay:
 *
 *   total            symptom null, tier null, language null
 *   by tier          tier set
 *   by symptom       symptom set (non-negated symptoms only)
 *   symptom × tier   both set — what cluster detection watches
 *   by language      language set
 *
 * Counts are stored RAW. Suppression happens on every read path
 * (SuppressionRule), never here: the same bucket may clear the threshold when
 * summed over a longer range, and a pre-suppressed store could never recover
 * that.
 *
 * A rebuild replaces the whole window in one transaction, so a day whose
 * sessions were all corrected away loses its rows rather than keeping stale
 * ones, and a reader never sees a half-written window. It is idempotent: run it
 * twice and the table is the same. Late uploads from devices that were offline
 * for weeks land in the right day on the next scheduled run.
 */
final class Aggregator
{
    public const LAST_RUN_CACHE_KEY = 'aggregation:last-run';

    public function __construct(private readonly EngineReplayer $replayer)
    {
    }

    /** @return array<string, mixed> Summary of the run, also cached for System Health. */
    public function rebuild(DateRange $range): array
    {
        $timezone = DateRange::timezone();
        $counts = [];
        $sessions = 0;
        $failures = 0;
        $disagreements = 0;

        TriageSession::query()
            ->with(['symptoms.symptomCode', 'clarificationAnswers.question', 'rulesetVersion', 'matchedRule'])
            ->where('completed_at', '>=', $range->startUtc())
            ->where('completed_at', '<', $range->endExclusiveUtc())
            ->chunkById((int) config('mycare.replay.chunk_size'), function ($chunk) use (&$counts, &$sessions, &$failures, &$disagreements, $timezone): void {
                $outcomes = $this->replayer->replay($chunk);

                foreach ($chunk as $session) {
                    $outcome = $outcomes[$session->getKey()] ?? null;

                    if ($outcome === null || $outcome->failed()) {
                        $failures++;

                        continue;
                    }

                    $disagreements += $outcome->disagreesWithDevice() ? 1 : 0;
                    $sessions++;

                    $day = CarbonImmutable::parse($session->completed_at)->setTimezone($timezone)->toDateString();
                    $barangay = $session->barangay_id;
                    $tier = $outcome->tier;

                    $this->bump($counts, $barangay, $day, null, null, null);
                    $this->bump($counts, $barangay, $day, null, $tier, null);
                    $this->bump($counts, $barangay, $day, null, null, $session->language);

                    $symptomIds = $session->symptoms
                        ->reject(fn ($s): bool => (bool) $s->negated)
                        ->pluck('symptom_code_id')
                        ->unique();

                    foreach ($symptomIds as $symptomId) {
                        $this->bump($counts, $barangay, $day, $symptomId, null, null);
                        $this->bump($counts, $barangay, $day, $symptomId, $tier, null);
                    }
                }
            });

        $now = CarbonImmutable::now('UTC');

        $rows = array_map(fn (array $row): array => $row + [
            'granularity' => 'day',
            'computed_at' => $now,
        ], array_values($counts));

        DB::transaction(function () use ($range, $rows): void {
            DB::table('aggregate_stats')
                ->where('granularity', 'day')
                ->whereBetween('period_start', [$range->from->toDateString(), $range->to->toDateString()])
                ->delete();

            foreach (array_chunk($rows, 500) as $batch) {
                DB::table('aggregate_stats')->insert($batch);
            }
        });

        $summary = [
            'finishedAt' => $now->toIso8601String(),
            'from' => $range->from->toDateString(),
            'to' => $range->to->toDateString(),
            'sessions' => $sessions,
            'rows' => count($rows),
            'replayFailures' => $failures,
            'deviceDisagreements' => $disagreements,
        ];

        Cache::forever(self::LAST_RUN_CACHE_KEY, $summary);

        if ($failures > 0 || $disagreements > 0) {
            Log::warning('Aggregation found sessions that did not replay cleanly.', $summary);
        }

        return $summary;
    }

    /** @param array<string, array<string, mixed>> $counts */
    private function bump(array &$counts, int $barangay, string $day, ?int $symptomId, ?string $tier, ?string $language): void
    {
        $key = implode('|', [$barangay, $day, $symptomId ?? '-', $tier ?? '-', $language ?? '-']);

        $counts[$key] ??= [
            'barangay_id' => $barangay,
            'symptom_code_id' => $symptomId,
            'period_start' => $day,
            'period_end' => $day,
            'outcome_tier' => $tier,
            'language' => $language,
            'session_count' => 0,
        ];

        $counts[$key]['session_count']++;
    }
}
