<?php

namespace App\Domain\Ruleset;

use App\Models\RulesetVersion;
use App\Models\SymptomCode;

/**
 * Builds the RulesetBundle that ships to a device, from the version-scoped
 * tables that hold its content.
 *
 * The output shape is the contract in packages/ruleset/src/schema.ts, which the
 * on-device triage engine consumes directly. Keys are camelCase because that is
 * what the TypeScript contract declares; the database columns they come from are
 * snake_case per the Data Dictionary. This class is the single translation point
 * between the two — if the contract changes, it changes here and in schema.ts
 * together, never in a controller.
 *
 * Referential transparency matters here as much as in the engine: the same
 * version must assemble to the same bundle every time, because a past triage
 * result is only reconstructible if the ruleset that produced it can be rebuilt
 * exactly (Figure 41). Every query below is therefore explicitly ordered.
 */
final class BundleAssembler
{
    /** @return array<string, mixed> */
    public function assemble(RulesetVersion $version): array
    {
        $version->loadMissing([
            'lexiconTerms.symptomCode',
            'severityThresholds',
            'clarificationQuestions.symptomCode',
            'rules.conditions.symptomCode',
            'rules.conditions.severityThreshold',
            'healthTips.symptomCode',
        ]);

        return [
            'versionLabel' => $version->label,
            'symptomCodes' => $this->symptomCodes(),
            'lexiconTerms' => $this->lexiconTerms($version),
            'severityThresholds' => $this->severityThresholds($version),
            'clarificationQuestions' => $this->clarificationQuestions($version),
            'rules' => $this->rules($version),
            'healthTips' => $this->healthTips($version),
        ];
    }

    /**
     * SYMPTOM_CODE (Table 6) is NOT version-scoped — it has no
     * ruleset_version_id — so every code ships with every bundle. That is the
     * dictionary's design, not an oversight here: a code is a stable identifier
     * that outlives any one ruleset version, which is what lets a session
     * recorded under v1 still be counted under v2.
     *
     * @return list<array<string, mixed>>
     */
    private function symptomCodes(): array
    {
        return SymptomCode::orderBy('code')->get()
            ->map(fn (SymptomCode $code): array => [
                'code' => $code->code,
                'displayName' => $code->display_name,
                'needsClarification' => (bool) $code->needs_clarification,
            ])
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function lexiconTerms(RulesetVersion $version): array
    {
        return $version->lexiconTerms
            ->sortBy([['language', 'asc'], ['term', 'asc']])
            ->values()
            ->map(fn ($term): array => [
                'symptomCode' => $term->symptomCode->code,
                'language' => $term->language,
                'term' => $term->term,
                'isNegation' => (bool) $term->is_negation,
            ])
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function severityThresholds(RulesetVersion $version): array
    {
        return $version->severityThresholds
            ->sortBy('key')
            ->values()
            ->map(fn ($threshold): array => [
                'key' => $threshold->key,
                'label' => $threshold->label,
                'value' => $threshold->value,
                'tier' => $threshold->tier,
                'isOverride' => (bool) $threshold->is_override,
            ])
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function clarificationQuestions(RulesetVersion $version): array
    {
        return $version->clarificationQuestions
            ->sortBy([['question_key', 'asc'], ['language', 'asc']])
            ->values()
            ->map(fn ($question): array => array_filter([
                'questionKey' => $question->question_key,
                'symptomCode' => $question->symptomCode->code,
                'language' => $question->language,
                'prompt' => $question->prompt,
                'answerType' => $question->answer_type,
                'allowedAnswers' => $question->allowed_answers,
                'redFlagAnswer' => $question->red_flag_answer,
            ], fn ($value): bool => $value !== null))
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function rules(RulesetVersion $version): array
    {
        return $version->rules
            ->sortBy([['priority', 'asc'], ['code', 'asc']])
            ->values()
            ->map(fn ($rule): array => [
                'code' => $rule->code,
                'name' => $rule->name,
                'expression' => $rule->expression,
                'conditions' => $this->conditions($rule),
                'outcomeTier' => $rule->outcome_tier,
                'priority' => $rule->priority,
                'isActive' => (bool) $rule->is_active,
            ])
            ->all();
    }

    /**
     * Condition order is semantically load-bearing: each condition's `operator`
     * says how it combines with the ones before it, so reordering a rule's
     * conditions can change the tier it produces.
     *
     * RULE_CONDITION (Table 10) has no sequence column, so insertion order —
     * the primary key — is the only ordering the schema offers. Sorting by `id`
     * is therefore not an arbitrary tie-break but the actual contract, and it
     * is stable for as long as conditions are only ever appended. A rule-
     * authoring UI that lets a super-admin reorder conditions (Phase 4, UT-007)
     * will need either a sequence column by amendment, or delete-and-reinsert
     * semantics. Flagged in docs/STATUS.md.
     *
     * @return list<array<string, mixed>>
     */
    private function conditions($rule): array
    {
        return $rule->conditions
            ->sortBy('id')
            ->values()
            ->map(fn ($condition): array => array_filter([
                'symptomCode' => $condition->symptomCode?->code,
                'attribute' => $condition->attribute,
                'comparator' => $condition->comparator,
                'severityThresholdKey' => $condition->severityThreshold?->key,
                'operator' => $condition->operator,
            ], fn ($value): bool => $value !== null))
            ->all();
    }

    /** @return list<array<string, mixed>> */
    private function healthTips(RulesetVersion $version): array
    {
        return $version->healthTips
            ->sortBy([['display_order', 'asc'], ['id', 'asc']])
            ->values()
            ->map(fn ($tip): array => array_filter([
                'symptomCode' => $tip->symptomCode?->code,
                'outcomeTier' => $tip->outcome_tier,
                'language' => $tip->language,
                'title' => $tip->title,
                'body' => $tip->body,
                'displayOrder' => $tip->display_order,
            ], fn ($value): bool => $value !== null))
            ->all();
    }
}
