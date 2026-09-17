<?php

use App\Domain\Ruleset\RulesetStatus;
use App\Models\AuditLog;
use App\Models\RuleCondition;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use App\Models\TriageRule;
use Tests\Feature\Api\ApiTestHelpers;
use Tests\Support\StaffHelpers;

uses(StaffHelpers::class, ApiTestHelpers::class);

/*
 * Fixture content only. These symptom codes, terms and questions are test
 * scaffolding, not clinical content — the real v1 presentations live in
 * packages/ruleset and still await clinician review.
 */
function fixtureContent(array $overrides = []): array
{
    return array_merge([
        'lexiconTerms' => [
            ['symptomCode' => 'code_a', 'language' => 'ceb', 'term' => 'fixture term a', 'isNegation' => false],
        ],
        'severityThresholds' => [],
        'clarificationQuestions' => [],
        'rules' => [[
            'code' => 'R-001',
            'name' => 'Fixture rule',
            'conditions' => [['symptomCode' => 'code_a', 'operator' => 'AND']],
            'outcomeTier' => 'rhu',
            'priority' => 1,
            'isActive' => true,
        ]],
        'healthTips' => [],
    ], $overrides);
}

beforeEach(function () {
    SymptomCode::create(['code' => 'code_a', 'display_name' => 'Fixture A', 'needs_clarification' => false]);
    SymptomCode::create(['code' => 'code_b', 'display_name' => 'Fixture B', 'needs_clarification' => true]);
    $this->admin = $this->superAdmin();
    $this->actingAsStaff($this->admin);
});

function draftWith(array $content): RulesetVersion
{
    $response = test()->postJson('/api/v1/console/ruleset-versions')->assertStatus(201);
    $empty = RulesetVersion::findOrFail($response->json('version.id'));

    $saved = test()->putJson("/api/v1/console/ruleset-versions/{$empty->id}/content", ['content' => $content])
        ->assertStatus(201);

    return RulesetVersion::findOrFail($saved->json('version.id'));
}

function publishVersion(RulesetVersion $version): void
{
    test()->postJson("/api/v1/console/ruleset-versions/{$version->id}/submit")->assertStatus(200);
    test()->postJson("/api/v1/console/ruleset-versions/{$version->id}/publish", ['clinicalReviewConfirmed' => true])
        ->assertStatus(200);
}

it('is super-admin only', function () {
    $barangay = $this->makeBarangay();
    $this->actingAsStaff($this->subAdmin($barangay));

    $this->getJson('/api/v1/console/ruleset-versions')->assertStatus(403);
});

/*
 * UT-007: "Super-admin creates a new rule — Rule is saved as a new draft
 * version and is not yet live."
 */
it('saves a new rule as a draft version that is not live (UT-007)', function () {
    $device = $this->makeDevice();

    $draft = draftWith(fixtureContent());

    expect($draft->status)->toBe(RulesetStatus::DRAFT)
        ->and(TriageRule::where('ruleset_version_id', $draft->id)->value('code'))->toBe('R-001');

    $this->flushHeaders()
        ->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(503);
});

/*
 * UT-008: "Super-admin adds a synonym to an existing symptom term — Change is
 * saved under a pending lexicon version."
 */
it('saves an added synonym under a new pending version (UT-008)', function () {
    $v1 = draftWith(fixtureContent());
    publishVersion($v1);

    $draft = RulesetVersion::findOrFail(
        $this->postJson('/api/v1/console/ruleset-versions', ['baseVersionId' => $v1->id])->json('version.id')
    );

    $content = $this->getJson("/api/v1/console/ruleset-versions/{$draft->id}")->json('content');
    $content['lexiconTerms'][] = ['symptomCode' => 'code_a', 'language' => 'tl', 'term' => 'fixture synonym', 'isNegation' => false];

    $saved = RulesetVersion::findOrFail(
        $this->putJson("/api/v1/console/ruleset-versions/{$draft->id}/content", ['content' => $content])->json('version.id')
    );

    expect($saved->status)->toBe(RulesetStatus::DRAFT)
        ->and($saved->lexiconTerms()->count())->toBe(2)
        ->and($v1->fresh()->lexiconTerms()->count())->toBe(1)
        ->and($v1->fresh()->status)->toBe(RulesetStatus::PUBLISHED);
});

