<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Domain\Aggregation\AggregateReader;
use App\Domain\Aggregation\ClusterDetector;
use App\Domain\Aggregation\DateRange;
use App\Domain\Aggregation\SuppressionRule;
use App\Domain\Auth\BarangayScope;
use App\Domain\Device\PendingQueueReport;
use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\Device;
use App\Models\SymptomCode;
use App\Models\SyncBatch;
use App\Models\TriageSession;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only surveillance views for RHU/LGU staff (Figures 31–33, 35).
 *
 * Every count that leaves these endpoints is a SuppressionRule cell — the raw
 * value is null whenever the bucket is under 5 (UT-020) — and every query is
 * barangay-scoped through BarangayScope (UT-016). Both are single
 * implementations; nothing here compares against 5 or filters by barangay by
 * hand.
 */
class SurveillanceController extends Controller
{
    public function __construct(private readonly AggregateReader $reader)
    {
    }

    /** The barangays this account may view, for the portal's selector. */
    public function barangays(Request $request): JsonResponse
    {
        $query = Barangay::query()->orderBy('name');
        BarangayScope::apply($query, $this->user($request), 'id');

        return response()->json([
            'barangays' => $query->get()->map(fn (Barangay $b): array => ['id' => $b->id, 'name' => $b->name]),
        ]);
    }

    /** Figure 31, Dashboard. */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $range = DateRange::fromInput($request->query('from'), $request->query('to'));
        $barangayId = $this->barangayParam($request);

        $tiers = $this->reader->tierTotals($user, $range, $barangayId);
        $names = SymptomCode::pluck('display_name', 'code');

        // Only displayable symptoms are ranked. Ordering suppressed buckets
        // against each other would leak their relative sizes.
        $top = collect($this->reader->symptomTotals($user, $range, $barangayId))
            ->reject(fn (int $count): bool => SuppressionRule::isSuppressed($count))
            ->take(10)
            ->map(fn (int $count, string $code): array => [
                'code' => $code,
                'displayName' => $names[$code] ?? $code,
                'count' => SuppressionRule::cell($count),
            ])
            ->values();

