<?php

use App\Models\AuditLog;
use App\Models\Facility;
use Tests\Feature\Api\ApiTestHelpers;
use Tests\Support\SessionFixtures;
use Tests\Support\StaffHelpers;

/*
 * The emergency numbers behind "Call for help" (Figure 27, ADR-0005): the
 * super-admin edits them in the console when an RHU reports a change; RHU
 * staff see them read-only in the portal. Fixture numbers are placeholders,
 * not real contact details.
 */

uses(StaffHelpers::class, SessionFixtures::class, ApiTestHelpers::class);

beforeEach(function () {
    $this->barangay = $this->fixtureBarangay();
    $this->other = $this->fixtureBarangay('Guadalupe');
    $this->admin = $this->superAdmin();

    $this->rhu = Facility::create(['barangay_id' => $this->barangay->id, 'name' => 'Valladolid RHU', 'type' => 'rhu',
        'contact_number' => '0900 000 0001', 'is_active' => true]);
    $this->hotline = Facility::create(['barangay_id' => null, 'name' => 'City Hotline', 'type' => 'emergency_hotline',
        'contact_number' => '0900 000 0002', 'is_active' => true]);
    $this->elsewhere = Facility::create(['barangay_id' => $this->other->id, 'name' => 'Guadalupe RHU', 'type' => 'rhu',
        'contact_number' => '0900 000 0003', 'is_active' => true]);
    $this->retired = Facility::create(['barangay_id' => $this->barangay->id, 'name' => 'Old Station', 'type' => 'health_station',
        'contact_number' => '0900 000 0004', 'is_active' => false]);
});

it('lists every facility for the super-admin, inactive ones included', function () {
    $this->actingAsStaff($this->admin);

    $response = $this->getJson('/api/v1/console/facilities')->assertStatus(200)->json();

    expect(collect($response['facilities'])->pluck('name')->all())
        ->toContain('Valladolid RHU', 'City Hotline', 'Guadalupe RHU', 'Old Station')
        ->and(collect($response['facilities'])->firstWhere('name', 'Valladolid RHU')['barangayName'])->toBe('Valladolid')
        ->and($response['suggestedTypes'])->toContain('emergency_hotline', 'rhu');
});

it('changes a number, and the audit log keeps the number it replaced', function () {
    $this->actingAsStaff($this->admin);

    $this->patchJson("/api/v1/console/facilities/{$this->rhu->id}", ['contactNumber' => '(032) 000-0099'])
        ->assertStatus(200)
        ->assertJsonPath('facility.contactNumber', '(032) 000-0099');

    expect($this->rhu->fresh()->contact_number)->toBe('(032) 000-0099');

    $entry = AuditLog::where('target_table', 'facilities')->where('target_id', $this->rhu->id)
        ->where('action_type', 'updated')->latest('id')->firstOrFail();
    expect($entry->actor_id)->toBe($this->admin->id)
        ->and(json_encode($entry->old_value))->toContain('0900 000 0001');
});

