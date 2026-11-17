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
/** A role, as the console asks for when a reviewer has not agreed to be named. Test scaffolding. */
const FIXTURE_REVIEWER = 'Fixture reviewer (test)';

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
    test()->postJson("/api/v1/console/ruleset-versions/{$version->id}/publish", ['clinicalReviewConfirmed' => true, 'reviewedBy' => FIXTURE_REVIEWER])
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

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/publish", ['clinicalReviewConfirmed' => true, 'reviewedBy' => FIXTURE_REVIEWER])
        ->assertStatus(409);

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/submit")->assertStatus(200);

    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/publish", ['clinicalReviewConfirmed' => false, 'reviewedBy' => FIXTURE_REVIEWER])
        ->assertStatus(409);

    expect($draft->fresh()->status)->toBe(RulesetStatus::IN_REVIEW);
});

/*
 * Who reviewed and approved a version is entered at publish and shown in the
 * console. RULESET_VERSION has no column for it, so it lives in one audit
 * entry, written once (ADR-0006).
 */
it('requires who reviewed and approved a version, records it once, and shows it', function () {
    $draft = draftWith(fixtureContent());
    $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/submit")->assertStatus(200);
    $publish = fn (array $body) => $this->postJson("/api/v1/console/ruleset-versions/{$draft->id}/publish", $body);

    $publish(['clinicalReviewConfirmed' => true])->assertStatus(422)->assertJsonValidationErrors('reviewedBy');
    $publish(['clinicalReviewConfirmed' => true, 'reviewedBy' => str_repeat('x', 101)])->assertStatus(422);
    // Spaces alone are no reviewer.
    $publish(['clinicalReviewConfirmed' => true, 'reviewedBy' => '   '])->assertStatus(422)->assertJsonValidationErrors('reviewedBy');
    expect($draft->fresh()->status)->toBe(RulesetStatus::IN_REVIEW);

    $publish(['clinicalReviewConfirmed' => true, 'reviewedBy' => '  '.FIXTURE_REVIEWER.' '])
        ->assertStatus(200)
        ->assertJsonPath('version.reviewedBy', FIXTURE_REVIEWER);

    $entry = AuditLog::where('action_type', 'clinical_review')->sole();
    expect($entry->target_id)->toBe($draft->id)
        ->and($entry->old_value)->toBe(['reviewed_by' => FIXTURE_REVIEWER])
        ->and($entry->actor_id)->toBe($this->admin->id);

    $this->getJson("/api/v1/console/ruleset-versions/{$draft->id}")->assertJsonPath('version.reviewedBy', FIXTURE_REVIEWER);
    $listed = collect($this->getJson('/api/v1/console/ruleset-versions')->json('versions'))->keyBy('id');
    expect($listed[$draft->id]['reviewedBy'])->toBe(FIXTURE_REVIEWER);

    // A version never published has no reviewer.
    $other = draftWith(fixtureContent());
    expect($listed->has($other->id) ? $listed[$other->id]['reviewedBy'] : null)->toBeNull();
    $this->getJson("/api/v1/console/ruleset-versions/{$other->id}")->assertJsonPath('version.reviewedBy', null);
});

