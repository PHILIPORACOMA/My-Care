<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 12: DEVICE.
 *
 * An enrolled PWA installation, not a person.
 */
class Device extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'barangay_id', 'type', 'label', 'api_token',
        'status', 'is_approved', 'registered_at', 'last_sync_at',
    ];

    protected $hidden = ['api_token'];

    protected function casts(): array
    {
        return [
            'is_approved' => 'boolean',
            'registered_at' => 'datetime',
            'last_sync_at' => 'datetime',
        ];
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }

    public function syncBatches(): HasMany
    {
        return $this->hasMany(SyncBatch::class);
    }
}