/*
 * UT-009's authoring half: a red-flag override threshold can be configured,
 * and it reaches the device bundle intact. The engine half — that it forces the
 * tier — is tested in packages/triage-engine.
 */
it('saves and publishes a red-flag override threshold (UT-009)', function () {
    $device = $this->makeDevice();

    $draft = draftWith(fixtureContent([
        'severityThresholds' => [[
            'key' => 'fixture_score', 'label' => 'Fixture override', 'value' => '8',
            'tier' => 'emergency', 'isOverride' => true,
        ]],
        'rules' => [[
            'code' => 'R-001', 'name' => 'Attribute rule', 'outcomeTier' => 'rhu', 'priority' => 1, 'isActive' => true,
            'conditions' => [
                ['symptomCode' => 'code_a', 'operator' => 'AND'],
                ['attribute' => 'fixture_score', 'comparator' => '>=', 'severityThresholdKey' => 'fixture_score', 'operator' => 'AND'],
            ],
        ]],
    ]));
    publishVersion($draft);

    $bundle = $this->flushHeaders()->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')->assertStatus(200)->json('bundle');

    expect($bundle['severityThresholds'][0])->toMatchArray(['key' => 'fixture_score', 'tier' => 'emergency', 'isOverride' => true])
        ->and($bundle['rules'][0]['expression'])->toBe('IF code_a AND fixture_score >= fixture_score THEN rhu');
});

/*
 * UT-010: "Draft rule set is edited multiple times before publishing — Each save
 * creates a new version; prior versions remain retrievable."
 */
it('creates a new version on every save and keeps the old ones (UT-010)', function () {
    $first = draftWith(fixtureContent());

    $second = RulesetVersion::findOrFail($this->putJson("/api/v1/console/ruleset-versions/{$first->id}/content", [
        'content' => fixtureContent(['rules' => [array_merge(fixtureContent()['rules'][0], ['name' => 'Renamed once'])]]),
    ])->assertStatus(201)->json('version.id'));

    $third = RulesetVersion::findOrFail($this->putJson("/api/v1/console/ruleset-versions/{$second->id}/content", [
        'content' => fixtureContent(['rules' => [array_merge(fixtureContent()['rules'][0], ['name' => 'Renamed twice'])]]),
    ])->assertStatus(201)->json('version.id'));

    expect([$first->fresh()->status, $second->fresh()->status, $third->status])
        ->toBe([RulesetStatus::SUPERSEDED, RulesetStatus::SUPERSEDED, RulesetStatus::DRAFT]);

    $this->getJson("/api/v1/console/ruleset-versions/{$first->id}")
        ->assertStatus(200)->assertJsonPath('content.rules.0.name', 'Fixture rule');
    $this->getJson("/api/v1/console/ruleset-versions/{$second->id}")
        ->assertStatus(200)->assertJsonPath('content.rules.0.name', 'Renamed once');

    // A superseded draft cannot be saved over again.
    $this->putJson("/api/v1/console/ruleset-versions/{$first->id}/content", ['content' => fixtureContent()])
        ->assertStatus(409);
});

/*
 * UT-011: "Super-admin publishes a rule version — Devices receive the updated
 * rule set on next sync; rollback restores the prior version."
 */
it('publishes to devices and rolls back to the prior version (UT-011)', function () {
    $device = $this->makeDevice();

    $v1 = draftWith(fixtureContent());
    publishVersion($v1);

    $v2 = draftWith(fixtureContent(['rules' => [array_merge(fixtureContent()['rules'][0], ['outcomeTier' => 'emergency'])]]));
    publishVersion($v2);

    $this->flushHeaders()->withHeaders($this->asDevice($device));
    $this->getJson('/api/v1/ruleset/current')
        ->assertJsonPath('versionLabel', $v2->label)
        ->assertJsonPath('bundle.rules.0.outcomeTier', 'emergency');

    expect($v1->fresh()->status)->toBe(RulesetStatus::RETIRED)
        ->and(RulesetVersion::where('status', RulesetStatus::PUBLISHED)->count())->toBe(1);

    $this->flushHeaders()->actingAsStaff($this->admin);
    $restored = $this->postJson("/api/v1/console/ruleset-versions/{$v1->id}/rollback")
        ->assertStatus(201)->json('version');

    expect($restored['status'])->toBe(RulesetStatus::PUBLISHED)
        ->and($v2->fresh()->status)->toBe(RulesetStatus::RETIRED)
        ->and(AuditLog::where('action_type', 'rollback')->value('old_value'))->toBe(['restored_from' => $v1->label]);

    $this->flushHeaders()->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')
        ->assertJsonPath('versionLabel', $restored['label'])
        ->assertJsonPath('bundle.rules.0.outcomeTier', 'rhu');
});