it('keeps the original reviewer on a rolled-back copy, and says where it came from', function () {
    $v1 = draftWith(fixtureContent());
    publishVersion($v1);
    publishVersion(draftWith(fixtureContent(['rules' => [array_merge(fixtureContent()['rules'][0], ['outcomeTier' => 'emergency'])]])));

    $restored = $this->postJson("/api/v1/console/ruleset-versions/{$v1->id}/rollback")->assertStatus(201)->json('version');

    expect($restored['reviewedBy'])->toBe(FIXTURE_REVIEWER)
        ->and(AuditLog::where('action_type', 'clinical_review')->where('target_id', $restored['id'])->value('old_value'))
        ->toBe(['reviewed_by' => FIXTURE_REVIEWER, 'carried_from' => $v1->label]);
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
    // The engine fires an override when the answer is >= its value: text never is.
    'text value on an override threshold' => [fixtureContent(['severityThresholds' => [[
        'key' => 'k', 'label' => 'l', 'value' => 'high', 'tier' => 'emergency', 'isOverride' => true,
    ]]]), 'severityThresholds.0.value'],
    // An ordering comparator against text never holds (ADR-0001).
    'text threshold compared with >=' => [fixtureContent([
        'severityThresholds' => [['key' => 'k', 'label' => 'l', 'value' => 'high', 'tier' => 'rhu', 'isOverride' => false]],
        'rules' => [[
            'code' => 'R-001', 'name' => 'x', 'outcomeTier' => 'rhu', 'priority' => 1, 'isActive' => true,
            'conditions' => [
                ['symptomCode' => 'code_a', 'operator' => 'AND'],
                ['attribute' => 'q', 'comparator' => '>=', 'severityThresholdKey' => 'k', 'operator' => 'AND'],
            ],
        ]],
    ]), 'rules.0.conditions.1.comparator'],
    // The phone sends the English answer, which CLARIFICATION_ANSWER holds in 50.
    'submitted answer over 50 characters' => [fixtureContent(['clarificationQuestions' => [
        ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'ceb', 'prompt' => 'p',
            'answerType' => 'single_select', 'allowedAnswers' => ['a', 'b']],
        ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'en', 'prompt' => 'p',
            'answerType' => 'single_select', 'allowedAnswers' => ['a', str_repeat('b', 51)]],
    ]]), 'clarificationQuestions.1.allowedAnswers'],
    'answer over 100 characters' => [fixtureContent(['clarificationQuestions' => [
        ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'en', 'prompt' => 'p',
            'answerType' => 'single_select', 'allowedAnswers' => ['a', 'b']],
        ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'ceb', 'prompt' => 'p',
            'answerType' => 'single_select', 'allowedAnswers' => ['a', str_repeat('b', 101)]],
    ]]), 'clarificationQuestions.1.allowedAnswers.1'],
    'duplicate lexicon term ignoring case' => [fixtureContent(['lexiconTerms' => [
        ['symptomCode' => 'code_a', 'language' => 'ceb', 'term' => 'Same', 'isNegation' => false],
        ['symptomCode' => 'code_b', 'language' => 'ceb', 'term' => 'same', 'isNegation' => false],
    ]]), 'lexiconTerms.1.term'],
]);

it('accepts a text threshold compared with = or !=, and a long answer that is not the one submitted', function () {
    draftWith(fixtureContent([
        'severityThresholds' => [['key' => 'q_home', 'label' => 'l', 'value' => '1 to 2 days', 'tier' => 'rhu', 'isOverride' => false]],
        'clarificationQuestions' => [
            ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'en', 'prompt' => 'p',
                'answerType' => 'single_select', 'allowedAnswers' => ['1 to 2 days', '3 days or more']],
            ['questionKey' => 'q', 'symptomCode' => 'code_b', 'language' => 'ceb', 'prompt' => 'p',
                'answerType' => 'single_select', 'allowedAnswers' => ['a', str_repeat('b', 100)]],
        ],
        'rules' => [[
            'code' => 'R-001', 'name' => 'x', 'outcomeTier' => 'rhu', 'priority' => 1, 'isActive' => true,
            'conditions' => [
                ['symptomCode' => 'code_b', 'operator' => 'AND'],
                ['attribute' => 'q', 'comparator' => '!=', 'severityThresholdKey' => 'q_home', 'operator' => 'AND'],
            ],
        ]],
    ]));

    expect(\App\Models\SeverityThreshold::where('key', 'q_home')->value('value'))->toBe('1 to 2 days');
});

it('lets a frozen symptom code start asking a follow-up, but never stop', function () {
    publishVersion(draftWith(fixtureContent()));

    // code_a is frozen. Switching its follow-up on changes nothing a frozen version does.
    $this->patchJson('/api/v1/console/symptom-codes/code_a', ['needsClarification' => true])->assertStatus(200);
    expect(SymptomCode::where('code', 'code_a')->value('needs_clarification'))->toBeTrue()
        ->and(AuditLog::where('target_table', 'symptom_codes')->where('action_type', 'updated')->count())->toBe(1);

    // Off again would silence a frozen version's questions; a rename is still refused.
    $this->patchJson('/api/v1/console/symptom-codes/code_a', ['needsClarification' => false])->assertStatus(409);
    $this->patchJson('/api/v1/console/symptom-codes/code_a', ['displayName' => 'Too late', 'needsClarification' => true])
        ->assertStatus(409);
});

