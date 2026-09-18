<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Data Dictionary Table 13: TRIAGE_SESSION.
 *
 * Anonymous by construction. There is no tier column — use
 * App\Domain\Triage\SessionTierResolver, which applies ADR-0001 precedence.
 *
 * All three timestamps are UTC. Convert to Asia/Manila at display only.
 */
class TriageSession extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'client_session_uuid', 'barangay_id', 'device_id', 'ruleset_version_id',
        'matched_rule_id', 'sync_batch_id', 'language',
        'started_at', 'completed_at', 'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'synced_at' => 'datetime',
        ];
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    public function rulesetVersion(): BelongsTo
    {
        return $this->belongsTo(RulesetVersion::class);
    }

    /** Null whenever the tier came from anything other than a rule match. */
    public function matchedRule(): BelongsTo
    {
        return $this->belongsTo(TriageRule::class, 'matched_rule_id');
    }

    public function syncBatch(): BelongsTo
    {
        return $this->belongsTo(SyncBatch::class);
    }

    public function symptoms(): HasMany
    {
        return $this->hasMany(SessionSymptom::class);
    }

    public function clarificationAnswers(): HasMany
    {
        return $this->hasMany(ClarificationAnswer::class);
    }
}
