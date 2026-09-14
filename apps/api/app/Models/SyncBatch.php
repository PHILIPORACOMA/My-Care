<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 22: SYNC_BATCH.
 *
 * client_batch_uuid is UNIQUE in the schema; a retried upload must resolve to
 * this same row rather than creating a second one (UT-015).
 */
class SyncBatch extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'device_id', 'client_batch_uuid', 'session_count', 'status',
        'attempt_count', 'error_code', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function triageSessions(): HasMany
    {
        return $this->hasMany(TriageSession::class);
    }
}
