<?php

use App\Models\HealthTip;
use App\Models\RulesetVersion;
use App\Models\SeverityThreshold;
use Carbon\CarbonImmutable;
use Tests\Feature\Api\ApiTestHelpers;

uses(ApiTestHelpers::class);

beforeEach(function () {
    $this->barangay = $this->makeBarangay();
    $this->device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);
});

it('serves 503 when nothing has been published yet', function () {
    // Not 404: the resource is not missing, the server is not yet in a state to
    // serve it. A device should retry, not conclude that no ruleset exists.
    $this->withHeaders($this->asDevice($this->device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(503);
});

/*
 * A draft is unreviewed clinical content by definition. A handset that cached
 * one would be triaging patients against rules nobody has signed off.
 */
it('never serves a draft version', function () {
    RulesetVersion::create([
        'label' => 'v2-draft',
        'status' => 'draft',
        'published_at' => null,
        'published_by_id' => null,
    ]);

    $this->withHeaders($this->asDevice($this->device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(503);
});

it('serves the most recently published version', function () {
    $older = $this->makePublishedVersion('v1-published');
    $newer = RulesetVersion::create([
        'label' => 'v2-published',
        'status' => 'published',
        'published_at' => CarbonImmutable::parse('2026-09-05T00:00:00Z'),
        'published_by_id' => null,
    ]);

    $this->withHeaders($this->asDevice($this->device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(200)
        ->assertJsonPath('versionLabel', 'v2-published')
        ->assertJsonPath('bundle.versionLabel', 'v2-published');

    expect($older->label)->not->toBe($newer->label);
});

it('assembles a bundle in the shape the triage engine contract declares', function () {
    $version = $this->makePublishedVersion();
    $code = $this->makeSymptomCode('fever_mild');
    $this->makeRule($version, 'R-001', 'rhu');
    $this->makeLexiconTerm($version, $code, 'hilanat');
    $this->makeQuestion($version, $code, 'fever_duration_days');

    SeverityThreshold::create([
        'ruleset_version_id' => $version->getKey(),
        'key' => 'fever_duration_days',
        'label' => 'Fever lasting three days or more',
        'value' => '3',
        'tier' => 'rhu',
        'is_override' => true,
    ]);

    $response = $this->withHeaders($this->asDevice($this->device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(200);

    // Field names mirror packages/ruleset/src/schema.ts exactly — camelCase, so
    // the on-device engine consumes this without a translation layer.
    $response->assertJsonStructure([
        'versionLabel',
        'publishedAt',
        'bundle' => [
            'versionLabel',
            'symptomCodes' => [['code', 'displayName', 'needsClarification']],
            'lexiconTerms' => [['symptomCode', 'language', 'term', 'isNegation']],
            'severityThresholds' => [['key', 'label', 'value', 'tier', 'isOverride']],
            'clarificationQuestions' => [['questionKey', 'symptomCode', 'language', 'prompt', 'answerType', 'allowedAnswers']],
            'rules' => [['code', 'name', 'expression', 'conditions', 'outcomeTier', 'priority', 'isActive']],
            'healthTips',
        ],
    ]);

    expect($response->json('bundle.severityThresholds.0.isOverride'))->toBeTrue()
        ->and($response->json('bundle.clarificationQuestions.0.redFlagAnswer'))->toBe('severe');
});

/*
 * HEALTH_TIP is ruleset_version_id-scoped precisely so it ships with the
 * bundle. Until this change the contract had no healthTips field and the table
 * was stranded.
 */
it('ships health tips with the bundle, ordered by display_order', function () {
    $version = $this->makePublishedVersion();
    $code = $this->makeSymptomCode('fever_mild');

    HealthTip::create([
        'ruleset_version_id' => $version->getKey(),
        'symptom_code_id' => null,
        'outcome_tier' => 'home',
        'language' => 'ceb',
        'title' => 'Second tip',
        'body' => 'Inom ug tubig.',
        'display_order' => 2,
    ]);

    HealthTip::create([
        'ruleset_version_id' => $version->getKey(),
        'symptom_code_id' => $code->getKey(),
        'outcome_tier' => 'home',
        'language' => 'ceb',
        'title' => 'First tip',
        'body' => 'Pahulay.',
        'display_order' => 1,
    ]);

    $tips = $this->withHeaders($this->asDevice($this->device))
        ->getJson('/api/v1/ruleset/current')
        ->json('bundle.healthTips');

    expect($tips)->toHaveCount(2)
        ->and($tips[0]['title'])->toBe('First tip')
        ->and($tips[0]['symptomCode'])->toBe('fever_mild')
        // A tip general to a tier carries no symptomCode at all, rather than a
        // null one — the contract types it optional.
        ->and($tips[1])->not->toHaveKey('symptomCode');
});

it('assembles the same bundle every time, so a past result stays reconstructible', function () {
    $version = $this->makePublishedVersion();
    $code = $this->makeSymptomCode('fever_mild');
    $this->makeRule($version, 'R-002', 'rhu');
    $this->makeRule($version, 'R-001', 'home');
    $this->makeLexiconTerm($version, $code, 'hilanat');
    $this->makeLexiconTerm($version, $code, 'init');

    $first = $this->withHeaders($this->asDevice($this->device))->getJson('/api/v1/ruleset/current')->json('bundle');
    $second = $this->withHeaders($this->asDevice($this->device))->getJson('/api/v1/ruleset/current')->json('bundle');

    expect($first)->toBe($second);
});
