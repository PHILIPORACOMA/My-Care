<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 20: FACILITY.
 *
 * Powers the patient app's emergency "Call for help" (Figure 27, ADR-0005).
 * Loaded from the City Health Office CSV or edited in the console
 * (Console\FacilityController); either way, numbers pass FacilityRules.
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
