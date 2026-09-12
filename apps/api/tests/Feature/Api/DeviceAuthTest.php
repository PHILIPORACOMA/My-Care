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

    expect($response->getContent())->not->toContain($device->api_token);
});
