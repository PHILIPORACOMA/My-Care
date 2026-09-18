<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 19: AUDIT_LOG (with the approved created_at amendment).
 *
 * Write only through App\Domain\Audit\Recorder, from model observers. Never
 * create one of these from a controller — a controller-level write is exactly
 * the path that gets forgotten when a second caller appears.
 *
 * $timestamps stays false: created_at is a real Data Dictionary column that
 * Recorder sets explicitly, and there is no updated_at, because an audit entry
 * is never updated.
 */
class AuditLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'actor_id', 'actor_label', 'action_type',
        'target_table', 'target_id', 'old_value', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'old_value' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
