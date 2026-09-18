<?php

use App\Models\AuditLog;
use Illuminate\Support\Facades\Cache;
use Tests\Support\SessionFixtures;
use Tests\Support\StaffHelpers;

uses(StaffHelpers::class, SessionFixtures::class);

beforeEach(function () {
    $this->barangay = $this->fixtureBarangay();
    $this->admin = $this->superAdmin();
    $this->actingAsStaff($this->admin);
});

it('lists the audit log newest first, filterable by category (Figure 41)', function () {
    AuditLog::create(['actor_id' => null, 'actor_label' => 'system', 'action_type' => 'login_failed',
        'target_table' => 'users', 'target_id' => null, 'old_value' => null, 'created_at' => now('UTC')]);

    $all = $this->getJson('/api/v1/console/audit-logs')->assertStatus(200)->json();
    expect($all['entries'][0]['category'])->toBe('sign-in')
        ->and($all['total'])->toBeGreaterThan(1);

    $signIns = $this->getJson('/api/v1/console/audit-logs?category=sign-in')->assertStatus(200)->json('entries');
    expect(collect($signIns)->pluck('category')->unique()->all())->toBe(['sign-in']);

    $accounts = $this->getJson('/api/v1/console/audit-logs?category=accounts')->json('entries');
    expect(collect($accounts)->pluck('category')->unique()->all())->toBe(['accounts'])
        ->and(array_diff(collect($accounts)->pluck('targetTable')->unique()->all(), ['users', 'roles']))->toBe([]);
});

it('has no endpoint that alters the audit log', function () {
    $entry = AuditLog::firstOrFail();

    // No such route exists: 404 or 405 depending on the router, never success.
    foreach ([
        $this->deleteJson("/api/v1/console/audit-logs/{$entry->id}"),
        $this->putJson("/api/v1/console/audit-logs/{$entry->id}", []),
        $this->postJson('/api/v1/console/audit-logs', []),
    ] as $response) {
        expect($response->status())->toBeIn([404, 405]);
    }

    expect(AuditLog::whereKey($entry->id)->exists())->toBeTrue();
});

it('reports system health with services, metrics and per-barangay last sync (Figures 37, 40)', function () {
    $version = $this->publishedFixtureVersion();
    $this->storedSession($version, $this->barangay, now('UTC')->subHours(1)->toIso8601String(), ['code_a']);
    $this->artisan('mycare:aggregate')->assertSuccessful();

    $health = $this->getJson('/api/v1/console/system-health')->assertStatus(200)->json();

    $services = collect($health['services'])->keyBy('key');

    expect($services['database']['status'])->toBe('ok')
        ->and($services['replay']['status'])->toBe('ok')
        ->and($services['aggregation']['status'])->toBe('ok')
        ->and($health['publishedVersion']['label'])->toBe($version->label)
        ->and($health['metrics']['sessionsLast24h']['value'])->toBeNull()
        ->and(collect($health['barangays'])->pluck('name'))->toContain('Valladolid');
});

/*
 * REGRESSION. Found by running the console against a live server: the health
 * endpoint 500ed because checking for Node goes through Symfony's Process,
 * which writes temp files, and `php artisan serve` on Windows hands the child
 * no writable TMP. A health screen that dies tells an operator nothing — it has
 * to report the thing that is broken, including itself.
 */
it('reports a broken engine replay instead of failing', function (string $binary, ?string $script, string $expected) {
    Cache::forget('engine-replay-availability');
    config([
        'mycare.replay.node_binary' => $binary,
        // null means "the real script"; base_path() cannot be called while the
        // dataset is being collected, before the application boots.
        'mycare.replay.script' => $script ?? config('mycare.replay.script'),
    ]);

    $health = $this->getJson('/api/v1/console/system-health')->assertStatus(200)->json();
    $replay = collect($health['services'])->firstWhere('key', 'replay');

    expect($replay['status'])->toBe('down')
        ->and($replay['detail'])->toContain($expected)
        ->and($replay['detail'])->toContain('Aggregates cannot refresh');
})->with([
    'script missing' => ['node', 'C:/nope/replay.mjs', 'Script missing'],
    'node missing' => ['definitely-not-node', null, 'Node'],
]);

it('is super-admin only', function () {
    $this->flushHeaders()->actingAsStaff($this->subAdmin($this->barangay));

    $this->getJson('/api/v1/console/system-health')->assertStatus(403);
    $this->getJson('/api/v1/console/audit-logs')->assertStatus(403);
});
