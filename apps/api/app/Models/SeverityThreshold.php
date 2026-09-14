<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 11: SEVERITY_THRESHOLD.
 */
class SeverityThreshold extends Model
{
    public $timestamps = false;

    protected $fillable = ['ruleset_version_id', 'key', 'label', 'value', 'tier', 'is_override'];

    protected function casts(): array
    {
        return ['is_override' => 'boolean'];
    }

    public function rulesetVersion(): BelongsTo
    {
        return $this->belongsTo(RulesetVersion::class);
    }
}
