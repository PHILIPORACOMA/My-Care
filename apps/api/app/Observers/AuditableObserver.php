<?php

namespace App\Observers;

use App\Domain\Audit\Recorder;
use Illuminate\Database\Eloquent\Model;

/**
 * Writes an AUDIT_LOG entry for every change to an auditable model (Figure 41).
 *
 * Registered from AppServiceProvider, never invoked from a controller — that is
 * the project rule, and the reason is that a controller-level write covers the
 * one path its author had in mind and misses every other: a console command, a
 * queued job, a second caller added later. An observer cannot be bypassed by
 * forgetting about it.
 *
 * What is audited is a deliberate subset. See AppServiceProvider for the list
 * and the reasoning: this is a record of privileged configuration changes, not
 * a copy of the patient data stream.
 */
class AuditableObserver
{
    public function __construct(private readonly Recorder $recorder)
    {
    }

    public function created(Model $model): void
    {
        // old_value is null for a creation: there was no prior state to record.
        $this->record('created', $model, null);
    }

    public function updated(Model $model): void
    {
        if ($this->isIgnorableUpdate($model)) {
            return;
        }

        // getOriginal() is the state before this save — "State Before" in
        // Table 19. Only the columns that actually changed are kept, so the
        // entry reads as a diff rather than a full row dump.
        $before = array_intersect_key($model->getOriginal(), $model->getChanges());

        $this->record('updated', $model, $before);
    }

    public function deleted(Model $model): void
    {
        $this->record('deleted', $model, $model->getOriginal());
    }

    /**
     * Some updates are machine heartbeats rather than decisions by a person.
     * DEVICE.last_sync_at is written on every successful upload; auditing it
     * would bury the handful of entries that matter — who changed a triage
     * rule, who approved a device — under thousands that do not, and Figure
     * 41's screen is meant to be read.
     */
    private function isIgnorableUpdate(Model $model): bool
    {
        $ignored = self::IGNORED_ATTRIBUTES[$model::class] ?? [];

        if ($ignored === []) {
            return false;
        }

        $changed = array_keys($model->getChanges());

        return $changed !== [] && array_diff($changed, $ignored) === [];
    }

    /** @var array<class-string, list<string>> */
    private const IGNORED_ATTRIBUTES = [
        \App\Models\Device::class => ['last_sync_at', 'status'],
    ];

    /** @param array<string, mixed>|null $oldValue */
    private function record(string $action, Model $model, ?array $oldValue): void
    {
        $this->recorder->record(
            actionType: $action,
            targetTable: $model->getTable(),
            targetId: $model->getKey(),
            oldValue: $this->redact($model, $oldValue),
        );
    }

    /**
     * Secrets never reach the audit log. A password digest or a device token in
     * old_value would turn the audit trail — which more people can read than
     * can read the users table — into a credential store.
     *
     * @param  array<string, mixed>|null  $values
     * @return array<string, mixed>|null
     */
    private function redact(Model $model, ?array $values): ?array
    {
        if ($values === null) {
            return null;
        }

        foreach (['password_hash', 'api_token', 'remember_token'] as $secret) {
            if (array_key_exists($secret, $values)) {
                $values[$secret] = '[redacted]';
            }
        }

        return $values;
    }
}
