<?php

namespace App\Domain\Ruleset;

use App\Domain\DomainActionException;
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
     * @throws DomainActionException
     */
    public function create(array $data): SymptomCode
    {
        $validator = Validator::make($data, [
            'code' => ['required', 'string', 'max:50', 'regex:/^[a-z0-9_]+$/', 'unique:symptom_codes,code'],
            'displayName' => ['required', 'string', 'max:100'],
            'needsClarification' => ['required', 'boolean'],
        ]);

        if ($validator->fails()) {
            throw DomainActionException::invalid($validator->errors()->toArray());
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
     * @throws DomainActionException
     */
    public function update(SymptomCode $code, array $data): SymptomCode
    {
        $validator = Validator::make($data, [
            'displayName' => ['sometimes', 'required', 'string', 'max:100'],
            'needsClarification' => ['sometimes', 'required', 'boolean'],
        ]);

        if ($validator->fails()) {
            throw DomainActionException::invalid($validator->errors()->toArray());
        }

        if ($this->isFrozen($code) && ! $this->onlyTurnsOnClarification($code, $data)) {
            throw DomainActionException::conflict(
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

    /**
     * The one change a frozen code still accepts: needs_clarification from off
     * to on, so a later version can add a follow-up question to an existing
     * presentation (Batch 2 Part C). It leaves every frozen version as it was:
     * the phone asks only that version's own questions for the code, and the
     * switch is refused if a frozen version has any. Off again is refused,
     * because it would silence a frozen version's questions. Audited like any
     * other update, by the model observer (ADR-0006).
     *
     * @param  array<string, mixed>  $data
     */
    private function onlyTurnsOnClarification(SymptomCode $code, array $data): bool
    {
        $sameName = ! array_key_exists('displayName', $data) || $data['displayName'] === $code->display_name;

        return $sameName
            && array_key_exists('needsClarification', $data)
            && (bool) $data['needsClarification']
            && ! $code->needs_clarification
            // A frozen version that already holds questions for the code would
            // start asking them.
            && ! ClarificationQuestion::where('symptom_code_id', $code->getKey())
                ->whereHas('rulesetVersion', fn ($query) => $query->whereIn('status', RulesetStatus::FROZEN))
                ->exists();
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
