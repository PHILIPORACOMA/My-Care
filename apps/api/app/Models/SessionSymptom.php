<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 14: SESSION_SYMPTOM.
 */
class SessionSymptom extends Model
{
    public $timestamps = false;

    protected $fillable = ['triage_session_id', 'symptom_code_id', 'matched_term_id', 'negated'];

    protected function casts(): array
    {
        return ['negated' => 'boolean'];
    }

    public function triageSession(): BelongsTo
    {
        return $this->belongsTo(TriageSession::class);
    }

    public function symptomCode(): BelongsTo
    {
        return $this->belongsTo(SymptomCode::class);
    }

    public function matchedTerm(): BelongsTo
    {
        return $this->belongsTo(LexiconTerm::class, 'matched_term_id');
    }
}
