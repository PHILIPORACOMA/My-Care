<?php

use App\Models\ClarificationAnswer;
use App\Models\SessionSymptom;
use App\Models\SyncBatch;
use App\Models\TriageSession;
use Illuminate\Support\Str;
use Tests\Feature\Api\ApiTestHelpers;

uses(ApiTestHelpers::class);

beforeEach(function () {
    $this->barangay = $this->makeBarangay();
    $this->device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);
    $this->version = $this->makePublishedVersion();
    $this->symptom = $this->makeSymptomCode('fever_mild');
    $this->makeRule($this->version, 'R-001');
});

it('stores a batch and returns 201', function () {
    $payload = $this->payload();

    $response = $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $payload);

    $response->assertStatus(201)
        ->assertJsonPath('client_batch_uuid', $payload['client_batch_uuid'])
        ->assertJsonPath('session_count', 1)
        ->assertJsonPath('duplicate', false);

    expect(TriageSession::count())->toBe(1)
        ->and(SessionSymptom::count())->toBe(1)
        ->and(SyncBatch::count())->toBe(1);
});

/*
 * UT-015. The load-bearing test of this endpoint: a device that cannot tell
 * whether its upload or merely its acknowledgement was lost must be able to
 * retry without corrupting surveillance data.
 */
it('returns 200 with the original result on a replay, never 409', function () {
    $payload = $this->payload();

    $first = $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $payload);
    $first->assertStatus(201);

    $second = $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $payload);

    $second->assertStatus(200)
        ->assertJsonPath('duplicate', true);

    // "The original result" means exactly that: same batch, same session count,
    // same stored sessions. Only the duplicate flag differs.
    expect($second->json('client_batch_uuid'))->toBe($first->json('client_batch_uuid'))
        ->and($second->json('session_count'))->toBe($first->json('session_count'))
        ->and($second->json('stored_session_uuids'))->toBe($first->json('stored_session_uuids'));

    expect($second->status())->not->toBe(409);
});

it('does not double-count sessions when a batch is replayed', function () {
    $payload = $this->payload();

    foreach (range(1, 4) as $ignored) {
        $this->withHeaders($this->asDevice($this->device))
            ->postJson('/api/v1/sync/batches', $payload);
    }

    expect(SyncBatch::count())->toBe(1)
        ->and(TriageSession::count())->toBe(1)
        ->and(SessionSymptom::count())->toBe(1);
});

it('counts a replay as a delivery attempt without changing the result', function () {
    $payload = $this->payload();

    $this->withHeaders($this->asDevice($this->device))->postJson('/api/v1/sync/batches', $payload);
    expect(SyncBatch::first()->attempt_count)->toBe(1);

    $replay = $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $payload);

    // attempt_count feeds the sync monitoring screen (UT-014) and is
    // deliberately absent from the response, so incrementing it cannot change
    // the answer a retry receives.
    expect(SyncBatch::first()->attempt_count)->toBe(2)
        ->and($replay->json('session_count'))->toBe(1);
});

it('keeps a session with its original batch rather than moving it', function () {
    $sessionUuid = (string) Str::uuid();

    $this->withHeaders($this->asDevice($this->device))->postJson(
        '/api/v1/sync/batches',
        $this->payload(sessionOverrides: ['client_session_uuid' => $sessionUuid]),
    );

    $firstBatchId = SyncBatch::first()->getKey();

    // The same session resent under a different batch uuid.
    $this->withHeaders($this->asDevice($this->device))->postJson(
        '/api/v1/sync/batches',
        $this->payload(sessionOverrides: ['client_session_uuid' => $sessionUuid]),
    )->assertStatus(201);

    expect(TriageSession::count())->toBe(1)
        ->and(TriageSession::first()->sync_batch_id)->toBe($firstBatchId);
});

it('links the session to its batch and stamps synced_at', function () {
    $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $this->payload());

    $session = TriageSession::first();

    expect($session->sync_batch_id)->toBe(SyncBatch::first()->getKey())
        ->and($session->synced_at)->not->toBeNull()
        ->and($session->device_id)->toBe($this->device->getKey());
});

it('updates the device last_sync_at', function () {
    expect($this->device->last_sync_at)->toBeNull();

    $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $this->payload());

    expect($this->device->fresh()->last_sync_at)->not->toBeNull();
});

