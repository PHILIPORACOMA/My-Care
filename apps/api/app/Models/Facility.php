<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 20: FACILITY.
 *
 * Not yet read by any module — see the migration for the open decision.
 */
class Facility extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'barangay_id', 'name', 'type', 'address',
        'contact_number', 'operating_hours', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }
}