        return response()->json([
            'range' => $range->toArray(),
            'total' => SuppressionRule::cell(array_sum($tiers)),
            'tiers' => SuppressionRule::partition($tiers),
            'topSymptoms' => $top,
            'computedAt' => $this->reader->lastComputedAt(),
        ]);
    }

    /** Figure 32, Trends & Surveillance (UT-017). */
    public function trends(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $barangayId = $this->barangayParam($request);
        $weeks = (int) config('mycare.clusters.baseline_weeks') + 1;

        $chart = DateRange::lastDays(14);
        $history = DateRange::lastDays($weeks * 7);

        $series = [];
        foreach ($this->reader->dailyTiers($user, $chart, $barangayId) as $date => $tiers) {
            $series[] = [
                'date' => $date,
                'total' => SuppressionRule::cell(array_sum($tiers)),
                'tiers' => SuppressionRule::partition($tiers),
            ];
        }

        $names = SymptomCode::pluck('display_name', 'code');
        $clusters = [];
        $watchList = [];

        foreach ($this->reader->dailySymptomSeries($user, $history, $barangayId) as $key => $daily) {
            [$code, $tier] = explode('|', $key);
            $weekly = $this->weekly($daily, $history, $weeks);
            $assessment = ClusterDetector::assess($weekly);
            $current = end($weekly);

            $entry = [
                'symptomCode' => $code,
                'displayName' => $names[$code] ?? $code,
                'tier' => $tier === '*' ? null : $tier,
                'currentWeek' => SuppressionRule::cell($current),
                'changePercent' => $assessment['changePercent'],
            ];

            if ($assessment['flagged']) {
                $clusters[] = $entry;
            }

            if ($tier === '*') {
                $watchList[] = $entry + [
                    'state' => $assessment['flagged'] ? 'rising' : (SuppressionRule::isSuppressed($current) ? 'low' : 'stable'),
                ];
            }
        }

        $order = ['rising' => 0, 'stable' => 1, 'low' => 2];
        usort($watchList, fn (array $a, array $b): int => [$order[$a['state']], $a['symptomCode']] <=> [$order[$b['state']], $b['symptomCode']]);

        return response()->json([
            'series' => $series,
            'clusters' => $clusters,
            // The days that make up "this week", which the chart shades when a
            // cluster is flagged.
            'currentWeek' => DateRange::lastDays(7)->toArray(),
            'watchList' => $watchList,
            'computedAt' => $this->reader->lastComputedAt(),
        ]);
    }

    /** Figure 33, Sync & System Status (UT-014). */
    public function syncStatus(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $now = CarbonImmutable::now('UTC');

        $barangays = Barangay::query()->orderBy('name');
        BarangayScope::apply($barangays, $user, 'id');
        $barangays = $barangays->get();

        $devices = Device::query()->where('is_approved', true)->whereIn('barangay_id', $barangays->pluck('id'))->get();

        $pending = $devices->map(fn (Device $d): ?int => PendingQueueReport::forDevice($d->id));

        $sessions = TriageSession::query()->whereIn('barangay_id', $barangays->pluck('id'));
        $lastSyncAt = $devices->max('last_sync_at');

        return response()->json([
            'lastSyncAt' => $lastSyncAt?->toIso8601String(),
            'isCurrent' => $lastSyncAt !== null && $lastSyncAt->greaterThan($now->subDay()),
            'devices' => [
                'total' => $devices->count(),
                'reportedLast24h' => $devices->filter(fn (Device $d): bool => $d->last_sync_at?->greaterThan($now->subDay()) ?? false)->count(),
                'reportedLast7d' => $devices->filter(fn (Device $d): bool => $d->last_sync_at?->greaterThan($now->subDays(7)) ?? false)->count(),
                'byType' => $devices->countBy('type'),
            ],
            'pendingUploads' => [
                // Device counts are not patient data, but the queue is a count
                // of patient sessions, so it is suppressed like one.
                'sessions' => SuppressionRule::cell((int) $pending->filter()->sum()),
                'devicesNotReporting' => $pending->filter(fn (?int $n): bool => $n === null)->count(),
            ],
            'sessions' => [
                'last7Days' => SuppressionRule::cell((clone $sessions)->where('synced_at', '>=', $now->subDays(7))->count()),
                'total' => SuppressionRule::cell((clone $sessions)->count()),
            ],
            'lastBatchAt' => optional(
                SyncBatch::whereIn('device_id', $devices->pluck('id'))->max('completed_at'),
                fn ($at) => CarbonImmutable::parse($at, 'UTC')->toIso8601String(),
            ),
            'barangays' => $barangays->map(function (Barangay $b) use ($devices, $now): array {
                $own = $devices->where('barangay_id', $b->id);
                $last = $own->max('last_sync_at');

                return [
                    'id' => $b->id,
                    'name' => $b->name,
                    'devices' => $own->count(),
                    'reportedLast7d' => $own->filter(fn (Device $d): bool => $d->last_sync_at?->greaterThan($now->subDays(7)) ?? false)->count(),
                    'lastSyncAt' => $last?->toIso8601String(),
                ];
            })->values(),
        ]);
    }

    /** Figure 35, Aggregate Map (optional module). */
    public function map(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $range = DateRange::fromInput($request->query('from'), $request->query('to'));
        $totals = $this->reader->barangayTotals($user, $range);

        $barangays = Barangay::query()->orderBy('name');
        BarangayScope::apply($barangays, $user, 'id');

        $visibleMax = max([0, ...array_filter($totals, fn (int $c): bool => ! SuppressionRule::isSuppressed($c))]);

        return response()->json([
            'range' => $range->toArray(),
            'barangays' => $barangays->get()->map(function (Barangay $b) use ($totals, $visibleMax): array {
                $count = $totals[$b->id] ?? 0;

                return [
                    'id' => $b->id,
                    'name' => $b->name,
                    'total' => SuppressionRule::cell($count),
                    'band' => $this->band($count, $visibleMax),
                ];
            })->values(),
        ]);
    }

    /**
     * Relative shading, as Figure 35 describes: lower / elevated / high, against
     * the busiest displayable barangay. Suppressed barangays get their own band
     * so the shading never hints at a masked count.
     */
    private function band(int $count, int $visibleMax): string
    {
        if (SuppressionRule::isSuppressed($count) || $visibleMax === 0) {
            return 'suppressed';
        }

        $share = $count / $visibleMax;

        return $share > 2 / 3 ? 'high' : ($share > 1 / 3 ? 'elevated' : 'low');
    }

    /**
     * @param  array<string, int>  $daily  date => count
     * @return list<int> oldest week first; the last is the 7 days ending today
     */
    private function weekly(array $daily, DateRange $history, int $weeks): array
    {
        $totals = array_fill(0, $weeks, 0);

        foreach ($daily as $date => $count) {
            $daysAgo = (int) CarbonImmutable::parse($date, DateRange::timezone())->diffInDays($history->to);
            $index = $weeks - 1 - intdiv($daysAgo, 7);

            if ($index >= 0 && $index < $weeks) {
                $totals[$index] += $count;
            }
        }

        return $totals;
    }

    private function barangayParam(Request $request): ?int
    {
        $value = $request->query('barangayId');

        return $value === null || $value === '' ? null : (int) $value;
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
