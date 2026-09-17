<?php

use Tests\Feature\Api\ApiTestHelpers;

uses(ApiTestHelpers::class);

beforeEach(function () {
    $this->barangay = $this->makeBarangay();
    $this->version = $this->makePublishedVersion();
});

it('rejects a request carrying no device token', function () {
    $this->getJson('/api/v1/ruleset/current')->assertStatus(401);
});

it('rejects an unrecognised device token', function () {
    $this->withHeaders(['Authorization' => 'Bearer '.str_repeat('x', 80)])
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(401);
});

/*
 * DEVICE.is_approved exists so an enrolled-but-unvetted handset cannot push
 * into the surveillance record before a super-admin has looked at it. If this
 * check ever regresses, enrolment stops being a gate.
 */
it('rejects an enrolled device that has not been approved', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey(), 'is_approved' => false]);

    $this->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(403);
});

it('rejects a device that is not active', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey(), 'status' => 'revoked']);

    $this->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(403);
});

it('admits an approved, active device', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);

    $this->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(200);
});

it('never echoes the device token back in a response', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);

    $response = $this->withHeaders($this->asDevice($device))->getJson('/api/v1/ruleset/current');

    expect($response->getContent())
        ->not->toContain($this->plainTokenFor($device))
        ->not->toContain($device->api_token);
});

/*
 * DEVICE.api_token stores a lookup prefix and a SHA-256 digest, never the
 * secret. A leaked database backup must not be a working key to every handset.
 */
it('stores only a digest of the device secret', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);
    $plain = $this->plainTokenFor($device);
    [$prefix, $secret] = explode('.', $plain, 2);

    expect($device->fresh()->api_token)
        ->not->toContain($secret)
        ->toBe($prefix.'.'.hash('sha256', $secret))
        ->and(strlen($device->api_token))->toBeLessThanOrEqual(80);
});

it('rejects the stored digest presented as if it were the token', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);

    $this->withHeaders(['Authorization' => 'Bearer '.$device->fresh()->api_token])
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(401);
});

it('rejects a token whose prefix matches but whose secret does not', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);
    [$prefix] = explode('.', $this->plainTokenFor($device), 2);

    $this->withHeaders(['Authorization' => "Bearer {$prefix}.".str_repeat('x', 48)])
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(401);
});

it('does not treat LIKE wildcards in a presented prefix as a match', function () {
    $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);

    $this->withHeaders(['Authorization' => 'Bearer %%%%%%%%%%%%.'.str_repeat('x', 48)])
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(401);
});
