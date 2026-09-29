<?php

use App\Models\AuditLog;
use App\Models\Device;
use Tests\Feature\Api\ApiTestHelpers;
use Tests\Support\StaffHelpers;

uses(ApiTestHelpers::class, StaffHelpers::class);

/*
 * PATCH /api/v1/devices/current: a patient changed barangay in Settings, and
 * the device moves with them, so Sync & status (Figure 33, UT-014) counts it
 * where it now reports rather than where it first registered.
 */

beforeEach(function () {
    $this->valladolid = $this->makeBarangay('Valladolid');
    $this->bolinawan = $this->makeBarangay('Bolinawan');
    $this->device = $this->makeDevice(['barangay_id' => $this->valladolid->getKey()]);
});

it('moves the device to the barangay it names', function () {
    $this->withHeaders($this->asDevice($this->device))
        ->patchJson('/api/v1/devices/current', ['barangay_id' => $this->bolinawan->getKey()])
        ->assertStatus(200)
        ->assertJsonPath('device.id', $this->device->getKey())
        ->assertJsonPath('device.barangayId', $this->bolinawan->getKey());

    expect($this->device->fresh()->barangay_id)->toBe($this->bolinawan->getKey());
});

it('needs a device token', function () {
    $this->patchJson('/api/v1/devices/current', ['barangay_id' => $this->bolinawan->getKey()])
        ->assertStatus(401);

    expect($this->device->fresh()->barangay_id)->toBe($this->valladolid->getKey());
});

it('moves only the device whose token it presents', function () {
    $other = $this->makeDevice(['barangay_id' => $this->valladolid->getKey()]);

    $this->withHeaders($this->asDevice($this->device))
        ->patchJson('/api/v1/devices/current', ['barangay_id' => $this->bolinawan->getKey()])
        ->assertStatus(200);

    expect($other->fresh()->barangay_id)->toBe($this->valladolid->getKey());
});

it('refuses a revoked device', function () {
    $this->device->update(['is_approved' => false]);

    $this->withHeaders($this->asDevice($this->device))
        ->patchJson('/api/v1/devices/current', ['barangay_id' => $this->bolinawan->getKey()])
        ->assertStatus(403);

    expect($this->device->fresh()->barangay_id)->toBe($this->valladolid->getKey());
});

it('refuses a barangay that does not exist', function () {
    $this->withHeaders($this->asDevice($this->device))
        ->patchJson('/api/v1/devices/current', ['barangay_id' => 999999])
        ->assertStatus(422)
        ->assertJsonValidationErrors('barangay_id');
});

it('changes nothing but the barangay, whatever else is sent', function () {
    $before = $this->device->fresh()->only(['type', 'label', 'api_token', 'status', 'is_approved']);

    $this->withHeaders($this->asDevice($this->device))
        ->patchJson('/api/v1/devices/current', [
            'barangay_id' => $this->bolinawan->getKey(),
            'type' => 'health_station',
            'label' => 'renamed',
            'status' => 'revoked',
            'is_approved' => false,
        ])
        ->assertStatus(200);

    expect($this->device->fresh()->only(['type', 'label', 'api_token', 'status', 'is_approved']))->toBe($before);
});

it('audits the move once, with the old barangay and no actor', function () {
    $move = fn () => $this->withHeaders($this->asDevice($this->device))
        ->patchJson('/api/v1/devices/current', ['barangay_id' => $this->bolinawan->getKey()])
        ->assertStatus(200);

    $move();
    // A retry after a dropped response: same answer, no second entry.
    $move();

    $entries = AuditLog::where('target_table', 'devices')
        ->where('target_id', $this->device->getKey())
        ->where('action_type', 'updated')
        ->get();

    expect($entries)->toHaveCount(1)
        ->and($entries[0]->actor_id)->toBeNull()
        ->and($entries[0]->old_value)->toBe(['barangay_id' => $this->valladolid->getKey()]);
});

/*
 * The reason for the endpoint (UT-014, UT-016): each barangay's Sync & status
 * counts the devices that report for it now.
 */
it('moves the device between the two barangays\' Sync & status screens (UT-014)', function () {
    $devicesSeenBy = function ($barangay, string $email): int {
        $this->actingAsStaff($this->subAdmin($barangay, $email));

        return $this->getJson('/api/v1/staff/sync-status')->assertStatus(200)->json('devices.total');
    };

    expect($devicesSeenBy($this->valladolid, 'v1@example.test'))->toBe(1)
        ->and($devicesSeenBy($this->bolinawan, 'b1@example.test'))->toBe(0);

    $this->app['auth']->forgetGuards();
    $this->withHeaders($this->asDevice($this->device))
        ->patchJson('/api/v1/devices/current', ['barangay_id' => $this->bolinawan->getKey()])
        ->assertStatus(200);

    expect($devicesSeenBy($this->valladolid, 'v2@example.test'))->toBe(0)
        ->and($devicesSeenBy($this->bolinawan, 'b2@example.test'))->toBe(1);
});
