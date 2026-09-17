<?php

namespace Tests\Support;

use App\Domain\Ruleset\RulesetStatus;
use App\Domain\Ruleset\VersionWriter;
use App\Models\Barangay;
use App\Models\ClarificationQuestion;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use App\Models\TriageRule;
use App\Models\TriageSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Stored-session fixtures for replay, aggregation and surveillance tests.
 *
 * Everything here is test scaffolding — symptom codes named code_a, code_b,
 * rules that exist only to exercise precedence — not clinical content.
 */
trait SessionFixtures
{
    protected function fixtureCodes(): void
    {
        foreach (['code_a' => 'Fixture A', 'code_b' => 'Fixture B', 'code_c' => 'Fixture C'] as $code => $name) {
            SymptomCode::firstOrCreate(['code' => $code], ['display_name' => $name, 'needs_clarification' => false]);
        }
    }

    /**
     * A published version exercising every resolution path:
     * code_a → home (R-001), code_b → rhu (R-002), an override threshold on
     * `score` ≥ 8 → emergency, and a red-flag clarification answer.
     */
    protected function publishedFixtureVersion(): RulesetVersion
    {
        $this->fixtureCodes();

        return app(VersionWriter::class)->write([
            'lexiconTerms' => [],
            'severityThresholds' => [
                ['key' => 'score', 'label' => 'Fixture score', 'value' => '8', 'tier' => 'emergency', 'isOverride' => true],
            ],
            'clarificationQuestions' => [[
                'questionKey' => 'severity', 'symptomCode' => 'code_a', 'language' => 'ceb', 'prompt' => 'Fixture?',
                'answerType' => 'single_select', 'allowedAnswers' => ['mild', 'worst'], 'redFlagAnswer' => 'worst',
            ], [
                'questionKey' => 'score', 'symptomCode' => 'code_a', 'language' => 'ceb', 'prompt' => 'Fixture score?',
                'answerType' => 'single_select', 'allowedAnswers' => ['1', '9'], 'redFlagAnswer' => null,
            ]],
            'rules' => [
                ['code' => 'R-001', 'name' => 'A', 'outcomeTier' => 'home', 'priority' => 1, 'isActive' => true,
                    'conditions' => [['symptomCode' => 'code_a', 'operator' => 'AND']]],
                ['code' => 'R-002', 'name' => 'B', 'outcomeTier' => 'rhu', 'priority' => 2, 'isActive' => true,
                    'conditions' => [['symptomCode' => 'code_b', 'operator' => 'AND']]],
            ],
            'healthTips' => [],
        ], RulesetStatus::PUBLISHED, CarbonImmutable::parse('2026-09-01T00:00:00Z'));
    }

    protected function fixtureBarangay(string $name = 'Valladolid'): Barangay
    {
        return Barangay::firstOrCreate(['name' => $name, 'city' => 'Carcar City', 'region' => 'Region VII']);
    }

    /**
     * @param  list<string>  $codes  reported symptom codes
     * @param  array<string, string>  $answers  question_key => answer
     * @param  list<string>  $negated  codes recorded as negated ("walay ...")
     */
    protected function storedSession(
        RulesetVersion $version,
        Barangay $barangay,
        string $completedAtUtc,
        array $codes,
        array $answers = [],
        ?string $deviceRuleCode = null,
        array $negated = [],
        string $language = 'ceb',
    ): TriageSession {
        $session = TriageSession::create([
            'client_session_uuid' => (string) Str::uuid(),
            'barangay_id' => $barangay->id,
            'device_id' => null,
            'ruleset_version_id' => $version->id,
            'matched_rule_id' => $deviceRuleCode === null ? null
                : TriageRule::where('ruleset_version_id', $version->id)->where('code', $deviceRuleCode)->value('id'),
            'sync_batch_id' => null,
            'language' => $language,
            'started_at' => CarbonImmutable::parse($completedAtUtc)->subMinutes(2),
            'completed_at' => CarbonImmutable::parse($completedAtUtc),
            'synced_at' => CarbonImmutable::parse($completedAtUtc)->addHour(),
        ]);

        foreach ($codes as $code) {
            $session->symptoms()->create(['symptom_code_id' => SymptomCode::where('code', $code)->value('id'), 'matched_term_id' => null, 'negated' => false]);
        }

        foreach ($negated as $code) {
            $session->symptoms()->create(['symptom_code_id' => SymptomCode::where('code', $code)->value('id'), 'matched_term_id' => null, 'negated' => true]);
        }

        foreach ($answers as $key => $answer) {
            $question = ClarificationQuestion::where('ruleset_version_id', $version->id)->where('question_key', $key)->firstOrFail();
            $session->clarificationAnswers()->create([
                'clarification_question_id' => $question->id,
                'answer' => $answer,
                'is_red_flag' => $question->red_flag_answer === $answer,
            ]);
        }

        return $session;
    }

    /** Create $n identical sessions — suppression needs at least 5 to show anything. */
    protected function storedSessions(int $n, RulesetVersion $version, Barangay $barangay, string $completedAtUtc, array $codes, array $answers = []): void
    {
        for ($i = 0; $i < $n; $i++) {
            $this->storedSession($version, $barangay, $completedAtUtc, $codes, $answers);
        }
    }
}
