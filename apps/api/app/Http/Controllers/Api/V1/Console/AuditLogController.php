<?php

namespace App\Http\Controllers\Api\V1\Console;

use App\Domain\Aggregation\DateRange;
use App\Domain\Reports\AuditCategory;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Figure 41, Audit Log. Read-only: there is no endpoint that writes, edits or
 * deletes an entry. Exporting goes through the reports endpoint
 * (type=audit_log), which creates an audited REPORT row.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => ['nullable', 'in:'.implode(',', AuditCategory::CATEGORIES)],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = AuditLog::query()->orderByDesc('id');

        if (isset($data['from']) || isset($data['to'])) {
            $range = DateRange::fromInput($data['from'] ?? null, $data['to'] ?? null);
            $query->where('created_at', '>=', $range->startUtc())->where('created_at', '<', $range->endExclusiveUtc());
        }

        if (($data['category'] ?? null) === 'sign-in') {
            $query->whereIn('action_type', ['login', 'logout', 'login_failed', 'login_throttled']);
        } elseif (isset($data['category'])) {
            $query->whereIn('target_table', AuditCategory::tables($data['category']))
                ->whereNotIn('action_type', ['login', 'logout', 'login_failed', 'login_throttled']);
        }

        $page = $query->paginate(50);

        return response()->json([
            'entries' => collect($page->items())->map(fn (AuditLog $entry): array => [
                'id' => $entry->id,
                'createdAt' => CarbonImmutable::parse($entry->created_at, 'UTC')->toIso8601String(),
                'actorId' => $entry->actor_id,
                'actorLabel' => $entry->actor_label,
                'category' => AuditCategory::of($entry),
                'actionType' => $entry->action_type,
                'targetTable' => $entry->target_table,
                'targetId' => $entry->target_id,
                'oldValue' => $entry->old_value,
            ]),
            'page' => $page->currentPage(),
            'lastPage' => $page->lastPage(),
            'total' => $page->total(),
        ]);
    }
}
