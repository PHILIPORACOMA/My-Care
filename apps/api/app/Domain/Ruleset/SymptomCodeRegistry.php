<?php

namespace App\Domain\Ruleset;

use App\Models\ClarificationQuestion;
use App\Models\HealthTip;
use App\Models\LexiconTerm;
use App\Models\RuleCondition;
use App\Models\SymptomCode;
use Illuminate\Support\Facades\Validator;

/**
 * Creates and edits SYMPTOM_CODE rows (Table 6).
 *
 * Symptom codes are the one piece of ruleset content that is NOT version-scoped
 * — the table has no ruleset_version_id. So an edit to a code changes every
 * version that uses it, including published ones. To keep a published bundle
 * reconstructible, a code becomes **immutable once any frozen version (in
 * review, published or retired) references it**. New codes can always be
 * added. The code string itself never changes after creation: sessions store
 * it by id, and devices send it by value.
 */
final class SymptomCodeRegistry
{
    /**
     * @param  array<string, mixed>  $data
     *
     * @throws RulesetException
     */
    public function create(array $data): SymptomCode
    {
        $validator = Validator::make($data, [
            'code' => ['required', 'string', 'max:50', 'regex:/^[a-z0-9_]+$/', 'unique:symptom_codes,code'],
            'displayName' => ['required', 'string', 'max:100'],
            'needsClarification' => ['required', 'boolean'],
        ]);

        if ($validator->fails()) {
            throw RulesetException::invalid($validator->errors()->toArray());
        }

        return SymptomCode::create([
            'code' => $data['code'],
            'display_name' => $data['displayName'],
            'needs_clarification' => (bool) $data['needsClarification'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     *
     * @throws RulesetException
     */
    public function update(SymptomCode $code, array $data): SymptomCode
    {
        $validator = Validator::make($data, [
            'displayName' => ['sometimes', 'required', 'string', 'max:100'],
            'needsClarification' => ['sometimes', 'required', 'boolean'],
        ]);

        if ($validator->fails()) {
            throw RulesetException::invalid($validator->errors()->toArray());
        }

        if ($this->isFrozen($code)) {
            throw RulesetException::conflict(
                "\"{$code->code}\" is used by a version that is in review, published or retired, so it can no "
                .'longer change. Create a new symptom code instead.'
            );
        }

        $code->update(array_filter([
            'display_name' => $data['displayName'] ?? null,
            'needs_clarification' => array_key_exists('needsClarification', $data) ? (bool) $data['needsClarification'] : null,
        ], fn ($value): bool => $value !== null));

        return $code->refresh();
    }

    public function isFrozen(SymptomCode $code): bool
    {
        $frozen = fn ($query) => $query->whereIn('status', RulesetStatus::FROZEN);
        $id = $code->getKey();

        return LexiconTerm::where('symptom_code_id', $id)->whereHas('rulesetVersion', $frozen)->exists()
            || ClarificationQuestion::where('symptom_code_id', $id)->whereHas('rulesetVersion', $frozen)->exists()
            || HealthTip::where('symptom_code_id', $id)->whereHas('rulesetVersion', $frozen)->exists()
            || RuleCondition::where('symptom_code_id', $id)->whereHas('triageRule.rulesetVersion', $frozen)->exists();
    }
}
