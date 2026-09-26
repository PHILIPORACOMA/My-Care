<?php

use App\Models\SyncBatch;
use Illuminate\Support\Str;
use Tests\Feature\Api\ApiTestHelpers;

uses(ApiTestHelpers::class);

/*
 * Device routes never get a session, whatever origin they come from.
 *
 * Found by the Phase 9 deploy-smoke job (BUILD-LOG 9b). On one host the
 * patient app shares its origin with the portal and console, and that origin
 * is in SANCTUM_STATEFUL_DOMAINS. While Sanctum's stateful middleware was
 * applied to all of /api (statefulApi()), a phone's upload was treated as a
 * staff browser request: it was given a session and checked for a CSRF token
 * it never has, and every sync answered 419. Anonymous phones were also being
 * handed a session cookie they had no use for.
 *
 * Laravel skips CSRF verification while running tests, so the 419 itself
 * cannot be reproduced here - deploy-smoke proves that end to end through
 * nginx. What these tests pin is the cause: no session middleware, so no
 * session or XSRF cookie, on any device route, even from a first-party origin.
 */

beforeEach(function () {
    // The production case: the patient app is served from the same host as
    // the staff apps, and the browser sends that origin on every request.
    config(['sanctum.stateful' => ['mycare.example.org']]);
    $this->firstParty = ['Origin' => 'https://mycare.example.org', 'Referer' => 'https://mycare.example.org/'];

    $this->barangay = $this->makeBarangay();
    $this->version = $this->makePublishedVersion();
    $this->makeSymptomCode('fever_mild');
    $this->makeRule($this->version, 'R-001');
});

function expectNoSession(\Illuminate\Testing\TestResponse $response): void
{
    $cookies = collect($response->headers->getCookies())->map->getName()->all();

    expect($cookies)->not->toContain('XSRF-TOKEN')
        ->and($cookies)->not->toContain(config('session.cookie'));
}

it('registers a device from a first-party origin without starting a session', function () {
    $response = $this->withHeaders($this->firstParty)
        ->postJson('/api/v1/devices', ['barangay_id' => $this->barangay->getKey(), 'type' => 'patient_phone']);

    $response->assertCreated();
    expectNoSession($response);
});

it('reads the barangay list from a first-party origin without starting a session', function () {
    $response = $this->withHeaders($this->firstParty)->getJson('/api/v1/barangays');

    $response->assertOk();
    expectNoSession($response);
});

it('uploads a batch from a first-party origin without starting a session', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);
    $uuid = (string) Str::uuid();

    $response = $this->withHeaders($this->firstParty + $this->asDevice($device))
        ->postJson('/api/v1/sync/batches', $this->payload(['client_batch_uuid' => $uuid]));

    $response->assertCreated();
    expectNoSession($response);
    expect(SyncBatch::where('client_batch_uuid', $uuid)->exists())->toBeTrue();
});

it('fetches the published ruleset from a first-party origin without starting a session', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);

    $response = $this->withHeaders($this->firstParty + $this->asDevice($device))->getJson('/api/v1/ruleset/current');

    $response->assertOk();
    expectNoSession($response);
});

it('still gives staff their session from the same origin', function () {
    // The other half of the change: staff routes keep Sanctum's cookie login.
    $response = $this->withHeaders($this->firstParty)->getJson('/api/v1/staff/me');

    $response->assertUnauthorized();
    $cookies = collect($response->headers->getCookies())->map->getName()->all();
    expect($cookies)->toContain('XSRF-TOKEN');
});
