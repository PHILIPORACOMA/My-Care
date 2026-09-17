<?php

use App\Domain\Aggregation\ClusterDetector;
use App\Domain\Aggregation\DateRange;
use App\Domain\Device\DeviceToken;
use App\Models\Device;
use Carbon\CarbonImmutable;
use Tests\Support\SessionFixtures;
use Tests\Support\StaffHelpers;

uses(StaffHelpers::class, SessionFixtures::class);

beforeEach(function () {
    $this->version = $this->publishedFixtureVersion();
    $this->valladolid = $this->fixtureBarangay('Valladolid');
    $this->bolinawan = $this->fixtureBarangay('Bolinawan');
    $this->today = DateRange::today();
    // A time on "today" in Manila, as UTC.
    $this->at = fn (int $daysAgo = 0) => $this->today->subDays($daysAgo)->setTime(10, 0)->utc()->toIso8601String();
});

function aggregate(): void
{
    test()->artisan('mycare:aggregate')->assertSuccessful();
}

/*
 * UT-017: "Sub-admin opens the Trends & Surveillance dashboard — Correct tier
 * counts and top-symptom trends are displayed."
 */
it('shows correct tier counts and top symptoms (UT-017)', function () {
    $this->storedSessions(7, $this->version, $this->valladolid, ($this->at)(1), ['code_a']);          // home
    $this->storedSessions(6, $this->version, $this->valladolid, ($this->at)(2), ['code_b']);          // rhu
    $this->storedSessions(5, $this->version, $this->valladolid, ($this->at)(1), ['code_a'], ['score' => '9']); // emergency
    aggregate();

    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $this->getJson('/api/v1/staff/dashboard')
        ->assertStatus(200)
        ->assertJsonPath('total.display', '18')
        ->assertJsonPath('tiers.home.value', 7)
        ->assertJsonPath('tiers.rhu.value', 6)
        ->assertJsonPath('tiers.emergency.value', 5)
        ->assertJsonPath('topSymptoms.0.code', 'code_a')
        ->assertJsonPath('topSymptoms.0.count.value', 12)
        ->assertJsonPath('topSymptoms.1.code', 'code_b');

    $trends = $this->getJson('/api/v1/staff/trends')->assertStatus(200)->json();

    expect($trends['series'])->toHaveCount(14)
        ->and(collect($trends['series'])->firstWhere('date', $this->today->subDay()->toDateString())['total']['value'])->toBe(12);
});

/*
 * UT-020 on the read path: no raw count under 5 ever appears in a response, and
 * a shown total cannot be used to subtract out a masked part.
 */
it('never sends a raw count under 5, and applies complementary suppression (UT-020)', function () {
    $this->storedSessions(7, $this->version, $this->valladolid, ($this->at)(1), ['code_a']);  // home 7
    $this->storedSessions(5, $this->version, $this->valladolid, ($this->at)(1), ['code_b']);  // rhu 5
    $this->storedSession($this->version, $this->valladolid, ($this->at)(1), ['code_a'], ['score' => '9']); // emergency 1
    aggregate();

    $this->actingAsStaff($this->subAdmin($this->valladolid));
    $body = $this->getJson('/api/v1/staff/dashboard')->assertStatus(200)->json();

    expect($body['total']['value'])->toBe(13)
        ->and($body['tiers']['emergency'])->toBe(['display' => '<5', 'suppressed' => true, 'value' => null])
        // 13 - 7 - 5 would reveal emergency = 1, so rhu is masked too.
        ->and($body['tiers']['rhu']['suppressed'])->toBeTrue()
        ->and($body['tiers']['rhu']['value'])->toBeNull()
        ->and($body['tiers']['home']['value'])->toBe(7);
});

/*
 * UT-016: "Sub-admin account is scoped to Barangay X — Only Barangay X
 * aggregates are visible to that account."
 */
it('shows a sub-admin only their own barangay, whatever they ask for (UT-016)', function () {
    $this->storedSessions(9, $this->version, $this->valladolid, ($this->at)(1), ['code_a']);
    $this->storedSessions(6, $this->version, $this->bolinawan, ($this->at)(1), ['code_b']);
    aggregate();

    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $this->getJson('/api/v1/staff/dashboard')->assertJsonPath('total.value', 9);
    // Asking for another barangay yields nothing, not its data.
    $this->getJson("/api/v1/staff/dashboard?barangayId={$this->bolinawan->id}")->assertJsonPath('total.value', null);
    $this->getJson('/api/v1/staff/barangays')->assertJsonCount(1, 'barangays')->assertJsonPath('barangays.0.name', 'Valladolid');
    $this->getJson('/api/v1/staff/map')->assertJsonCount(1, 'barangays');

    $this->flushHeaders()->actingAsStaff($this->superAdmin());
    $this->getJson('/api/v1/staff/dashboard')->assertJsonPath('total.value', 15);
    $this->getJson("/api/v1/staff/dashboard?barangayId={$this->bolinawan->id}")->assertJsonPath('total.value', 6);
});

