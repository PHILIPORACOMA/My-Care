<?php

use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Facility;
use Database\Seeders\BarangaySeeder;

function facilityCsv(string $body): string
{
    $path = tempnam(sys_get_temp_dir(), 'facilities').'.csv';
    file_put_contents($path, "name,type,barangay,address,contact_number,operating_hours,is_active\n".$body);

    return $path;
}

beforeEach(function () {
    Barangay::create(['name' => 'Valladolid', 'city' => 'Carcar City', 'region' => 'Region VII']);
});

it('imports facilities and audits each one', function () {
    $path = facilityCsv(
        "Valladolid Health Station,health_station,Valladolid,,0917 000 0000,8AM-5PM,yes\n"
        ."City Emergency Hotline,emergency_hotline,,,911,24/7,true\n"
    );

    $this->artisan('mycare:facilities:import', ['file' => $path])->assertSuccessful();

    expect(Facility::count())->toBe(2)
        ->and(Facility::where('type', 'emergency_hotline')->value('barangay_id'))->toBeNull()
        ->and(AuditLog::where('target_table', 'facilities')->count())->toBe(2);
});

it('updates in place when re-imported', function () {
    $path = facilityCsv("Valladolid Health Station,health_station,Valladolid,,111,,yes\n");
    $this->artisan('mycare:facilities:import', ['file' => $path])->assertSuccessful();

    $path = facilityCsv("Valladolid Health Station,health_station,Valladolid,,222,,no\n");
    $this->artisan('mycare:facilities:import', ['file' => $path])->assertSuccessful();

    expect(Facility::count())->toBe(1)
        ->and(Facility::first()->contact_number)->toBe('222')
        ->and(Facility::first()->is_active)->toBeFalse();
});

it('imports nothing when any row is invalid', function () {
    $path = facilityCsv(
        "Good,rhu,Valladolid,,1,,yes\n"
        ."Bad,rhu,Atlantis,,2,,yes\n"
    );

    $this->artisan('mycare:facilities:import', ['file' => $path])->assertFailed();

    expect(Facility::count())->toBe(0);
});

it('seeds the 15 Carcar City barangays idempotently', function () {
    $this->seed(BarangaySeeder::class);
    $this->seed(BarangaySeeder::class);

    expect(Barangay::where('city', 'Carcar City')->count())->toBe(15);
});
