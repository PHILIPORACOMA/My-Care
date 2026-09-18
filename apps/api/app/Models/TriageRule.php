<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 9: TRIAGE_RULE.
 */
class TriageRule extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'code', 'ruleset_version_id', 'name', 'expression',
        'outcome_tier', 'priority', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function rulesetVersion(): BelongsTo
    {
        return $this->belongsTo(RulesetVersion::class);
    }

    public function conditions(): HasMany
    {
        return $this->hasMany(RuleCondition::class);
    }
}
