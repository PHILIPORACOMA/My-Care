<?php

use App\Domain\Aggregation\DateRange;
use App\Domain\Reports\ReportGenerator;
use App\Models\AuditLog;
use App\Models\Report;
use Illuminate\Support\Facades\Storage;
use Tests\Support\SessionFixtures;
use Tests\Support\StaffHelpers;

uses(StaffHelpers::class, SessionFixtures::class);

beforeEach(function () {
    Storage::fake('local');
    $this->version = $this->publishedFixtureVersion();
    $this->valladolid = $this->fixtureBarangay('Valladolid');
    $this->bolinawan = $this->fixtureBarangay('Bolinawan');
    $day = DateRange::today()->subDays(3)->setTime(9, 0)->utc()->toIso8601String();
    $this->storedSessions(8, $this->version, $this->valladolid, $day, ['code_a']);
    $this->storedSessions(2, $this->version, $this->valladolid, $day, ['code_b']);
    $this->storedSessions(9, $this->version, $this->bolinawan, $day, ['code_b']);
    $this->artisan('mycare:aggregate')->assertSuccessful();
    $this->from = DateRange::today()->subDays(10)->toDateString();
    $this->to = DateRange::today()->toDateString();
});

/*
 * UT-018: "Sub-admin generates a CSV/PDF report — File downloads with correct
 * date range and de-identified content."
 */
it('generates a CSV with the requested range, suppressed and de-identified (UT-018)', function () {
    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $report = $this->postJson('/api/v1/staff/reports', [
        'type' => 'tier_summary', 'format' => 'csv', 'from' => $this->from, 'to' => $this->to,
    ])->assertStatus(201)->json('report');

    expect($report['from'])->toBe($this->from)->and($report['to'])->toBe($this->to)
        ->and($report['barangayName'])->toBe('Valladolid');

    $download = $this->get("/api/v1/staff/reports/{$report['id']}/download")->assertStatus(200);
    $csv = $download->streamedContent();

    expect($download->headers->get('content-disposition'))->toContain("{$this->from}-to-{$this->to}.csv")
        ->and($csv)->toContain("Period: {$this->from} to {$this->to}")
        ->and($csv)->toContain('Valladolid')
        // Home 8 shown; rhu 2 suppressed; emergency 0 suppressed.
        ->and($csv)->toContain('Valladolid,8,<5,<5,10')
        // Scoped: nothing about the other barangay.
        ->and($csv)->not->toContain('Bolinawan')
        ->and($csv)->not->toContain('@');
});

it('generates a PDF', function () {
    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $report = $this->postJson('/api/v1/staff/reports', [
        'type' => 'daily_volume', 'format' => 'pdf', 'from' => $this->from, 'to' => $this->to,
    ])->assertStatus(201)->json('report');

    $pdf = $this->get("/api/v1/staff/reports/{$report['id']}/download")->assertStatus(200)->streamedContent();

    expect(substr($pdf, 0, 5))->toBe('%PDF-')->and($report['fileSizeKb'])->toBeGreaterThan(0);
});

it('lists every symptom code so a masked count does not reveal presence', function () {
    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $report = $this->postJson('/api/v1/staff/reports', [
        'type' => 'symptom_summary', 'format' => 'csv', 'from' => $this->from, 'to' => $this->to,
    ])->assertStatus(201)->json('report');

    $csv = $this->get("/api/v1/staff/reports/{$report['id']}/download")->streamedContent();

    // code_c never occurred; it still appears, masked like code_b's 2.
    expect($csv)->toContain('code_a,"Fixture A",8')
        ->and($csv)->toContain('code_b,"Fixture B",<5')
        ->and($csv)->toContain('code_c,"Fixture C",<5');
});

it('refuses a sub-admin another barangay\'s report or download', function () {
    $nurse = $this->subAdmin($this->valladolid);
    $this->actingAsStaff($nurse);

    $this->postJson('/api/v1/staff/reports', [
        'type' => 'tier_summary', 'format' => 'csv', 'from' => $this->from, 'to' => $this->to,
        'barangayId' => $this->bolinawan->id,
    ])->assertStatus(409);

    $this->flushHeaders()->actingAsStaff($this->superAdmin());
    $other = $this->postJson('/api/v1/staff/reports', [
        'type' => 'tier_summary', 'format' => 'csv', 'from' => $this->from, 'to' => $this->to,
        'barangayId' => $this->bolinawan->id,
    ])->assertStatus(201)->json('report');

    $this->flushHeaders()->actingAsStaff($nurse);
    $this->get("/api/v1/staff/reports/{$other['id']}/download")->assertStatus(404);
    $this->getJson('/api/v1/staff/reports')->assertJsonCount(0, 'reports');
});

it('audits every export as a data export', function () {
    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $id = $this->postJson('/api/v1/staff/reports', [
        'type' => 'tier_summary', 'format' => 'csv', 'from' => $this->from, 'to' => $this->to,
    ])->json('report.id');

    expect(AuditLog::where('target_table', 'reports')->where('target_id', $id)->where('action_type', 'created')->exists())->toBeTrue();
});

it('exports the audit log de-identified, super-admin only', function () {
    $this->actingAsStaff($this->subAdmin($this->valladolid));
    $this->postJson('/api/v1/staff/reports', [
        'type' => 'audit_log', 'format' => 'csv', 'from' => $this->from, 'to' => $this->to,
    ])->assertStatus(409);

    $admin = $this->superAdmin('lead@mycare.example');
    $this->flushHeaders()->actingAsStaff($admin);
    AuditLog::create([
        'actor_id' => null, 'actor_label' => 'system', 'action_type' => 'login_failed', 'target_table' => 'users',
        'target_id' => null, 'old_value' => ['attempted_email' => 'someone@rhu.example'], 'created_at' => now('UTC'),
    ]);

    $report = $this->postJson('/api/v1/staff/reports', [
        'type' => 'audit_log', 'format' => 'csv', 'from' => $this->from, 'to' => $this->to,
    ])->assertStatus(201)->json('report');

    $csv = $this->get("/api/v1/staff/reports/{$report['id']}/download")->streamedContent();

    expect($csv)->not->toContain('lead@mycare.example')
        ->and($csv)->not->toContain('someone@rhu.example')
        ->and($csv)->toContain('[removed]')
        ->and($csv)->toContain('sign-in');
});

it('rejects an inverted or oversized range', function () {
    $this->actingAsStaff($this->subAdmin($this->valladolid));

    $this->postJson('/api/v1/staff/reports', ['type' => 'tier_summary', 'format' => 'csv', 'from' => $this->to, 'to' => $this->from])
        ->assertStatus(422);
    $this->postJson('/api/v1/staff/reports', ['type' => 'tier_summary', 'format' => 'csv', 'from' => '2020-01-01', 'to' => $this->to])
        ->assertStatus(422);

    expect(Report::count())->toBe(0);
});
