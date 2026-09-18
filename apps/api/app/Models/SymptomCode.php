<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 6: SYMPTOM_CODE.
 */
class SymptomCode extends Model
{
    public $timestamps = false;

    protected $fillable = ['code', 'display_name', 'needs_clarification'];

    protected function casts(): array
    {
        return ['needs_clarification' => 'boolean'];
    }

    public function lexiconTerms(): HasMany
    {
        return $this->hasMany(LexiconTerm::class);
    }
}
