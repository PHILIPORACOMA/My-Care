<?php

use App\Domain\Device\PendingQueueReport;
use App\Models\AuditLog;
use App\Models\Device;
use App\Models\Facility;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Feature\Api\ApiTestHelpers;

uses(ApiTestHelpers::class);

beforeEach(function () {
    $this->barangay = $this->makeBarangay();
    $this->version = $this->makePublishedVersion();
    RateLimiter::clear('device-registration');
});

/*
 * ADR-0005: a PWA registers itself the first time it is online, anonymously,
 * and is approved at once so patient phones actually sync.
 */
it('registers a device anonymously and returns a working token once', function () {
    $response = $this->postJson('/api/v1/devices', [
        'barangay_id' => $this->barangay->getKey(),
        'type' => 'patient_phone',
    ])->assertStatus(201)
        ->assertJsonPath('device.type', 'patient_phone')
        ->assertJsonPath('device.barangayId', $this->barangay->getKey());

    $token = $response->json('token');
    $device = Device::findOrFail($response->json('device.id'));

    expect($device->is_approved)->toBeTrue()
        ->and($device->status)->toBe('active')
        ->and($device->api_token)->not->toBe($token);

    $this->withHeaders(['Authorization' => "Bearer {$token}"])
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(200);
});

it('accepts no identifying field and stores none', function () {
    $response = $this->postJson('/api/v1/devices', [
        'barangay_id' => $this->barangay->getKey(),
        'type' => 'patient_phone',
        'phone_number' => '09171234567',
        'owner_name' => 'Juan dela Cruz',
        'latitude' => 10.1,
    ])->assertStatus(201);

    $row = Device::findOrFail($response->json('device.id'))->getAttributes();

    expect(json_encode($row))
        ->not->toContain('09171234567')
        ->not->toContain('Juan')
        ->not->toContain('10.1');
});

it('rejects an unknown barangay or device type', function () {
    $this->postJson('/api/v1/devices', ['barangay_id' => 999999, 'type' => 'patient_phone'])
        ->assertStatus(422)->assertJsonValidationErrors('barangay_id');

    $this->postJson('/api/v1/devices', ['barangay_id' => $this->barangay->getKey(), 'type' => 'laptop'])
        ->assertStatus(422)->assertJsonValidationErrors('type');
});

it('rate-limits registration per IP', function () {
    foreach (range(1, 10) as $ignored) {
        $this->postJson('/api/v1/devices', [
            'barangay_id' => $this->barangay->getKey(), 'type' => 'patient_phone',
        ])->assertStatus(201);
    }

    $this->postJson('/api/v1/devices', [
        'barangay_id' => $this->barangay->getKey(), 'type' => 'patient_phone',
    ])->assertStatus(429);
});

it('audits a registration without attributing it to anyone', function () {
    $response = $this->postJson('/api/v1/devices', [
        'barangay_id' => $this->barangay->getKey(), 'type' => 'health_station',
    ])->assertStatus(201);

    $entry = AuditLog::where('target_table', 'devices')
        ->where('target_id', $response->json('device.id'))
        ->where('action_type', 'created')
        ->firstOrFail();

    expect($entry->actor_id)->toBeNull()->and($entry->actor_label)->toBe('system');
});

it('lets a revoked device no longer authenticate', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);
    $device->update(['is_approved' => false]);

    $this->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(403);
});

it('lists barangays publicly for onboarding (UT-001)', function () {
    $this->makeBarangay('Bolinawan');

    $this->getJson('/api/v1/barangays')
        ->assertStatus(200)
        ->assertJsonPath('barangays.0.name', 'Bolinawan')
        ->assertJsonPath('barangays.1.name', 'Valladolid');
});

it('serves active facilities to a device for Call for help', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);

    Facility::create([
        'barangay_id' => null, 'name' => 'City Health Office', 'type' => 'rhu',
        'address' => null, 'contact_number' => '(032) 000-0000', 'operating_hours' => '8-5',
        'is_active' => true,
    ]);
    Facility::create([
        'barangay_id' => null, 'name' => 'Closed clinic', 'type' => 'rhu',
        'address' => null, 'contact_number' => null, 'operating_hours' => null,
        'is_active' => false,
    ]);

    $this->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/facilities')
        ->assertStatus(200)
        ->assertJsonCount(1, 'facilities')
        ->assertJsonPath('facilities.0.contactNumber', '(032) 000-0000');

    // withHeaders() persists for the rest of the test; clear it so this call
    // genuinely carries no token.
    $this->flushHeaders()->getJson('/api/v1/facilities')->assertStatus(401);
});

it('records the pending-queue size a device reports', function () {
    $device = $this->makeDevice(['barangay_id' => $this->barangay->getKey()]);

    $this->withHeaders($this->asDevice($device) + [PendingQueueReport::HEADER => '7'])
        ->getJson('/api/v1/ruleset/current')
        ->assertStatus(200);

    expect(PendingQueueReport::forDevice($device->getKey()))->toBe(7);

    $this->withHeaders($this->asDevice($device) + [PendingQueueReport::HEADER => 'lots'])
        ->getJson('/api/v1/ruleset/current');

    expect(PendingQueueReport::forDevice($device->getKey()))->toBe(7);
});
