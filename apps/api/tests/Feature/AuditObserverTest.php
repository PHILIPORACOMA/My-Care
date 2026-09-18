<?php

use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Device;
use App\Models\Role;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use App\Models\TriageSession;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/*
 * Figure 41: every privileged change is stamped with the responsible actor and
 * a timestamp. These tests pin what is audited and — just as importantly — what
 * is not.
 */

it('records a creation with a null old_value', function () {
    $version = RulesetVersion::create([
        'label' => 'v1-draft', 'status' => 'draft',
        'published_at' => null, 'published_by_id' => null,
    ]);

    $entry = AuditLog::where('target_table', 'ruleset_versions')->first();

    expect($entry)->not->toBeNull()
        ->and($entry->action_type)->toBe('created')
        ->and($entry->target_id)->toBe($version->getKey())
        ->and($entry->old_value)->toBeNull()
        ->and($entry->created_at)->not->toBeNull();
});

it('records the prior state of only the columns that changed', function () {
    $version = RulesetVersion::create([
        'label' => 'v1-draft', 'status' => 'draft',
        'published_at' => null, 'published_by_id' => null,
    ]);

    $version->update(['status' => 'published', 'published_at' => CarbonImmutable::parse('2026-09-06T00:00:00Z')]);

    $entry = AuditLog::where('action_type', 'updated')->first();

    // A diff, not a full row dump: the entry answers "what did this used to
    // be", which is what old_value is for.
    expect($entry->old_value)->toHaveKey('status')
        ->and($entry->old_value['status'])->toBe('draft')
        ->and($entry->old_value)->not->toHaveKey('label');
});

it('attributes a change to the acting user', function () {
    $role = Role::create(['name' => 'super_admin', 'label' => 'Super Admin', 'description' => 'Full access']);
    $user = User::create([
        'email' => 'admin@example.test', 'password_hash' => 'secret',
        'email_verified_at' => null, 'role_id' => $role->getKey(), 'barangay_id' => null,
    ]);

    $this->actingAs($user);

    SymptomCode::create(['code' => 'fever_mild', 'display_name' => 'Fever', 'needs_clarification' => false]);

    $entry = AuditLog::where('target_table', 'symptom_codes')->first();

    expect($entry->actor_id)->toBe($user->getKey())
        ->and($entry->actor_label)->toBe('admin@example.test');
});

it('never writes a secret into the audit trail', function () {
    $role = Role::create(['name' => 'sub_admin', 'label' => 'Sub Admin', 'description' => 'Scoped']);
    $user = User::create([
        'email' => 'nurse@example.test', 'password_hash' => 'original-secret',
        'email_verified_at' => null, 'role_id' => $role->getKey(), 'barangay_id' => null,
    ]);

    $user->update(['password_hash' => 'rotated-secret']);

    $entry = AuditLog::where('target_table', 'users')->where('action_type', 'updated')->first();

    // More staff can read the audit log than can read the users table; a
    // password digest in old_value would turn it into a credential store.
    expect($entry->old_value['password_hash'])->toBe('[redacted]');
    expect(AuditLog::all()->toJson())->not->toContain('original-secret');
});

/*
 * The audit log is a record of privileged decisions, not a second copy of the
 * patient data stream. Sessions arrive by the thousand from devices; auditing
 * them would drown the entries Figure 41 exists to show.
 */
it('does not audit synced patient data', function () {
    $barangay = Barangay::create(['name' => 'Can-asujan', 'city' => 'Carcar City', 'region' => 'Region VII']);
    $version = RulesetVersion::create([
        'label' => 'v1-draft', 'status' => 'published',
        'published_at' => CarbonImmutable::now('UTC'), 'published_by_id' => null,
    ]);

    $before = AuditLog::count();

    TriageSession::create([
        'client_session_uuid' => (string) Str::uuid(),
        'barangay_id' => $barangay->getKey(), 'device_id' => null,
        'ruleset_version_id' => $version->getKey(), 'matched_rule_id' => null,
        'sync_batch_id' => null, 'language' => 'ceb',
        'started_at' => CarbonImmutable::now('UTC'),
        'completed_at' => CarbonImmutable::now('UTC'),
        'synced_at' => null,
    ]);

    expect(AuditLog::count())->toBe($before);
});

/*
 * A device heartbeat is not a decision by a person. Without this, every sync
 * would append an audit entry and the screen would be unreadable.
 */
it('does not audit a device sync heartbeat', function () {
    $barangay = Barangay::create(['name' => 'Guadalupe', 'city' => 'Carcar City', 'region' => 'Region VII']);
    $device = Device::create([
        'barangay_id' => $barangay->getKey(), 'type' => 'shared', 'label' => 'handset',
        'api_token' => Str::random(80), 'status' => 'active', 'is_approved' => true,
        'registered_at' => CarbonImmutable::now('UTC'), 'last_sync_at' => null,
    ]);

    $after = AuditLog::count();

    $device->update(['last_sync_at' => CarbonImmutable::now('UTC')]);

    expect(AuditLog::count())->toBe($after);
});

it('still audits a meaningful device change', function () {
    $barangay = Barangay::create(['name' => 'Bolinawan', 'city' => 'Carcar City', 'region' => 'Region VII']);
    $device = Device::create([
        'barangay_id' => $barangay->getKey(), 'type' => 'shared', 'label' => 'handset',
        'api_token' => Str::random(80), 'status' => 'active', 'is_approved' => false,
        'registered_at' => CarbonImmutable::now('UTC'), 'last_sync_at' => null,
    ]);

    $before = AuditLog::where('action_type', 'updated')->count();

    // Approving a device is exactly the kind of privileged act Figure 41 is for.
    $device->update(['is_approved' => true]);

    expect(AuditLog::where('action_type', 'updated')->count())->toBe($before + 1);
});