it('accepts a session evaluated against an older, unpublished version', function () {
    // A handset offline for weeks still carries whatever ruleset it last
    // cached. Rejecting its sessions would discard real clinical encounters.
    $old = App\Models\RulesetVersion::create([
        'label' => 'v0-archived',
        'status' => 'archived',
        'published_at' => null,
        'published_by_id' => null,
    ]);
    $this->makeRule($old, 'R-OLD');

    $this->withHeaders($this->asDevice($this->device))->postJson(
        '/api/v1/sync/batches',
        $this->payload(sessionOverrides: [
            'ruleset_version_label' => 'v0-archived',
            'matched_rule_code' => 'R-OLD',
        ]),
    )->assertStatus(201);

    expect(TriageSession::first()->ruleset_version_id)->toBe($old->getKey());
});

it('rejects an unknown ruleset version rather than reassigning it', function () {
    // Silently attributing the session to the current version would break the
    // reconstruction claim in Figure 41.
    $this->withHeaders($this->asDevice($this->device))->postJson(
        '/api/v1/sync/batches',
        $this->payload(sessionOverrides: ['ruleset_version_label' => 'v99-nonexistent']),
    )->assertStatus(422);

    expect(TriageSession::count())->toBe(0);
});

it('rejects a rule code that does not belong to the stated version', function () {
    $this->withHeaders($this->asDevice($this->device))->postJson(
        '/api/v1/sync/batches',
        $this->payload(sessionOverrides: ['matched_rule_code' => 'R-NOPE']),
    )->assertStatus(422);
});

it('rejects an unknown symptom code', function () {
    $this->withHeaders($this->asDevice($this->device))->postJson(
        '/api/v1/sync/batches',
        $this->payload(sessionOverrides: [
            'symptoms' => [['symptom_code' => 'not_a_code', 'negated' => false, 'matched_term' => null]],
        ]),
    )->assertStatus(422);
});

it('requires completed_at, because only finished sessions are stored', function () {
    $session = $this->sessionPayload();
    unset($session['completed_at']);

    $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $this->payload(['sessions' => [$session]]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('sessions.0.completed_at');
});

it('writes the whole batch or none of it', function () {
    $good = $this->sessionPayload();
    // Rejected inside the transaction, not by request validation — which is
    // what makes this a rollback test rather than a 422 test.
    $bad = $this->sessionPayload([
        'symptoms' => [['symptom_code' => 'not_a_code', 'negated' => false, 'matched_term' => null]],
    ]);

    $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $this->payload(['sessions' => [$good, $bad]]))
        ->assertStatus(422);

    // The valid first session must not survive the invalid second one:
    // a half-written batch leaves session_count disagreeing with the rows.
    expect(TriageSession::count())->toBe(0)
        ->and(SyncBatch::count())->toBe(0);
});

it('stores a clarification answer against the right question', function () {
    $question = $this->makeQuestion($this->version, $this->symptom, 'chest_pain_severity');

    $this->withHeaders($this->asDevice($this->device))->postJson(
        '/api/v1/sync/batches',
        $this->payload(sessionOverrides: [
            'clarification_answers' => [
                ['question_key' => 'chest_pain_severity', 'answer' => 'severe', 'is_red_flag' => true],
            ],
        ]),
    )->assertStatus(201);

    $answer = ClarificationAnswer::first();

    expect($answer->clarification_question_id)->toBe($question->getKey())
        ->and($answer->is_red_flag)->toBeTrue();
});

/*
 * The hardest privacy rule in the project: raw symptom text never leaves the
 * device. The request schema has no field that can carry it, so a client that
 * started sending one would have it dropped rather than persisted.
 */
it('silently drops any free-text field a client tries to send', function () {
    $session = $this->sessionPayload();
    $session['symptom_text'] = 'naga hilanat ko sukad gahapon';
    $session['patient_name'] = 'should never be stored';

    $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $this->payload(['sessions' => [$session]]))
        ->assertStatus(201);

    $stored = TriageSession::first()->getAttributes();

    expect($stored)->not->toHaveKey('symptom_text')
        ->and($stored)->not->toHaveKey('patient_name');

    // And nothing resembling it reached any column of the row.
    expect(implode(' ', array_map(strval(...), array_filter($stored, is_scalar(...)))))
        ->not->toContain('hilanat ko sukad');
});

it('accepts an empty batch without inventing a session', function () {
    $this->withHeaders($this->asDevice($this->device))
        ->postJson('/api/v1/sync/batches', $this->payload(['sessions' => []]))
        ->assertStatus(201)
        ->assertJsonPath('session_count', 0);

    expect(TriageSession::count())->toBe(0);
});