it('refuses to publish without clinical review attestation or from a draft', function () {
    $draft = draftWith(fixtureContent());

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/publish", ['clinicalReviewConfirmed' => true])
        ->assertStatus(409);

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/submit")->assertStatus(200);

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/publish", ['clinicalReviewConfirmed' => false])
        ->assertStatus(409);

    expect($draft->fresh()->status)->toBe(RulesetStatus::IN_REVIEW);
});

it('returns a version from review to draft', function () {
    $draft = draftWith(fixtureContent());
    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/submit")->assertStatus(200);

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/return-to-draft")
        ->assertStatus(200)->assertJsonPath('version.status', RulesetStatus::DRAFT);
});

it('refuses to submit a version with no active rule', function () {
    $draft = draftWith(fixtureContent(['rules' => []]));

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/submit")
        ->assertStatus(422)->assertJsonValidationErrors('rules');
});

/*
 * RULE_CONDITION has no sequence column; the primary key is the order. Saving
 * a reordered rule must produce conditions in the new order.
 */
it('preserves condition order exactly as authored, including a reorder', function () {
    $conditions = [
        ['symptomCode' => 'code_a', 'operator' => 'AND'],
        ['symptomCode' => 'code_b', 'operator' => 'NOT'],
    ];
    $rule = array_merge(fixtureContent()['rules'][0], ['conditions' => $conditions]);
    $draft = draftWith(fixtureContent(['rules' => [$rule]]));

    $reordered = RulesetVersion::findOrFail($this->putJson("/api/v1/console/ruleset-versions/{$draft->id}/content", [
        'content' => fixtureContent(['rules' => [array_merge($rule, ['conditions' => array_reverse($conditions)])]]),
    ])->json('version.id'));

    $codes = fn (RulesetVersion $v) => RuleCondition::whereIn('triage_rule_id', $v->rules()->pluck('id'))
        ->orderBy('id')->with('symptomCode')->get()->pluck('symptomCode.code')->all();

    expect($codes($draft))->toBe(['code_a', 'code_b'])
        ->and($codes($reordered))->toBe(['code_b', 'code_a'])
        // Each condition keeps its own operator when moved. The engine negates a
        // leading NOT (triage-engine ruleMatches), and the expression says so.
        ->and($reordered->rules()->value('expression'))->toBe('IF NOT code_b AND code_a THEN rhu');
});

it('rejects content that would silently mis-triage', function (array $content, string $errorField) {
    $empty = RulesetVersion::findOrFail($this->postJson('/api/v1/console/ruleset-versions')->json('version.id'));

    $this->putJson("/api/v1/console/ruleset-versions/{$empty->id}/content", ['content' => $content])
        ->assertStatus(422)
        ->assertJsonValidationErrors($errorField);
})->with([
    'unknown symptom code' => [fixtureContent(['rules' => [[
        'code' => 'R-001', 'name' => 'x', 'outcomeTier' => 'rhu', 'priority' => 1, 'isActive' => true,
        'conditions' => [['symptomCode' => 'nope', 'operator' => 'AND']],
    ]]]), 'rules.0.conditions.0.symptomCode'],
    'condition testing both symptom and attribute' => [fixtureContent(['rules' => [[
        'code' => 'R-001', 'name' => 'x', 'outcomeTier' => 'rhu', 'priority' => 1, 'isActive' => true,
        'conditions' => [['symptomCode' => 'code_a', 'attribute' => 'a', 'comparator' => '>', 'severityThresholdKey' => 'k', 'operator' => 'AND']],
    ]]]), 'rules.0.conditions.0'],
    'red flag not among allowed answers' => [fixtureContent(['clarificationQuestions' => [[
        'questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'en', 'prompt' => 'p',
        'answerType' => 'single_select', 'allowedAnswers' => ['a', 'b'], 'redFlagAnswer' => 'c',
    ]]]), 'clarificationQuestions.0.redFlagAnswer'],
    'language variants disagree on red-flag position' => [fixtureContent(['clarificationQuestions' => [
        ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'en', 'prompt' => 'p',
            'answerType' => 'single_select', 'allowedAnswers' => ['a', 'b'], 'redFlagAnswer' => 'b'],
        ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'ceb', 'prompt' => 'p',
            'answerType' => 'single_select', 'allowedAnswers' => ['x', 'y'], 'redFlagAnswer' => 'x'],
    ]]), 'clarificationQuestions.0.questionKey'],
    'non-numeric threshold value' => [fixtureContent(['severityThresholds' => [[
        'key' => 'k', 'label' => 'l', 'value' => 'high', 'tier' => 'rhu', 'isOverride' => false,
    ]]]), 'severityThresholds.0.value'],
    'duplicate lexicon term ignoring case' => [fixtureContent(['lexiconTerms' => [
        ['symptomCode' => 'code_a', 'language' => 'ceb', 'term' => 'Same', 'isNegation' => false],
        ['symptomCode' => 'code_b', 'language' => 'ceb', 'term' => 'same', 'isNegation' => false],
    ]]), 'lexiconTerms.1.term'],
]);

