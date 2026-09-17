<?php

use App\Models\AggregateStat;
use App\Models\SymptomCode;
use Tests\Support\SessionFixtures;

uses(SessionFixtures::class);

beforeEach(function () {
    $this->version = $this->publishedFixtureVersion();
    $this->barangay = $this->fixtureBarangay();
});

function statCount(array $where): int
{
    $query = AggregateStat::query()->where('granularity', 'day');
    foreach (['symptom_code_id', 'outcome_tier', 'language'] as $column) {
        array_key_exists($column, $where) && $where[$column] !== null
            ? $query->where($column, $where[$column])
            : $query->whereNull($column);
    }
    if (isset($where['period_start'])) {
        $query->where('period_start', $where['period_start']);
    }

    return (int) $query->sum('session_count');
}

it('counts replayed tiers, symptoms, symptom×tier and language per Manila day', function () {
    $this->storedSessions(3, $this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_a']);          // home
    $this->storedSession($this->version, $this->barangay, '2026-09-10T03:00:00Z', ['code_a'], ['score' => '9']); // emergency via override
    $this->storedSession($this->version, $this->barangay, '2026-09-10T04:00:00Z', ['code_b'], language: 'tl');  // rhu

    $this->artisan('mycare:aggregate', ['--from' => '2026-09-01', '--to' => '2026-09-30'])->assertSuccessful();

    $a = SymptomCode::where('code', 'code_a')->value('id');

    expect(statCount(['period_start' => '2026-09-10']))->toBe(5)
        ->and(statCount(['outcome_tier' => 'home']))->toBe(3)
        ->and(statCount(['outcome_tier' => 'emergency']))->toBe(1)
        ->and(statCount(['outcome_tier' => 'rhu']))->toBe(1)
        ->and(statCount(['symptom_code_id' => $a]))->toBe(4)
        ->and(statCount(['symptom_code_id' => $a, 'outcome_tier' => 'emergency']))->toBe(1)
        ->and(statCount(['language' => 'tl']))->toBe(1);
});

/*
 * Timestamps are stored UTC (non-negotiable #6); a "day" is a Manila day.
 * 17:30 UTC on the 10th is 01:30 on the 11th in Manila.
 */
it('buckets by the Asia/Manila calendar day, not the UTC one', function () {
    $this->storedSession($this->version, $this->barangay, '2026-09-10T17:30:00Z', ['code_a']);

    $this->artisan('mycare:aggregate', ['--from' => '2026-09-01', '--to' => '2026-09-30'])->assertSuccessful();

    expect(statCount(['period_start' => '2026-09-11']))->toBe(1)
        ->and(statCount(['period_start' => '2026-09-10']))->toBe(0);
});

it('stores raw counts, including those that will be suppressed on read', function () {
    $this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_a']);

    $this->artisan('mycare:aggregate', ['--from' => '2026-09-01', '--to' => '2026-09-30'])->assertSuccessful();

    expect(statCount([]))->toBe(1);
});

it('is idempotent and replaces the window rather than adding to it', function () {
    $this->storedSessions(2, $this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_a']);

    $this->artisan('mycare:aggregate', ['--from' => '2026-09-01', '--to' => '2026-09-30'])->assertSuccessful();
    $this->artisan('mycare:aggregate', ['--from' => '2026-09-01', '--to' => '2026-09-30'])->assertSuccessful();

    expect(statCount([]))->toBe(2);
});

it('leaves days outside the window untouched', function () {
    $this->storedSession($this->version, $this->barangay, '2026-08-15T02:00:00Z', ['code_a']);
    $this->artisan('mycare:aggregate', ['--from' => '2026-08-01', '--to' => '2026-08-31'])->assertSuccessful();

    $this->storedSession($this->version, $this->barangay, '2026-09-10T02:00:00Z', ['code_b']);
    $this->artisan('mycare:aggregate', ['--from' => '2026-09-01', '--to' => '2026-09-30'])->assertSuccessful();

    expect(statCount(['period_start' => '2026-08-15']))->toBe(1)
        ->and(statCount(['period_start' => '2026-09-10']))->toBe(1);
});

it('rejects a malformed range', function () {
    $this->artisan('mycare:aggregate', ['--from' => '10/09/2026', '--to' => '2026-09-30'])->assertFailed();
});
