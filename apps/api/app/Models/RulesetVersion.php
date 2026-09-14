<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 7: RULESET_VERSION.
 */
class RulesetVersion extends Model
{
    public $timestamps = false;

    protected $fillable = ['label', 'status', 'published_at', 'published_by_id'];

    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function publishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by_id');
    }

    public function rules(): HasMany
    {
        return $this->hasMany(TriageRule::class);
    }

    public function lexiconTerms(): HasMany
    {
        return $this->hasMany(LexiconTerm::class);
    }

    public function severityThresholds(): HasMany
    {
        return $this->hasMany(SeverityThreshold::class);
    }

    public function clarificationQuestions(): HasMany
    {
        return $this->hasMany(ClarificationQuestion::class);
    }

    public function healthTips(): HasMany
    {
        return $this->hasMany(HealthTip::class);
    }
}
