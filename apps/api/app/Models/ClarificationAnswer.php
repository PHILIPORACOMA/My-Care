<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 16: CLARIFICATION_ANSWER.
 *
 * `is_red_flag` is the only persisted trace that ADR-0001 step 1 fired.
 */
class ClarificationAnswer extends Model
{
    public $timestamps = false;

    protected $fillable = ['triage_session_id', 'clarification_question_id', 'answer', 'is_red_flag'];

    protected function casts(): array
    {
        return ['is_red_flag' => 'boolean'];
    }

    public function triageSession(): BelongsTo
    {
        return $this->belongsTo(TriageSession::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ClarificationQuestion::class, 'clarification_question_id');
    }
}
