<?php

use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;

function makeRole(string $name): Role
{
    return Role::firstOrCreate(['name' => $name], [
        'label' => ucwords(str_replace('_', ' ', $name)),
        'description' => "The {$name} role.",
    ]);
}

function makeStaff(string $role = 'sub_admin', ?Barangay $barangay = null, string $email = 'nurse@example.test'): User
{
    return User::create([
        'email' => $email,
        'password_hash' => 'correct-horse',
        'email_verified_at' => null,
        'role_id' => makeRole($role)->getKey(),
        'barangay_id' => $barangay?->getKey(),
    ]);
}

beforeEach(function () {
    // A browser SPA always sends Origin on an XHR, and that header is how
    // Sanctum decides a request is first-party and worth a session. Without it
    // these tests would exercise the stateless path and never touch the mode
    // the portal and console actually use.
    $this->withHeaders(['Origin' => 'http://localhost']);

    RateLimiter::clear(strtolower('nurse@example.test').'|127.0.0.1');
    $this->barangay = Barangay::create([
        'name' => 'Valladolid', 'city' => 'Carcar City', 'region' => 'Region VII',
    ]);
});

it('signs a staff account in with a session cookie and no token', function () {
    $user = makeStaff('sub_admin', $this->barangay);

    $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test',
        'password' => 'correct-horse',
    ])->assertStatus(200)
        ->assertJsonPath('user.email', 'nurse@example.test')
        ->assertJsonPath('user.role', 'sub_admin')
        ->assertJsonPath('user.barangayId', $this->barangay->getKey());

    $this->assertAuthenticatedAs($user);
});

it('never returns the password hash', function () {
    makeStaff();

    $response = $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test',
        'password' => 'correct-horse',
    ]);

    expect($response->getContent())->not->toContain('password_hash')
        ->and($response->getContent())->not->toContain('$2y$');
});

/*
 * Saying "no such account" would turn the login form into an oracle for which
 * staff addresses exist.
 */
it('does not reveal whether an email exists', function () {
    makeStaff();

    $wrongPassword = $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'wrong',
    ]);

    $noSuchUser = $this->postJson('/api/v1/staff/login', [
        'email' => 'ghost@example.test', 'password' => 'wrong',
    ]);

    expect($wrongPassword->status())->toBe($noSuchUser->status())
        ->and($wrongPassword->json('message'))->toBe($noSuchUser->json('message'));
});

it('audits a successful login against the account', function () {
    $user = makeStaff();

    $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'correct-horse',
    ])->assertStatus(200);

    $entry = AuditLog::where('action_type', 'login')->first();

    expect($entry)->not->toBeNull()
        ->and($entry->actor_id)->toBe($user->getKey())
        ->and($entry->actor_label)->toBe('nurse@example.test')
        ->and($entry->target_table)->toBe('users')
        ->and($entry->target_id)->toBe($user->getKey());
});

/*
 * The load-bearing property of a failed-login entry: whoever typed that
 * password did NOT prove they are the account holder, so the entry must not
 * claim they performed it. An audit trail that can put an action in an
 * innocent person's history is worth less than no trail at all.
 */
it('audits a failed login without attributing it to the account holder', function () {
    $user = makeStaff();

    $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'wrong',
    ])->assertStatus(422);

    $entry = AuditLog::where('action_type', 'login_failed')->first();

    expect($entry)->not->toBeNull()
        ->and($entry->actor_id)->toBeNull()
        ->and($entry->actor_label)->toBe('system')
        // The account is still named as the target, so an account under attack
        // is visible on its own trail.
        ->and($entry->target_id)->toBe($user->getKey())
        ->and($entry->old_value['attempted_email'])->toBe('nurse@example.test');
});

it('audits a failed login for an address that matches no account', function () {
    $this->postJson('/api/v1/staff/login', [
        'email' => 'ghost@example.test', 'password' => 'wrong',
    ])->assertStatus(422);

    $entry = AuditLog::where('action_type', 'login_failed')->first();

    expect($entry->target_id)->toBeNull()
        ->and($entry->old_value['attempted_email'])->toBe('ghost@example.test');
});

it('throttles repeated failures and audits the lockout', function () {
    makeStaff();

    foreach (range(1, 5) as $ignored) {
        $this->postJson('/api/v1/staff/login', [
            'email' => 'nurse@example.test', 'password' => 'wrong',
        ])->assertStatus(422);
    }

    $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'wrong',
    ])->assertStatus(429);

    expect(AuditLog::where('action_type', 'login_throttled')->count())->toBe(1);

    // And the correct password does not get through while locked out.
    $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'correct-horse',
    ])->assertStatus(429);
});

