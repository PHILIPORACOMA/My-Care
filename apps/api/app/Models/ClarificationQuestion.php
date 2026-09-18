<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Data Dictionary Table 15: CLARIFICATION_QUESTION.
 *
 * `question_key` doubles as the attribute name a rule condition or severity
 * threshold reads (ADR-0001). There is no separate `attribute` column.
 */
class ClarificationQuestion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'ruleset_version_id', 'symptom_code_id', 'question_key', 'language',
        'prompt', 'answer_type', 'allowed_answers', 'red_flag_answer',
    ];

    protected function casts(): array
    {
        return ['allowed_answers' => 'array'];
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
