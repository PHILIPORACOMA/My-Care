<?php

use App\Domain\Audit\Recorder;
use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Role;
use App\Models\User;

function makeUser(string $email = 'staff@example.test'): User
{
    $role = Role::create([
        'name' => 'super_admin',
        'label' => 'Super Admin',
        'description' => 'Development team.',
    ]);

    $barangay = Barangay::create([
        'name' => 'Guadalupe', 'city' => 'Carcar City', 'region' => 'Region VII',
    ]);

    return User::create([
        'email' => $email,
        'password_hash' => 'secret-value',
        'role_id' => $role->id,
        'barangay_id' => $barangay->id,
    ]);
}

it('records a privileged action against the acting user', function () {
    $user = makeUser();

    // Creating that Role, Barangay and User is itself auditable now that
    // AuditableObserver is registered (UT-019 requires account creation to
    // leave a trail), so the fixtures above have already written entries. This
    // test is about what one Recorder call produces, so it measures the delta
    // rather than the global count it originally asserted.
    $before = AuditLog::count();

    $entry = (new Recorder)->record(
        actionType: 'publish',
        targetTable: 'ruleset_versions',
        targetId: 7,
        oldValue: ['status' => 'draft'],
        actor: $user,
    );

    expect($entry->actor_id)->toBe($user->id)
        ->and($entry->actor_label)->toBe('staff@example.test')
        ->and($entry->action_type)->toBe('publish')
        ->and($entry->target_table)->toBe('ruleset_versions')
        ->and($entry->target_id)->toBe(7)
        ->and($entry->old_value)->toBe(['status' => 'draft'])
        ->and(AuditLog::count())->toBe($before + 1);
});

it('attributes a system-initiated action to "system" with a null actor', function () {
    // actor_id is nullable; actor_label never is. An unattributed entry still
    // names a responsible party.
    $entry = (new Recorder)->record('sync', 'sync_batches', 3);

    expect($entry->actor_id)->toBeNull()
        ->and($entry->actor_label)->toBe('system');
});

it('stamps created_at in UTC', function () {
    // Devices may be offline for weeks. A drifting audit timestamp is the one
    // that can never be reconstructed after the fact.
    $entry = (new Recorder)->record('export', 'reports', 1);

    expect($entry->created_at)->not->toBeNull()
        ->and($entry->created_at->timezone->getName())->toBe('UTC')
        ->and($entry->created_at->diffInMinutes(now('UTC')))->toBeLessThan(1);
});

it('falls back to the authenticated user when no actor is passed', function () {
    $user = makeUser('authed@example.test');

    $this->actingAs($user);

    $entry = (new Recorder)->record('update', 'users', $user->id);

    expect($entry->actor_id)->toBe($user->id)
        ->and($entry->actor_label)->toBe('authed@example.test');
});

it('rejects an over-length action_type rather than truncating it', function () {
    // These are programmer-supplied constants. Silently trimming one would
    // corrupt the trail instead of surfacing the mistake.
    (new Recorder)->record(str_repeat('x', 21), 'users', 1);
})->throws(InvalidArgumentException::class);

it('records a null old_value for a creation', function () {
    $entry = (new Recorder)->record('create', 'barangays', 2);

    expect($entry->old_value)->toBeNull();
});
