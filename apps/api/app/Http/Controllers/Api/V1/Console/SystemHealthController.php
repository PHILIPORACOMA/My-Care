<?php

namespace App\Http\Controllers\Api\V1\Console;

use App\Domain\Accounts\AccountManager;
use App\Domain\Aggregation\Aggregator;
use App\Domain\Aggregation\SuppressionRule;
use App\Domain\Device\PendingQueueReport;
use App\Domain\Ruleset\RulesetStatus;
use App\Domain\Triage\EngineReplayer;
use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\Device;
use App\Models\Facility;
use App\Models\RulesetVersion;
use App\Models\SyncBatch;
use App\Models\TriageSession;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Figure 37 (System Dashboard) and Figure 40 (Sync & System Health), system-wide.
 *
 * Figure 37 mentions a "report worker" with a queue. This deployment has no
 * queue workers — reports are generated in the request, and the only
 * background job is the scheduled aggregation — so the service panel reports
 * that job and the engine replay it depends on instead. Recorded in
 * docs/BUILD-LOG.md.
 */
class SystemHealthController extends Controller
{
    public function __invoke(AccountManager $accounts): JsonResponse
    {
        $now = CarbonImmutable::now('UTC');

        $started = hrtime(true);
        $databaseOk = true;
        try {
            DB::select('SELECT 1');
        } catch (\Throwable) {
            $databaseOk = false;
        }
        $databaseMs = round((hrtime(true) - $started) / 1e6, 1);

        $published = RulesetVersion::where('status', RulesetStatus::PUBLISHED)->first();
        $lastRun = Cache::get(Aggregator::LAST_RUN_CACHE_KEY);
        $devices = Device::where('is_approved', true)->get();
        $pending = $devices->map(fn (Device $d): ?int => PendingQueueReport::forDevice($d->id));

        $subAdmins = User::whereHas('role', fn ($q) => $q->where('name', 'sub_admin'))->get();

        $replayOk = EngineReplayer::available();
        $aggregationFresh = $lastRun !== null
            && CarbonImmutable::parse($lastRun['finishedAt'])->greaterThan($now->subMinutes(30));

        return response()->json([
            'appVersion' => config('mycare.version'),
            'checkedAt' => $now->toIso8601String(),
            'services' => [
                ['key' => 'api', 'label' => 'Sync API', 'status' => 'ok', 'detail' => 'Responding'],
                [
                    'key' => 'database', 'label' => 'Database',
                    'status' => $databaseOk ? ($databaseMs > 250 ? 'degraded' : 'ok') : 'down',
                    'detail' => $databaseOk ? "{$databaseMs} ms" : 'Unreachable',
                ],
                [
                    'key' => 'replay', 'label' => 'Engine replay (Node)',
                    'status' => $replayOk ? 'ok' : 'down',
                    'detail' => $replayOk ? 'Available' : 'Node or the replay script is missing — aggregates cannot refresh',
                ],
                [
                    'key' => 'aggregation', 'label' => 'Aggregation job',
                    'status' => $lastRun === null ? 'down' : ($aggregationFresh && ($lastRun['replayFailures'] ?? 0) === 0 ? 'ok' : 'degraded'),
                    'detail' => $lastRun === null ? 'Has not run yet' : sprintf(
                        'Last run %s; %d replay failures, %d device disagreements',
                        $lastRun['finishedAt'], $lastRun['replayFailures'], $lastRun['deviceDisagreements'],
                    ),
                ],
            ],
            'metrics' => [
                'barangaysLive' => $devices->filter(fn (Device $d): bool => $d->last_sync_at?->greaterThan($now->subDays(7)) ?? false)
                    ->pluck('barangay_id')->unique()->count(),
                'barangaysTotal' => Barangay::count(),
                'devicesApproved' => $devices->count(),
                'devicesReportedLast7d' => $devices->filter(fn (Device $d): bool => $d->last_sync_at?->greaterThan($now->subDays(7)) ?? false)->count(),
                'activeSubAdmins' => $subAdmins->reject(fn (User $u): bool => $accounts->isDeactivated($u))->count(),
                'syncQueue' => [
                    'pendingSessions' => SuppressionRule::cell((int) $pending->filter()->sum()),
                    'devicesNotReporting' => $pending->filter(fn (?int $n): bool => $n === null)->count(),
                ],
                'batchesLast24h' => SyncBatch::where('completed_at', '>=', $now->subDay())->count(),
                'sessionsLast24h' => SuppressionRule::cell(TriageSession::where('synced_at', '>=', $now->subDay())->count()),
                'activeFacilities' => Facility::where('is_active', true)->count(),
            ],
            'publishedVersion' => $published === null ? null : [
                'label' => $published->label,
                'publishedAt' => $published->published_at?->toIso8601String(),
            ],
            'lastAggregation' => $lastRun,
            // Figure 40: when each barangay last reported in.
            'barangays' => Barangay::orderBy('name')->get()->map(function (Barangay $b) use ($devices): array {
                $last = $devices->where('barangay_id', $b->id)->max('last_sync_at');

                return [
                    'id' => $b->id,
                    'name' => $b->name,
                    'devices' => $devices->where('barangay_id', $b->id)->count(),
                    'lastSyncAt' => $last?->toIso8601String(),
                ];
            }),
        ]);
    }
}
