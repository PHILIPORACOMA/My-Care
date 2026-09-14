<?php

use App\Domain\Auth\BarangayScope;
use App\Models\Barangay;
use App\Models\Role;
use App\Models\TriageSession;
use App\Models\RulesetVersion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/*
 * UT-016: a sub-admin scoped to Barangay X sees only Barangay X.
 */

function scopeRole(string $name): Role
{
    return Role::firstOrCreate(['name' => $name], [
        'label' => $name, 'description' => $name,
    ]);
}

function scopeUser(string $role, ?Barangay $barangay): User
{
    return User::create([
        'email' => $role.'-'.Str::random(6).'@example.test',
        'password_hash' => 'secret',
        'email_verified_at' => null,
        'role_id' => scopeRole($role)->getKey(),
        'barangay_id' => $barangay?->getKey(),
    ]);
}

function sessionIn(Barangay $barangay, RulesetVersion $version): TriageSession
{
    return TriageSession::create([
        'client_session_uuid' => (string) Str::uuid(),
        'barangay_id' => $barangay->getKey(),
        'device_id' => null,
        'ruleset_version_id' => $version->getKey(),
        'matched_rule_id' => null,
        'sync_batch_id' => null,
        'language' => 'ceb',
        'started_at' => CarbonImmutable::now('UTC'),
        'completed_at' => CarbonImmutable::now('UTC'),
        'synced_at' => null,
    ]);
}

beforeEach(function () {
    $this->mine = Barangay::create(['name' => 'Valladolid', 'city' => 'Carcar City', 'region' => 'Region VII']);
    $this->theirs = Barangay::create(['name' => 'Can-asujan', 'city' => 'Carcar City', 'region' => 'Region VII']);
    $this->version = RulesetVersion::create([
        'label' => 'v1', 'status' => 'published',
        'published_at' => CarbonImmutable::now('UTC'), 'published_by_id' => null,
    ]);

    sessionIn($this->mine, $this->version);
    sessionIn($this->mine, $this->version);
    sessionIn($this->theirs, $this->version);
});

it('limits a sub-admin to their own barangay', function () {
    $user = scopeUser('sub_admin', $this->mine);

    $rows = BarangayScope::apply(TriageSession::query(), $user)->get();

    expect($rows)->toHaveCount(2)
        ->and($rows->pluck('barangay_id')->unique()->all())->toBe([$this->mine->getKey()]);
});

it('does not limit a super-admin', function () {
    $user = scopeUser('super_admin', null);

    expect(BarangayScope::apply(TriageSession::query(), $user)->count())->toBe(3)
        ->and(BarangayScope::isUnscoped($user))->toBeTrue()
        ->and(BarangayScope::visibleBarangayIds($user))->toBeNull();
});

/*
 * A sub-admin with no barangay assigned is a misconfigured account. It must
 * fail closed — seeing nothing — rather than falling through to seeing
 * everything, which is what a null check written the other way around would do.
 */
it('shows a barangay-less sub-admin nothing, not everything', function () {
    $user = scopeUser('sub_admin', null);

    expect(BarangayScope::apply(TriageSession::query(), $user)->count())->toBe(0)
        ->and(BarangayScope::visibleBarangayIds($user))->toBe([]);
});

it('scopes a differently-named barangay column', function () {
    $user = scopeUser('sub_admin', $this->mine);

    // Aggregates and reports carry barangay_id too, but a caller may be
    // querying a joined or aliased table.
    $query = BarangayScope::apply(TriageSession::query(), $user, 'triage_sessions.barangay_id');

    expect($query->count())->toBe(2);
});

it('is decided by role, not by whether barangay_id happens to be null', function () {
    // A super-admin who *does* have a barangay assigned is still unscoped:
    // the role is what confers the scope, not the column.
    $user = scopeUser('super_admin', $this->mine);

    expect(BarangayScope::apply(TriageSession::query(), $user)->count())->toBe(3);
});
