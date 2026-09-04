<?php

use App\Domain\Triage\SessionTierResolver;
use App\Models\Barangay;
use App\Models\ClarificationAnswer;
use App\Models\ClarificationQuestion;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use App\Models\TriageRule;
use App\Models\TriageSession;
use Illuminate\Support\Str;

/**
 * Mirrors ADR-0001 precedence against stored sessions. The engine's own
 * precedence is covered by packages/triage-engine (UT-005, UT-009); this is
 * the reconstruction side, which the dashboard and every export depend on.
 */
function makeVersion(): RulesetVersion
{
    return RulesetVersion::create([
        'label' => 'v1-draft',
        'status' => 'draft',
        'published_at' => null,
        'published_by_id' => null,
    ]);
}

function makeSession(RulesetVersion $version, ?TriageRule $rule = null): TriageSession
{
    $barangay = Barangay::create([
        'name' => 'Bolinawan', 'city' => 'Carcar City', 'region' => 'Region VII',
    ]);

    return TriageSession::create([
        'client_session_uuid' => (string) Str::uuid(),
        'barangay_id' => $barangay->id,
        'device_id' => null,
        'ruleset_version_id' => $version->id,
        'matched_rule_id' => $rule?->id,
        'sync_batch_id' => null,
        'language' => 'ceb',
        'started_at' => now('UTC')->subMinutes(3),
        'completed_at' => now('UTC'),
        'synced_at' => null,
    ]);
}

function makeRule(RulesetVersion $version, string $tier, string $code = 'R-001'): TriageRule
{
    return TriageRule::create([
        'code' => $code,
        'ruleset_version_id' => $version->id,
        'name' => "Test rule {$code}",
        'expression' => "IF something THEN {$tier}",
        'outcome_tier' => $tier,
        'priority' => 1,
        'is_active' => true,
    ]);
}

it('returns the matched rule\'s tier', function (string $tier) {
    $version = makeVersion();
    $session = makeSession($version, makeRule($version, $tier));

    expect((new SessionTierResolver)->resolve($session))->toBe($tier);
})->with(['home', 'rhu', 'emergency']);

it('falls back to rhu when nothing matched, never home', function () {
    // ADR-0001 step 4. A gap in rule coverage must fail toward more care.
    $session = makeSession(makeVersion());

    expect((new SessionTierResolver)->resolve($session))->toBe('rhu');
});

it('lets a red-flag answer outrank a lower-tier matched rule', function () {
    // ADR-0001 step 1 beats step 3. If this order were reversed, a session that
    // resolved to emergency at the time would be reported as home — the exact
    // under-triage the precedence exists to prevent.
    $version = makeVersion();
    $session = makeSession($version, makeRule($version, 'home'));

    $symptom = SymptomCode::create([
        'code' => 'chest_pain_severe_radiating',
        'display_name' => 'Severe chest pain radiating to arm or jaw',
        'needs_clarification' => true,
    ]);

    $question = ClarificationQuestion::create([
        'ruleset_version_id' => $version->id,
        'symptom_code_id' => $symptom->id,
        'question_key' => 'chest_pain_severity',
        'language' => 'ceb',
        'prompt' => 'Unsa ka grabe ang sakit sa imong dughan?',
        'answer_type' => 'single_select',
        'allowed_answers' => ['mild', 'moderate', 'severe_radiating'],
        'red_flag_answer' => 'severe_radiating',
    ]);

    ClarificationAnswer::create([
        'triage_session_id' => $session->id,
        'clarification_question_id' => $question->id,
        'answer' => 'severe_radiating',
        'is_red_flag' => true,
    ]);

    expect((new SessionTierResolver)->resolve($session->fresh()))->toBe('emergency');
});

it('ignores a non-red-flag answer', function () {
    $version = makeVersion();
    $session = makeSession($version, makeRule($version, 'home'));

    $symptom = SymptomCode::create([
        'code' => 'fever_mild', 'display_name' => 'Fever, mild', 'needs_clarification' => true,
    ]);

    $question = ClarificationQuestion::create([
        'ruleset_version_id' => $version->id,
        'symptom_code_id' => $symptom->id,
        'question_key' => 'fever_duration_days',
        'language' => 'tl',
        'prompt' => 'Ilang araw ka nang lagnat?',
        'answer_type' => 'single_select',
        'allowed_answers' => ['1', '2', '3'],
        'red_flag_answer' => null,
    ]);

    ClarificationAnswer::create([
        'triage_session_id' => $session->id,
        'clarification_question_id' => $question->id,
        'answer' => '2',
        'is_red_flag' => false,
    ]);

    expect((new SessionTierResolver)->resolve($session->fresh()))->toBe('home');
});

it('gives the same answer whether relations are eager-loaded or not', function () {
    $version = makeVersion();
    $session = makeSession($version, makeRule($version, 'emergency'));

    $lazy = (new SessionTierResolver)->resolve($session);
    $eager = (new SessionTierResolver)->resolve(
        TriageSession::with(['matchedRule', 'clarificationAnswers'])->find($session->id)
    );

    expect($lazy)->toBe($eager)->toBe('emergency');
});

it('documents the known Phase 4 gap: a threshold-override session reads as rhu', function () {
    // NOT desired behaviour — a pinned known limit.
    //
    // ADR-0001 step 2 (an is_override severity threshold) leaves no trace in
    // TRIAGE_SESSION, so such a session is indistinguishable from one where
    // nothing matched and derives to `rhu`, even if it escalated to emergency
    // at the time.
    //
    // Unreachable today: the v1 bundle ships zero severity thresholds. It
    // becomes live the first time a super-admin authors an override in the
    // console (UT-009). When Table 13 gains outcome_tier, this test should
    // fail — that is the signal to delete it.
    $session = makeSession(makeVersion());

    expect((new SessionTierResolver)->resolve($session))->toBe('rhu');
});