it('the new number is what a phone downloads next, and a deactivated one is gone', function () {
    $this->actingAsStaff($this->admin);
    $this->patchJson("/api/v1/console/facilities/{$this->hotline->id}", ['contactNumber' => '0900 000 0042'])->assertStatus(200);
    $this->patchJson("/api/v1/console/facilities/{$this->rhu->id}", ['isActive' => false])->assertStatus(200);

    $device = $this->makeDevice(['barangay_id' => $this->barangay->id]);
    $downloaded = collect($this->flushSession()->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/facilities')->assertStatus(200)->json('facilities'))->keyBy('name');

    expect($downloaded['City Hotline']['contactNumber'])->toBe('0900 000 0042')
        ->and($downloaded->has('Valladolid RHU'))->toBeFalse();
});

it('adds a facility, active, and audits it', function () {
    $this->actingAsStaff($this->admin);

    $created = $this->postJson('/api/v1/console/facilities', [
        'name' => 'Guadalupe Hotline', 'type' => 'emergency_hotline', 'barangayId' => $this->other->id,
        'contactNumber' => '+63 900 000 0005', 'operatingHours' => '24/7',
    ])->assertStatus(201)->json('facility');

    expect($created['isActive'])->toBeTrue()
        ->and($created['barangayName'])->toBe('Guadalupe')
        ->and(AuditLog::where('target_table', 'facilities')->where('target_id', $created['id'])->where('action_type', 'created')->exists())->toBeTrue();
});

it('deactivates and reactivates rather than deleting', function () {
    $this->actingAsStaff($this->admin);

    $this->patchJson("/api/v1/console/facilities/{$this->rhu->id}", ['isActive' => false])->assertJsonPath('facility.isActive', false);
    $this->patchJson("/api/v1/console/facilities/{$this->rhu->id}", ['isActive' => true])->assertJsonPath('facility.isActive', true);

    expect($this->deleteJson("/api/v1/console/facilities/{$this->rhu->id}")->status())->toBeIn([404, 405])
        ->and(Facility::whereKey($this->rhu->id)->exists())->toBeTrue();
});

it('refuses a number that cannot be dialled', function (string $number) {
    $this->actingAsStaff($this->admin);

    $this->patchJson("/api/v1/console/facilities/{$this->rhu->id}", ['contactNumber' => $number])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['contactNumber']);

    expect($this->rhu->fresh()->contact_number)->toBe('0900 000 0001');
})->with([
    'letters' => ['call the RHU'],
    'too few digits' => ['12'],
    'blank' => [''],
    'plus in the middle' => ['0900+000'],
    'over 30 characters' => [str_repeat('1', 31)],
]);

it('refuses an unknown barangay and a duplicate name in the same barangay', function () {
    $this->actingAsStaff($this->admin);

    $this->postJson('/api/v1/console/facilities', ['name' => 'X', 'type' => 'rhu', 'contactNumber' => '911', 'barangayId' => 999999])
        ->assertStatus(422)->assertJsonValidationErrors(['barangayId']);

    $this->postJson('/api/v1/console/facilities', ['name' => 'Valladolid RHU', 'type' => 'rhu', 'contactNumber' => '911', 'barangayId' => $this->barangay->id])
        ->assertStatus(422)->assertJsonValidationErrors(['name']);

    // The same name in another barangay is a different facility.
    $this->postJson('/api/v1/console/facilities', ['name' => 'Valladolid RHU', 'type' => 'rhu', 'contactNumber' => '911', 'barangayId' => $this->other->id])
        ->assertStatus(201);
});

it('does not let a sub-admin change numbers', function () {
    $this->actingAsStaff($this->subAdmin($this->barangay));

    $this->getJson('/api/v1/console/facilities')->assertStatus(403);
    $this->patchJson("/api/v1/console/facilities/{$this->rhu->id}", ['contactNumber' => '911'])->assertStatus(403);

    expect($this->rhu->fresh()->contact_number)->toBe('0900 000 0001');
});

it('shows a sub-admin their own barangay and the city-wide numbers, read-only (UT-016)', function () {
    $this->actingAsStaff($this->subAdmin($this->barangay));

    $names = collect($this->getJson('/api/v1/staff/facilities')->assertStatus(200)->json('facilities'))->pluck('name');

    expect($names->all())->toContain('Valladolid RHU', 'City Hotline')
        ->not->toContain('Guadalupe RHU')  // another barangay
        ->not->toContain('Old Station');   // inactive: phones never get it

    $this->postJson('/api/v1/staff/facilities', [])->assertStatus(405);
});

it('shows a super-admin every active number in the portal', function () {
    $this->actingAsStaff($this->admin);

    $names = collect($this->getJson('/api/v1/staff/facilities')->json('facilities'))->pluck('name');

    expect($names->all())->toContain('Valladolid RHU', 'City Hotline', 'Guadalupe RHU')->not->toContain('Old Station');
});
