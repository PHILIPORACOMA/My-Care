<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 8: LEXICON_TERM.
 */
class LexiconTerm extends Model
{
    public $timestamps = false;

    protected $fillable = ['ruleset_version_id', 'symptom_code_id', 'language', 'term', 'is_negation'];

    protected function casts(): array
    {
        return ['is_negation' => 'boolean'];
    }

    public function rulesetVersion(): BelongsTo
    {
        return $this->belongsTo(RulesetVersion::class);
    }

    public function symptomCode(): BelongsTo
    {
        return $this->belongsTo(SymptomCode::class);
    }
}
