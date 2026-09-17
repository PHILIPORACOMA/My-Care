<?php

use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Device;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Feature\Api\ApiTestHelpers;
use Tests\Support\StaffHelpers;

uses(StaffHelpers::class, ApiTestHelpers::class);

beforeEach(function () {
    $this->staffRole('sub_admin');
    $this->valladolid = Barangay::create(['name' => 'Valladolid', 'city' => 'Carcar City', 'region' => 'Region VII']);
    $this->bolinawan = Barangay::create(['name' => 'Bolinawan', 'city' => 'Carcar City', 'region' => 'Region VII']);
    $this->admin = $this->superAdmin();
    $this->actingAsStaff($this->admin);
});

/*
 * UT-019: "Super-admin creates a new sub-admin account — Account is created and
 * correctly scoped to its assigned barangay."
 */
it('creates a sub-admin scoped to its assigned barangay (UT-019)', function () {
    $response = $this->postJson('/api/v1/console/users', [
        'email' => 'Nurse@RHU.example',
        'password' => 'long-enough-pass-1',
        'barangayId' => $this->valladolid->id,
    ])->assertStatus(201)
        ->assertJsonPath('user.role', 'sub_admin')
        ->assertJsonPath('user.barangayName', 'Valladolid')
        ->assertJsonPath('user.status', 'active')
        ->assertJsonPath('user.email', 'nurse@rhu.example');

    $user = User::findOrFail($response->json('user.id'));

    expect(Hash::check('long-enough-pass-1', $user->password_hash))->toBeTrue()
        ->and($response->json('user.createdAt'))->not->toBeNull()
        ->and($response->getContent())->not->toContain('password');

    // And the scope actually holds when that account signs in.
    $this->flushHeaders()->withHeaders(['Origin' => 'http://localhost']);
    auth('web')->logout();
    RateLimiter::clear('nurse@rhu.example|127.0.0.1');

    $this->postJson('/api/v1/staff/login', ['email' => 'nurse@rhu.example', 'password' => 'long-enough-pass-1'])
        ->assertStatus(200)
        ->assertJsonPath('user.barangayId', $this->valladolid->id);
});

it('rejects a weak password, a duplicate email, or a missing barangay', function (array $payload, string $field) {
    User::create([
        'email' => 'taken@rhu.example', 'password_hash' => 'x', 'role_id' => $this->staffRole('sub_admin')->id,
        'barangay_id' => $this->valladolid->id,
    ]);

    $this->postJson('/api/v1/console/users', $payload)->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'short password' => [['email' => 'a@rhu.example', 'password' => 'short1', 'barangayId' => 1], 'password'],
    'duplicate email' => [['email' => 'taken@rhu.example', 'password' => 'long-enough-pass-1', 'barangayId' => 1], 'email'],
    'no barangay' => [['email' => 'b@rhu.example', 'password' => 'long-enough-pass-1'], 'barangayId'],
]);

it('is super-admin only', function () {
    $this->flushHeaders()->actingAsStaff($this->subAdmin($this->valladolid));

    $this->getJson('/api/v1/console/users')->assertStatus(403);
    $this->postJson('/api/v1/console/users', [])->assertStatus(403);
});

/*
 * Figure 38: "lets the team deactivate access instantly". USER has no status
 * column; deactivation makes password_hash unmatchable (AccountManager).
 */
it('deactivates an account so it can no longer sign in', function () {
    $nurse = $this->subAdmin($this->valladolid);

    $this->postJson("/api/v1/console/users/{$nurse->id}/deactivate")
        ->assertStatus(200)->assertJsonPath('user.status', 'deactivated');

    $this->flushHeaders()->withHeaders(['Origin' => 'http://localhost']);
    auth('web')->logout();

    $this->postJson('/api/v1/staff/login', ['email' => 'nurse@example.test', 'password' => 'correct-horse'])
        ->assertStatus(422);

    $entry = AuditLog::where('target_table', 'users')->where('target_id', $nurse->id)
        ->where('action_type', 'updated')->latest('id')->firstOrFail();

    expect($entry->old_value)->toBe(['password_hash' => '[redacted]']);
});

it('ends the deactivated account\'s existing session on its next request', function () {
    $nurse = $this->subAdmin($this->valladolid);

    // The nurse signs in with a real session.
    $this->flushHeaders()->withHeaders(['Origin' => 'http://localhost']);
    auth('web')->logout();
    $this->postJson('/api/v1/staff/login', ['email' => 'nurse@example.test', 'password' => 'correct-horse'])->assertStatus(200);
    $this->getJson('/api/v1/staff/me')->assertStatus(200);

    // Meanwhile a super-admin deactivates the account.
    app(\App\Domain\Accounts\AccountManager::class)->deactivate($nurse->fresh(), $this->admin);

    // Sanctum's AuthenticateSession sees the password hash changed. Clear the
    // guard's in-memory user first: the test harness reuses one container,
    // whereas a real browser request always starts fresh.
    auth('web')->forgetUser();

    $this->getJson('/api/v1/staff/me')->assertStatus(401);
});

it('reactivates an account by setting a new password', function () {
    $nurse = $this->subAdmin($this->valladolid);
    $this->postJson("/api/v1/console/users/{$nurse->id}/deactivate")->assertStatus(200);

    $this->putJson("/api/v1/console/users/{$nurse->id}/password", ['password' => 'a-brand-new-pass-2'])
        ->assertStatus(200)->assertJsonPath('user.status', 'active');

    expect(Hash::check('a-brand-new-pass-2', $nurse->fresh()->password_hash))->toBeTrue();
});

it('refuses to let a super-admin deactivate themselves', function () {
    $this->postJson("/api/v1/console/users/{$this->admin->id}/deactivate")->assertStatus(409);
});

it('reassigns a sub-admin to another barangay, and only a sub-admin', function () {
    $nurse = $this->subAdmin($this->valladolid);

    $this->putJson("/api/v1/console/users/{$nurse->id}/barangay", ['barangayId' => $this->bolinawan->id])
        ->assertStatus(200)->assertJsonPath('user.barangayName', 'Bolinawan');

    $this->putJson("/api/v1/console/users/{$this->admin->id}/barangay", ['barangayId' => $this->bolinawan->id])
        ->assertStatus(409);
});

it('creates the first super-admin from the command line with a prompted password', function () {
    $this->artisan('mycare:staff:create-super-admin', ['email' => 'lead@mycare.example'])
        ->expectsQuestion('Password (at least 12 characters, letters and numbers)', 'dev-team-pass-99')
        ->expectsQuestion('Repeat the password', 'dev-team-pass-99')
        ->assertSuccessful();

    expect(User::where('email', 'lead@mycare.example')->firstOrFail()->role->name)->toBe('super_admin');
});

it('lists and revokes devices, audited', function () {
    $device = $this->makeDevice(['barangay_id' => $this->valladolid->id]);

    $this->getJson('/api/v1/console/devices')
        ->assertStatus(200)
        ->assertJsonPath('devices.0.label', 'BHW handset')
        ->assertJsonMissingPath('devices.0.api_token');

    $this->postJson("/api/v1/console/devices/{$device->id}/revoke")->assertStatus(200);

    expect(Device::find($device->id)->is_approved)->toBeFalse()
        ->and(AuditLog::where('target_table', 'devices')->where('target_id', $device->id)
            ->where('action_type', 'updated')->exists())->toBeTrue();

    $this->flushHeaders()->withHeaders($this->asDevice($device))
        ->getJson('/api/v1/ruleset/current')->assertStatus(403);
});