it('refuses surveillance data to an unauthenticated caller', function () {
    $this->getJson('/api/v1/staff/dashboard')->assertStatus(401);
});

it('flags a statistically unusual rise and puts it on the watch list', function () {
    // Baseline: 1 session a week for 4 weeks; this week: 12.
    foreach ([8, 15, 22, 29] as $daysAgo) {
        $this->storedSession($this->version, $this->valladolid, ($this->at)($daysAgo), ['code_b']);
    }
    $this->storedSessions(12, $this->version, $this->valladolid, ($this->at)(2), ['code_b']);
    aggregate();

    $this->actingAsStaff($this->subAdmin($this->valladolid));
    $trends = $this->getJson('/api/v1/staff/trends')->assertStatus(200)->json();

    $cluster = collect($trends['clusters'])->firstWhere(fn ($c) => $c['symptomCode'] === 'code_b' && $c['tier'] === 'rhu');

    expect($cluster)->not->toBeNull()
        ->and($cluster['currentWeek']['value'])->toBe(12)
        // Last week was 1 — suppressed — so no percentage can be stated.
        ->and($cluster['changePercent'])->toBeNull()
        ->and(collect($trends['watchList'])->firstWhere('symptomCode', 'code_b')['state'])->toBe('rising');
});

it('assesses clusters with a Poisson tail and never flags a suppressed week', function () {
    expect(ClusterDetector::assess([1, 1, 1, 1, 12])['flagged'])->toBeTrue()
        ->and(ClusterDetector::assess([10, 11, 9, 10, 11])['flagged'])->toBeFalse()
        ->and(ClusterDetector::assess([0, 0, 0, 0, 4])['flagged'])->toBeFalse()
        ->and(ClusterDetector::assess([5, 5, 5, 10, 13])['changePercent'])->toBe(30)
        ->and(ClusterDetector::poissonUpperTail(0, 3.0))->toBe(1.0);
});

/*
 * UT-014: "Sub-admin opens the Sync Status screen — Last sync timestamp and
 * device/session counts display correctly."
 */
it('reports last sync, device counts and suppressed session counts (UT-014)', function () {
    $recent = CarbonImmutable::now('UTC')->subHours(2);

    foreach (['patient_phone', 'patient_phone', 'health_station'] as $i => $type) {
        Device::create([
            'barangay_id' => $this->valladolid->id, 'type' => $type, 'label' => "d{$i}",
            'api_token' => DeviceToken::issue()['stored'], 'status' => 'active', 'is_approved' => true,
            'registered_at' => $recent->subDays(30), 'last_sync_at' => $i === 0 ? $recent : $recent->subDays(10),
        ]);
    }
    $this->storedSessions(6, $this->version, $this->valladolid, ($this->at)(1), ['code_a']);

    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $this->getJson('/api/v1/staff/sync-status')
        ->assertStatus(200)
        ->assertJsonPath('lastSyncAt', $recent->toIso8601String())
        ->assertJsonPath('isCurrent', true)
        ->assertJsonPath('devices.total', 3)
        ->assertJsonPath('devices.reportedLast24h', 1)
        ->assertJsonPath('devices.byType.patient_phone', 2)
        ->assertJsonPath('sessions.total.value', 6)
        ->assertJsonPath('pendingUploads.devicesNotReporting', 3);
});

it('shades the map by relative volume and hides suppressed barangays', function () {
    $this->fixtureBarangay('Guadalupe');
    $this->storedSessions(12, $this->version, $this->valladolid, ($this->at)(1), ['code_a']);
    $this->storedSessions(5, $this->version, $this->bolinawan, ($this->at)(1), ['code_a']);
    aggregate();

    $this->actingAsStaff($this->superAdmin());
    $map = collect($this->getJson('/api/v1/staff/map')->assertStatus(200)->json('barangays'))->keyBy('name');

    expect($map['Valladolid']['band'])->toBe('high')
        ->and($map['Bolinawan']['band'])->toBe('elevated')
        ->and($map['Guadalupe']['band'])->toBe('suppressed')
        ->and($map['Guadalupe']['total']['value'])->toBeNull();
});