it('imports a whole bundle as a draft, creating symptom codes', function () {
    $bundle = ['versionLabel' => 'ignored', 'symptomCodes' => [
        ['code' => 'code_a', 'displayName' => 'Fixture A', 'needsClarification' => false],
        ['code' => 'code_new', 'displayName' => 'Fixture New', 'needsClarification' => false],
    ]] + fixtureContent();

    $version = $this->postJson('/api/v1/console/ruleset-versions/import', ['bundle' => $bundle])
        ->assertStatus(201)->json('version');

    expect($version['status'])->toBe(RulesetStatus::DRAFT)
        ->and(SymptomCode::where('code', 'code_new')->exists())->toBeTrue();
});

it('refuses an import that would overwrite an existing symptom code', function () {
    $bundle = ['symptomCodes' => [['code' => 'code_a', 'displayName' => 'Changed', 'needsClarification' => false]]] + fixtureContent();

    $this->postJson('/api/v1/console/ruleset-versions/import', ['bundle' => $bundle])->assertStatus(422);

    expect(SymptomCode::where('code', 'code_a')->value('display_name'))->toBe('Fixture A');
});

it('locks a symptom code once a frozen version uses it', function () {
    $this->patchJson('/api/v1/console/symptom-codes/code_a', ['displayName' => 'Editable while unused'])
        ->assertStatus(200);

    publishVersion(draftWith(fixtureContent()));

    $this->patchJson('/api/v1/console/symptom-codes/code_a', ['displayName' => 'Too late'])->assertStatus(409);
    $this->getJson('/api/v1/console/symptom-codes')->assertJsonPath('symptomCodes.0.locked', true);

    $this->postJson('/api/v1/console/symptom-codes', [
        'code' => 'code_c', 'displayName' => 'New code', 'needsClarification' => false,
    ])->assertStatus(201);
});

it('audits version saves with provenance but not every content row', function () {
    $first = draftWith(fixtureContent());

    expect(AuditLog::where('action_type', 'draft_saved')->where('target_id', $first->id)->exists())->toBeTrue()
        ->and(AuditLog::where('target_table', 'lexicon_terms')->count())->toBe(0)
        ->and(AuditLog::where('target_table', 'ruleset_versions')->where('action_type', 'created')->count())->toBe(2);
});

it('imports the exported v1 bundle file through the artisan command', function () {
    $path = base_path('../../packages/ruleset/dist/v1.json');

    if (! is_readable($path)) {
        $this->markTestSkipped('Run `npm run export:v1 -w @mycare/ruleset` first.');
    }

    $this->artisan('mycare:ruleset:import', ['file' => $path])->assertSuccessful();

    $version = RulesetVersion::latest('id')->firstOrFail();

    expect($version->status)->toBe(RulesetStatus::DRAFT)
        ->and($version->rules()->count())->toBe(23)
        ->and($version->rules()->where('outcome_tier', 'emergency')->count())->toBe(9);
});