it('keeps a frozen code\'s follow-up off when a frozen version already holds a question for it', function () {
    SymptomCode::create(['code' => 'code_c', 'display_name' => 'Fixture C', 'needs_clarification' => false]);
    publishVersion(draftWith(fixtureContent(['clarificationQuestions' => [[
        'questionKey' => 'q', 'symptomCode' => 'code_c', 'language' => 'en', 'prompt' => 'p',
        'answerType' => 'single_select', 'allowedAnswers' => ['a', 'b'],
    ]]])));

    // The published version would start asking "q" for code_c.
    $this->patchJson('/api/v1/console/symptom-codes/code_c', ['needsClarification' => true])->assertStatus(409);
});

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

it('imports the exported v2 bundle (v1 + Lexicon Appraisal Batch 2 + the follow-up questions) as a draft', function () {
    $path = base_path('../../packages/ruleset/dist/v2.json');

    if (! is_readable($path)) {
        $this->markTestSkipped('Run `npm run export:v2 -w @mycare/ruleset` first.');
    }

    $this->artisan('mycare:ruleset:import', ['file' => $path])->assertSuccessful();

    $version = RulesetVersion::latest('id')->firstOrFail();

    expect($version->status)->toBe(RulesetStatus::DRAFT)
        // 23 (v1) + 26 (the form's Part D) + 1 (chest pain, added after the form)
        // + 6 rhu rules for the Part C follow-up answers (R-051..R-056).
        ->and($version->rules()->count())->toBe(56)
        ->and($version->rules()->where('outcome_tier', 'home')->count())->toBe(14)
        ->and($version->rules()->where('outcome_tier', 'rhu')->count())->toBe(27)
        ->and($version->rules()->where('outcome_tier', 'emergency')->count())->toBe(15)
        // The rules' home answers, as text thresholds that never override.
        ->and($version->severityThresholds()->count())->toBe(6)
        ->and($version->severityThresholds()->where('is_override', true)->count())->toBe(0)
        // 2 "Is the pain severe?" + 7 Part C questions, each in en, tl and ceb;
        // 6 of the 9 have an Emergency answer.
        ->and($version->clarificationQuestions()->count())->toBe(27)
        ->and($version->clarificationQuestions()->whereNotNull('red_flag_answer')->count())->toBe(18)
        // Three home tips each for stomach and chest pain, and the animal-bite rhu tip, in each language.
        ->and($version->healthTips()->where('outcome_tier', 'home')->count())->toBe(18)
        ->and($version->healthTips()->where('outcome_tier', 'rhu')->count())->toBe(3)
        ->and(SymptomCode::where('needs_clarification', true)->count())->toBe(9); // 8 in v2, plus this file's code_b
});

/*
 * The real order of events: v1 was imported and published first, so its codes
 * are frozen with needs_clarification off. v2 switches it on for the six codes
 * that now ask a Part C follow-up, and the switch is audited.
 */
it('imports v2 over a published v1, switching on the six follow-up codes', function () {
    $v1 = base_path('../../packages/ruleset/dist/v1.json');
    $v2 = base_path('../../packages/ruleset/dist/v2.json');

    if (! is_readable($v1) || ! is_readable($v2)) {
        $this->markTestSkipped('Run `npm run export:v1` and `npm run export:v2 -w @mycare/ruleset` first.');
    }

    $this->artisan('mycare:ruleset:import', ['file' => $v1])->assertSuccessful();
    publishVersion(RulesetVersion::latest('id')->firstOrFail());
    expect(SymptomCode::where('code', 'fever_mild')->value('needs_clarification'))->toBeFalse();

    $this->artisan('mycare:ruleset:import', ['file' => $v2])->assertSuccessful();

    $switched = ['cold_cough_no_sob', 'diarrhea_mild_no_dehydration', 'fever_mild', 'headache_mild_moderate',
        'minor_wound_no_infection', 'spotting_first_trimester_mild'];
    $audited = AuditLog::where('target_table', 'symptom_codes')->where('action_type', 'updated')->pluck('target_id');

    expect(SymptomCode::whereIn('code', $switched)->where('needs_clarification', true)->count())->toBe(6)
        ->and($audited->sort()->values()->all())
        ->toBe(SymptomCode::whereIn('code', $switched)->orderBy('id')->pluck('id')->all());
});

