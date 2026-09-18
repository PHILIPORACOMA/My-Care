<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 23: AGGREGATE_STAT.
 *
 * session_count is the raw count. Never render it directly — every read path
 * passes it through App\Domain\Aggregation\SuppressionRule first.
 */
class AggregateStat extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'barangay_id', 'symptom_code_id', 'period_start', 'period_end',
        'granularity', 'outcome_tier', 'language', 'session_count', 'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
            'computed_at' => 'datetime',
        ];
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }

    public function symptomCode(): BelongsTo
    {
        return $this->belongsTo(SymptomCode::class);
    }
}