it('rejects /me when not signed in', function () {
    $this->getJson('/api/v1/staff/me')->assertStatus(401);
});

it('returns the signed-in account from /me', function () {
    $user = makeStaff('super_admin');

    $this->actingAs($user);

    $this->getJson('/api/v1/staff/me')
        ->assertStatus(200)
        ->assertJsonPath('user.role', 'super_admin')
        // A super-admin is unscoped, so barangayId is null.
        ->assertJsonPath('user.barangayId', null);
});

it('signs out, audits it, and stops accepting the session', function () {
    $user = makeStaff();

    // A real login rather than actingAs(): actingAs sets the guard's user in
    // memory, so invalidating the session would not visibly change anything
    // and the assertion below would prove nothing.
    $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'correct-horse',
    ])->assertStatus(200);

    $this->getJson('/api/v1/staff/me')->assertStatus(200);

    $this->postJson('/api/v1/staff/logout')->assertStatus(200);

    expect(AuditLog::where('action_type', 'logout')->where('actor_id', $user->getKey())->count())->toBe(1);

    // The session guard is genuinely cleared. This is asserted against the web
    // guard rather than by re-calling /me: Laravel reuses one container across
    // requests within a test, and Sanctum's guard caches the user it resolved,
    // so /me would answer from that cache. A browser gets a fresh process per
    // request and the invalidated cookie simply fails.
    expect(Auth::guard('web')->check())->toBeFalse();
});

/*
 * A device credential must never open a staff route, and a staff session must
 * never open a device route. These are separate populations (ADR-0003/0004).
 */
it('does not let a staff session reach a device route', function () {
    $this->actingAs(makeStaff('super_admin'));

    $this->getJson('/api/v1/ruleset/current')->assertStatus(401);
});

/*
 * The whole point of choosing SPA mode: authentication that adds no table to a
 * schema the manuscript fixes at 20 entities.
 */
it('issues no token and creates no token table', function () {
    makeStaff();

    $response = $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'correct-horse',
    ])->assertStatus(200);

    expect($response->json())->not->toHaveKey('token')
        ->and($response->json())->not->toHaveKey('access_token')
        ->and(Schema::hasTable('personal_access_tokens'))->toBeFalse();
});

/*
 * A request with no Origin/Referer is not first-party, so Sanctum starts no
 * session. That used to reach $request->session() and die with a 500, which
 * told an operator nothing. It should name the actual misconfiguration.
 */
it('explains itself when a request is not first-party, rather than 500ing', function () {
    makeStaff();

    $this->flushHeaders();

    $this->postJson('/api/v1/staff/login', [
        'email' => 'nurse@example.test', 'password' => 'correct-horse',
    ])->assertStatus(400)
        ->assertJsonFragment(['message' => 'Staff authentication requires a first-party session. This request carried no Origin or Referer matching SANCTUM_STATEFUL_DOMAINS, so no session was started.']);
});

/*
 * REGRESSION. Found by hand in Postman/curl, not by the suite above: the
 * original code passed actor: null to Recorder::record(), which treats null as
 * "look up the authenticated user" rather than "no actor". A failed login sent
 * from a browser that already held a valid session was therefore filed under
 * THAT account — an action in an innocent person's audit trail, which is the
 * one thing ADR-0004 says the failed-login entry must never do.
 */
it('does not attribute a failed login to a different signed-in account', function () {
    $victim = makeStaff('sub_admin', $this->barangay, 'victim@example.test');
    $attacker = makeStaff('super_admin', null, 'attacker@example.test');

    // Authenticated as one account...
    $this->postJson('/api/v1/staff/login', [
        'email' => 'attacker@example.test', 'password' => 'correct-horse',
    ])->assertStatus(200);

    // ...then a failed attempt against another, on the same session.
    $this->postJson('/api/v1/staff/login', [
        'email' => 'victim@example.test', 'password' => 'wrong',
    ])->assertStatus(422);

    $entry = AuditLog::where('action_type', 'login_failed')->firstOrFail();

    expect($entry->actor_id)->toBeNull()
        ->and($entry->actor_label)->toBe('system')
        ->and($entry->target_id)->toBe($victim->getKey());

    expect($entry->actor_id)->not->toBe($attacker->getKey());
});
