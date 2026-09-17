<?php

namespace App\Domain\Ruleset;

use App\Models\SymptomCode;
use Illuminate\Support\Facades\Validator;

/**
 * Validates versioned ruleset content before it is written (UT-007–UT-010).
 *
 * "Content" is a RulesetBundle (packages/ruleset/src/schema.ts) minus the two
 * parts that are not version-scoped: `versionLabel` (allocated by the server)
 * and `symptomCodes` (Table 6 is global). Widths come from the Data Dictionary,
 * so a value that passes here cannot be truncated by MySQL.
 *
 * Beyond shape, it enforces the invariants the triage engine silently assumes.
 * A bundle that violated one of these would not crash on the device — it would
 * produce a wrong tier, which is the failure that matters:
 *
 * - every referenced symptom code and threshold key exists;
 * - a condition tests a symptom OR an attribute against a threshold, never both
 *   and never neither (the engine returns false for both, silently);
 * - a clarification question's red-flag answer is one of its allowed answers;
 * - every language variant of one question key shares the same symptom, the
 *   same number of answers and the same red-flag position. The engine resolves a
 *   question by key alone (the first in bundle order), so the PWA submits the
 *   answer at the chosen *position* from that first variant. If variants
 *   disagreed on position, a red-flag answer given in one language could be
 *   missed — an emergency read as routine (ADR-0006).
 */
final class ContentValidator
{
    public const TIERS = ['home', 'rhu', 'emergency'];

    public const LANGUAGES = ['en', 'tl', 'ceb'];

    public const OPERATORS = ['AND', 'OR', 'NOT'];

    public const COMPARATORS = ['=', '!=', '>', '>=', '<', '<='];

    /**
     * @param  array<string, mixed>  $content
     * @param  bool  $forRelease  Also require what a publishable version needs.
     *
     * @throws RulesetException
     */
    public function validate(array $content, bool $forRelease = false): void
    {
        $validator = Validator::make($content, $this->shapeRules());

        $errors = $validator->errors()->toArray();

        if ($errors === []) {
            $errors = $this->crossReferenceErrors($content, $forRelease);
        }

        if ($errors !== []) {
            throw RulesetException::invalid($errors);
        }
    }