/*
 * ADR-0006 (amended): a draft that never went to review can be deleted. Anything
 * that was in review, published, retired or saved over is history and stays.
 */
it('deletes a draft that never went to review, and the audit log records what it held', function () {
    $draft = draftWith(fixtureContent());

    $this->deleteJson("/api/v1/console/ruleset-versions/{$draft->id}")
        ->assertStatus(200)
        ->assertJsonPath('deleted.label', $draft->label);

    expect(RulesetVersion::whereKey($draft->id)->exists())->toBeFalse()
        ->and(TriageRule::where('ruleset_version_id', $draft->id)->exists())->toBeFalse();

    $listed = collect($this->getJson('/api/v1/console/ruleset-versions')->json('versions'))->pluck('id');
    expect($listed->all())->not->toContain($draft->id);

    $entry = AuditLog::where('target_table', 'ruleset_versions')->where('target_id', $draft->id)
        ->where('action_type', 'draft_deleted')->firstOrFail();
    expect($entry->actor_id)->toBe($this->admin->id)
        ->and($entry->old_value['label'])->toBe($draft->label)
        ->and($entry->old_value['held']['rules'])->toBe(1)
        ->and($entry->old_value['held']['lexiconTerms'])->toBe(1);
});

it('records which version a deleted draft was copied from', function () {
    $v1 = draftWith(fixtureContent());
    publishVersion($v1);

    $copy = RulesetVersion::findOrFail(
        $this->postJson('/api/v1/console/ruleset-versions', ['baseVersionId' => $v1->id])->assertStatus(201)->json('version.id')
    );
    $this->deleteJson("/api/v1/console/ruleset-versions/{$copy->id}")->assertStatus(200);

    $entry = AuditLog::where('target_id', $copy->id)->where('action_type', 'draft_deleted')->firstOrFail();
    expect($entry->old_value['based_on'])->toBe($v1->label);
});

it('keeps every version that was in review, published, retired or saved over', function () {
    $first = draftWith(fixtureContent());
    $savedOver = RulesetVersion::where('status', RulesetStatus::SUPERSEDED)->firstOrFail();

    $this->postJson("/api/v1/console/ruleset-versions/{$first->id}/submit")->assertStatus(200);
    $inReview = $first->id;
    $published = $first->id;
    $retired = null;

    $try = function (int $id) {
        $this->deleteJson("/api/v1/console/ruleset-versions/{$id}")->assertStatus(409);
        expect(RulesetVersion::whereKey($id)->exists())->toBeTrue();
    };

    $try($savedOver->id);
    $try($inReview);

    $this->postJson("/api/v1/console/ruleset-versions/{$first->id}/publish", ['clinicalReviewConfirmed' => true, 'reviewedBy' => FIXTURE_REVIEWER])->assertStatus(200);
    $try($published);

    publishVersion(draftWith(fixtureContent(['lexiconTerms' => [
        ['symptomCode' => 'code_a', 'language' => 'ceb', 'term' => 'fixture term b', 'isNegation' => false],
    ]])));
    $retired = RulesetVersion::findOrFail($first->id);
    expect($retired->status)->toBe(RulesetStatus::RETIRED);
    $try($retired->id);

    // The rows that version holds are untouched.
    expect(TriageRule::where('ruleset_version_id', $first->id)->count())->toBe(1);
});

it('never hands out a deleted draft\'s label again', function () {
    $draft = draftWith(fixtureContent());
    $label = $draft->label;
    $number = (int) substr($label, 1);

    $this->deleteJson("/api/v1/console/ruleset-versions/{$draft->id}")->assertStatus(200);

    $next = $this->postJson('/api/v1/console/ruleset-versions')->assertStatus(201)->json('version.label');
    expect($next)->toBe('v'.($number + 1))->not->toBe($label);
});

it('does not let a sub-admin delete a draft', function () {
    $draft = draftWith(fixtureContent());

    $this->actingAsStaff($this->subAdmin($this->makeBarangay()));
    $this->deleteJson("/api/v1/console/ruleset-versions/{$draft->id}")->assertStatus(403);

    expect(RulesetVersion::whereKey($draft->id)->exists())->toBeTrue();
});
