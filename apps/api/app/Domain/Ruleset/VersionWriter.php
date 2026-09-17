<?php

namespace App\Domain\Ruleset;

use App\Models\ClarificationQuestion;
use App\Models\HealthTip;
use App\Models\LexiconTerm;
use App\Models\RuleCondition;
use App\Models\RulesetVersion;
use App\Models\SeverityThreshold;
use App\Models\SymptomCode;
use App\Models\TriageRule;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Writes one complete RULESET_VERSION and all of its version-scoped content.
 *
 * Every save produces a whole new version rather than editing rows in place
 * (UT-010: "each save creates a new version; prior versions remain
 * retrievable"). Two schema gaps close as a side effect, with no amendment:
 *
 * - **Condition order.** RULE_CONDITION (Table 10) has no sequence column, yet
 *   order changes a rule's meaning. Conditions are only ever inserted here, in
 *   array order, into a version that is never edited afterwards, so the primary
 *   key *is* the sequence — reordering in the console is delete-and-reinsert by
 *   construction.
 * - **Reconstruction.** Content under a version never changes after it is
 *   written, so replaying a session against its ruleset_version_id always sees
 *   the rules that produced it (Figure 41).
 *
 * Content rows are inserted without model events. Auditing each of the
 * hundreds of lexicon terms and conditions on every save would bury Figure
 * 41's log; the version row itself IS audited (created, status changes), and
 * its content is the immutable snapshot the audit entry points at. See
 * ADR-0006.
 */
final class VersionWriter
{
    /**
     * @param  array<string, mixed>  $content  Already validated by ContentValidator.
     */
    public function write(
        array $content,
        string $status,
        ?CarbonImmutable $publishedAt = null,
        ?int $publishedById = null,
    ): RulesetVersion {
        return DB::transaction(function () use ($content, $status, $publishedAt, $publishedById): RulesetVersion {
            $version = $this->createVersionRow($status, $publishedAt, $publishedById);

            Model::withoutEvents(fn () => $this->writeContent($version, $content));

            return $version;
        });
    }

    private function createVersionRow(string $status, ?CarbonImmutable $publishedAt, ?int $publishedById): RulesetVersion
    {
        // The label is v1, v2, v3... in creation order. A concurrent save could
        // pick the same number; the UNIQUE index on label catches it and the
        // allocation is retried rather than surfacing a 500.
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                return DB::transaction(fn (): RulesetVersion => RulesetVersion::create([
                    'label' => $this->nextLabel(),
                    'status' => $status,
                    'published_at' => $publishedAt,
                    'published_by_id' => $publishedById,
                ]));
            } catch (QueryException $e) {
                if ((string) $e->getCode() !== '23000' || $attempt === 2) {
                    throw $e;
                }
            }
        }

        throw new \LogicException('unreachable');
    }

    private function nextLabel(): string
    {
        $highest = RulesetVersion::pluck('label')
            ->map(fn (string $label): int => preg_match('/^v(\d+)$/', $label, $m) ? (int) $m[1] : 0)
            ->max() ?? 0;

        return 'v'.($highest + 1);
    }

    /** @param array<string, mixed> $content */
    private function writeContent(RulesetVersion $version, array $content): void
    {
        $versionId = $version->getKey();
        $codeIds = SymptomCode::pluck('id', 'code')->all();

        foreach ($content['lexiconTerms'] as $term) {
            LexiconTerm::create([
                'ruleset_version_id' => $versionId,
                'symptom_code_id' => $codeIds[$term['symptomCode']],
                'language' => $term['language'],
                'term' => trim($term['term']),
                'is_negation' => (bool) $term['isNegation'],
            ]);
        }

        $thresholdIds = [];
        foreach ($content['severityThresholds'] as $threshold) {
            $thresholdIds[$threshold['key']] = SeverityThreshold::create([
                'ruleset_version_id' => $versionId,
                'key' => $threshold['key'],
                'label' => $threshold['label'],
                'value' => (string) $threshold['value'],
                'tier' => $threshold['tier'],
                'is_override' => (bool) $threshold['isOverride'],
            ])->getKey();
        }

        foreach ($content['clarificationQuestions'] as $question) {
            ClarificationQuestion::create([
                'ruleset_version_id' => $versionId,
                'symptom_code_id' => $codeIds[$question['symptomCode']],
                'question_key' => $question['questionKey'],
                'language' => $question['language'],
                'prompt' => $question['prompt'],
                'answer_type' => $question['answerType'],
                'allowed_answers' => array_values($question['allowedAnswers']),
                'red_flag_answer' => $question['redFlagAnswer'] ?? null,
            ]);
        }

        foreach ($content['rules'] as $rule) {
            $conditions = array_values($rule['conditions']);

            $ruleId = TriageRule::create([
                'code' => $rule['code'],
                'ruleset_version_id' => $versionId,
                'name' => $rule['name'],
                'expression' => ExpressionFormatter::format($conditions, $rule['outcomeTier']),
                'outcome_tier' => $rule['outcomeTier'],
                'priority' => (int) $rule['priority'],
                'is_active' => (bool) $rule['isActive'],
            ])->getKey();

            // In array order, one at a time: the auto-increment id is the
            // condition sequence (see the class comment).
            foreach ($conditions as $condition) {
                $symptom = $condition['symptomCode'] ?? null;
                $thresholdKey = $condition['severityThresholdKey'] ?? null;

                RuleCondition::create([
                    'triage_rule_id' => $ruleId,
                    'symptom_code_id' => $symptom === null ? null : $codeIds[$symptom],
                    'severity_threshold_id' => $thresholdKey === null ? null : $thresholdIds[$thresholdKey],
                    'operator' => $condition['operator'],
                    'attribute' => $condition['attribute'] ?? null,
                    'comparator' => $condition['comparator'] ?? null,
                ]);
            }
        }

        foreach ($content['healthTips'] as $tip) {
            $symptom = $tip['symptomCode'] ?? null;

            HealthTip::create([
                'ruleset_version_id' => $versionId,
                'symptom_code_id' => $symptom === null ? null : $codeIds[$symptom],
                'outcome_tier' => $tip['outcomeTier'],
                'language' => $tip['language'],
                'title' => $tip['title'],
                'body' => $tip['body'],
                'display_order' => (int) $tip['displayOrder'],
            ]);
        }
    }
}