    /** @return array<string, mixed> */
    private function shapeRules(): array
    {
        $tier = 'in:'.implode(',', self::TIERS);
        $language = 'in:'.implode(',', self::LANGUAGES);

        return [
            'lexiconTerms' => ['present', 'array', 'max:5000'],
            'lexiconTerms.*.symptomCode' => ['required', 'string', 'max:50'],
            'lexiconTerms.*.language' => ['required', $language],
            'lexiconTerms.*.term' => ['required', 'string', 'max:100'],
            'lexiconTerms.*.isNegation' => ['required', 'boolean'],

            'severityThresholds' => ['present', 'array', 'max:200'],
            'severityThresholds.*.key' => ['required', 'string', 'max:50', 'regex:/^[a-z0-9_]+$/'],
            'severityThresholds.*.label' => ['required', 'string', 'max:100'],
            // Stored as VARCHAR(30), but the engine compares with Number(), so
            // anything non-numeric would compare as NaN and never match.
            'severityThresholds.*.value' => ['required', 'max:30', 'regex:/^-?\d+(\.\d+)?$/'],
            'severityThresholds.*.tier' => ['required', $tier],
            'severityThresholds.*.isOverride' => ['required', 'boolean'],

            'clarificationQuestions' => ['present', 'array', 'max:500'],
            'clarificationQuestions.*.questionKey' => ['required', 'string', 'max:50', 'regex:/^[a-z0-9_]+$/'],
            'clarificationQuestions.*.symptomCode' => ['required', 'string', 'max:50'],
            'clarificationQuestions.*.language' => ['required', $language],
            'clarificationQuestions.*.prompt' => ['required', 'string', 'max:2000'],
            'clarificationQuestions.*.answerType' => ['required', 'in:single_select'],
            'clarificationQuestions.*.allowedAnswers' => ['required', 'array', 'min:2', 'max:6'],
            // Duplicates are checked per question below: Laravel's `distinct`
            // on a nested wildcard compares across every question, and two
            // questions may legitimately both offer "mild".
            'clarificationQuestions.*.allowedAnswers.*' => ['required', 'string', 'max:50'],
            'clarificationQuestions.*.redFlagAnswer' => ['nullable', 'string', 'max:50'],

            'rules' => ['present', 'array', 'max:1000'],
            'rules.*.code' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9_.-]+$/'],
            'rules.*.name' => ['required', 'string', 'max:150'],
            'rules.*.outcomeTier' => ['required', $tier],
            'rules.*.priority' => ['required', 'integer', 'min:0', 'max:1000000'],
            'rules.*.isActive' => ['required', 'boolean'],
            'rules.*.conditions' => ['required', 'array', 'min:1', 'max:20'],
            'rules.*.conditions.*.operator' => ['required', 'in:'.implode(',', self::OPERATORS)],
            'rules.*.conditions.*.symptomCode' => ['nullable', 'string', 'max:50'],
            'rules.*.conditions.*.attribute' => ['nullable', 'string', 'max:30', 'regex:/^[a-z0-9_]+$/'],
            'rules.*.conditions.*.comparator' => ['nullable', 'in:'.implode(',', self::COMPARATORS)],
            'rules.*.conditions.*.severityThresholdKey' => ['nullable', 'string', 'max:50'],

            'healthTips' => ['present', 'array', 'max:2000'],
            'healthTips.*.symptomCode' => ['nullable', 'string', 'max:50'],
            'healthTips.*.outcomeTier' => ['required', $tier],
            'healthTips.*.language' => ['required', $language],
            'healthTips.*.title' => ['required', 'string', 'max:150'],
            'healthTips.*.body' => ['required', 'string', 'max:5000'],
            'healthTips.*.displayOrder' => ['required', 'integer', 'min:0', 'max:1000000'],
        ];
    }

    /**
     * @param  array<string, mixed>  $content
     * @return array<string, list<string>>
     */
    private function crossReferenceErrors(array $content, bool $forRelease): array
    {
        $errors = [];
        $add = function (string $field, string $message) use (&$errors): void {
            $errors[$field][] = $message;
        };

        $known = array_flip(SymptomCode::pluck('code')->all());
        $requireCode = function (?string $code, string $field) use ($known, $add): void {
            if ($code !== null && ! isset($known[$code])) {
                $add($field, "Unknown symptom code \"{$code}\". Add it under Symptom codes first.");
            }
        };

        $seenTerms = [];
        foreach ($content['lexiconTerms'] as $i => $term) {
            $requireCode($term['symptomCode'], "lexiconTerms.{$i}.symptomCode");
            // The table's unique index is case-insensitive (utf8mb4_unicode_ci).
            $key = $term['language'].'|'.mb_strtolower(trim($term['term']));
            if (isset($seenTerms[$key])) {
                $add("lexiconTerms.{$i}.term", "\"{$term['term']}\" appears twice for language {$term['language']}.");
            }
            $seenTerms[$key] = true;
        }

        $thresholdKeys = [];
        foreach ($content['severityThresholds'] as $i => $threshold) {
            if (isset($thresholdKeys[$threshold['key']])) {
                $add("severityThresholds.{$i}.key", "Threshold key \"{$threshold['key']}\" is used twice.");
            }
            $thresholdKeys[$threshold['key']] = true;
        }

        $variants = [];
        foreach ($content['clarificationQuestions'] as $i => $question) {
            $requireCode($question['symptomCode'], "clarificationQuestions.{$i}.symptomCode");

            if (count(array_unique($question['allowedAnswers'])) !== count($question['allowedAnswers'])) {
                $add("clarificationQuestions.{$i}.allowedAnswers", 'An answer is listed twice.');
            }

            $redFlag = $question['redFlagAnswer'] ?? null;
            $position = $redFlag === null ? null : array_search($redFlag, $question['allowedAnswers'], true);

            if ($redFlag !== null && $position === false) {
                $add("clarificationQuestions.{$i}.redFlagAnswer", 'The red-flag answer must be one of the allowed answers.');
            }

            if (isset($variants[$question['questionKey']][$question['language']])) {
                $add("clarificationQuestions.{$i}.language", "Question \"{$question['questionKey']}\" has two {$question['language']} versions.");
            }

            $variants[$question['questionKey']][$question['language']] = [
                'index' => $i,
                'symptomCode' => $question['symptomCode'],
                'answerCount' => count($question['allowedAnswers']),
                'redFlagPosition' => $position === false ? null : $position,
            ];
        }

        foreach ($variants as $key => $byLanguage) {
            $signatures = array_unique(array_map(
                fn (array $v): string => $v['symptomCode'].'|'.$v['answerCount'].'|'.var_export($v['redFlagPosition'], true),
                $byLanguage,
            ));

            if (count($signatures) > 1) {
                $first = reset($byLanguage);
                $add(
                    "clarificationQuestions.{$first['index']}.questionKey",
                    "Every language version of \"{$key}\" must have the same symptom, the same number of answers, "
                    .'and the red-flag answer in the same position.',
                );
            }
        }

        $ruleCodes = [];
        $activeRules = 0;
        foreach ($content['rules'] as $i => $rule) {
            if (isset($ruleCodes[$rule['code']])) {
                $add("rules.{$i}.code", "Rule code \"{$rule['code']}\" is used twice.");
            }
            $ruleCodes[$rule['code']] = true;
            $activeRules += $rule['isActive'] ? 1 : 0;

            foreach ($rule['conditions'] as $j => $condition) {
                $field = "rules.{$i}.conditions.{$j}";
                $symptom = $condition['symptomCode'] ?? null;
                $attribute = $condition['attribute'] ?? null;
                $comparator = $condition['comparator'] ?? null;
                $thresholdKey = $condition['severityThresholdKey'] ?? null;
                $testsAttribute = $attribute !== null || $comparator !== null || $thresholdKey !== null;

                if ($symptom !== null && $testsAttribute) {
                    $add($field, 'A condition tests either a symptom or an attribute against a threshold, not both.');
                } elseif ($symptom === null && ! $testsAttribute) {
                    $add($field, 'A condition must test a symptom, or an attribute against a threshold.');
                } elseif ($symptom !== null) {
                    $requireCode($symptom, "{$field}.symptomCode");
                } elseif ($attribute === null || $comparator === null || $thresholdKey === null) {
                    $add($field, 'An attribute condition needs an attribute, a comparator and a threshold.');
                } elseif (! isset($thresholdKeys[$thresholdKey])) {
                    $add("{$field}.severityThresholdKey", "Unknown threshold key \"{$thresholdKey}\".");
                }
            }
        }

        foreach ($content['healthTips'] as $i => $tip) {
            $requireCode($tip['symptomCode'] ?? null, "healthTips.{$i}.symptomCode");
        }

        if ($forRelease && $activeRules === 0) {
            $add('rules', 'A version needs at least one active rule before it can be reviewed or published.');
        }

        return $errors;
    }
}
