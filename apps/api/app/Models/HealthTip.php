<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 21: HEALTH_TIP.
 *
 * Medical content — nothing may be seeded here without clinical review.
 */
class HealthTip extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'ruleset_version_id', 'symptom_code_id', 'outcome_tier',
        'language', 'title', 'body', 'display_order',
    ];

    public function rulesetVersion(): BelongsTo
    {
        return $this->belongsTo(RulesetVersion::class);
    }

    public function symptomCode(): BelongsTo
    {
        return $this->belongsTo(SymptomCode::class);
    }
}
