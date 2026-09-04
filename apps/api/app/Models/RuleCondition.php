<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 10: RULE_CONDITION.
 */
class RuleCondition extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'triage_rule_id', 'symptom_code_id', 'severity_threshold_id',
        'operator', 'attribute', 'comparator',
    ];

    public function triageRule(): BelongsTo
    {
        return $this->belongsTo(TriageRule::class);
    }

    public function symptomCode(): BelongsTo
    {
        return $this->belongsTo(SymptomCode::class);
    }

    public function severityThreshold(): BelongsTo
    {
        return $this->belongsTo(SeverityThreshold::class);
    }
}
