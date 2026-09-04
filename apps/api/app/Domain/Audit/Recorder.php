<?php

namespace App\Domain\Audit;

use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Auth;
use InvalidArgumentException;

/**
 * The only writer to audit_logs (Figure 41).
 *
 * Call this from model observers, never from a controller. A controller-level
 * write covers the one path the author was thinking about and misses every
 * other one — a second caller, a console command, a queued job — and the gap
 * is invisible until an auditor asks why an action has no entry.
 */
final class Recorder
{
    /** Column widths from Data Dictionary Table 19. */
    private const MAX_ACTOR_LABEL = 50;
    private const MAX_ACTION_TYPE = 20;
    private const MAX_TARGET_TABLE = 64;

    /**
     * @param  array<string, mixed>|null  $oldValue  State before the change.
     * @param  User|null  $actor  Defaults to the authenticated user; null means
     *                            a system-initiated action.
     */
    public function record(
        string $actionType,
        string $targetTable,
        ?int $targetId = null,
        ?array $oldValue = null,
        ?User $actor = null,
    ): AuditLog {
        $this->guardLength('action_type', $actionType, self::MAX_ACTION_TYPE);
        $this->guardLength('target_table', $targetTable, self::MAX_TARGET_TABLE);

        $actor ??= Auth::user();

        return AuditLog::create([
            'actor_id' => $actor?->getKey(),
            'actor_label' => $this->labelFor($actor),
            'action_type' => $actionType,
            'target_table' => $targetTable,
            'target_id' => $targetId,
            'old_value' => $oldValue,
            // Stored in UTC, always — the audit trail is the one place where a
            // drifting timezone would be unrecoverable after the fact.
            'created_at' => CarbonImmutable::now('UTC'),
        ]);
    }

    /**
     * Every entry names a responsible party, even when there is no account
     * behind it. actor_id may be null; actor_label never is.
     */
    private function labelFor(?User $actor): string
    {
        if ($actor === null) {
            return 'system';
        }

        // The label is a human-readable convenience; actor_id carries the real
        // link, so truncating an unusually long address loses nothing.
        return mb_substr($actor->email, 0, self::MAX_ACTOR_LABEL);
    }

    /**
     * These values are programmer-supplied constants, not user input. An
     * over-length one is a bug, and silently truncating it would corrupt the
     * audit trail rather than surface the mistake.
     */
    private function guardLength(string $field, string $value, int $max): void
    {
        if (mb_strlen($value) > $max) {
            throw new InvalidArgumentException(
                "Audit {$field} exceeds its {$max}-character column: \"{$value}\"."
            );
        }
    }
}
