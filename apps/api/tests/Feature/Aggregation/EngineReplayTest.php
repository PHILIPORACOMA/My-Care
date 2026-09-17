<?php

use App\Domain\Triage\EngineReplayer;
use App\Models\TriageSession;
use Tests\Support\SessionFixtures;

uses(SessionFixtures::class);

/*
 * Replaces SessionTierResolverTest. The resolver derived a tier from stored
 * columns and could not see an is_override threshold (the Phase 4 tripwire).
 * Replay runs the real engine over the stored inputs instead (ADR-0007).
 */

beforeEach(function () {
    $this->version = $this->publishedFixtureVersion();
    $this->barangay = $this->fixtureBarangay();
});

function replayOne(TriageSession $session)
{
    $loaded = TriageSession::with(['symptoms.symptomCode', 'clarificationAnswers.question', 'rulesetVersion', 'matchedRule'])
        ->whereKey($session->id)->get();

    return app(EngineReplayer::class)->replay($loaded)[$session->id];
}

it('recovers a rule match', function () {
    $outcome = replayOne($this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_a'], deviceRuleCode: 'R-001'));

    expect($outcome->tier)->toBe('home')
        ->and($outcome->matchedRuleCode)->toBe('R-001')
        ->and($outcome->disagreesWithDevice())->toBeFalse();
});

/*
 * THE TRIPWIRE, CLOSED. An override threshold leaves no trace in any column:
 * no matched rule, no red-flag answer. SessionTierResolver read this as rhu.
 */
it('recovers an override-threshold escalation that no column records', function () {
    $session = $this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_a'], ['score' => '9']);

    expect($session->matched_rule_id)->toBeNull()
        ->and($session->clarificationAnswers()->where('is_red_flag', true)->exists())->toBeFalse();

    $outcome = replayOne($session);

    expect($outcome->tier)->toBe('emergency')->and($outcome->reason)->toBe('severity_override');
});

it('recovers a red-flag clarification answer ahead of a rule match', function () {
    $outcome = replayOne($this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_b'], ['severity' => 'worst']));

    expect($outcome->tier)->toBe('emergency')->and($outcome->reason)->toBe('red_flag_clarification');
});

it('ignores a negated symptom and falls back to rhu, never home', function () {
    // "walay ..." — present in the text, not reported (UT-004).
    $outcome = replayOne($this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', [], negated: ['code_a']));

    expect($outcome->tier)->toBe('rhu')->and($outcome->reason)->toBe('fail_safe_default');
});

it('flags a session whose device-reported rule disagrees with the replay', function () {
    $outcome = replayOne($this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_a'], deviceRuleCode: 'R-002'));

    expect($outcome->tier)->toBe('home')->and($outcome->disagreesWithDevice())->toBeTrue();
});

it('refuses to guess when the replay tool is missing', function () {
    config(['mycare.replay.script' => base_path('does-not-exist.mjs')]);

    replayOne($this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_a']));
})->throws(RuntimeException::class, 'Engine replay script not found');
