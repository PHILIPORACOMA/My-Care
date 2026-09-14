<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Models\Device;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Enrols one approved device for local development, so the sync and ruleset
 * endpoints can be exercised by hand before the super-admin console exists to
 * enrol devices properly (Phase 4).
 *
 * **Deliberately not in DatabaseSeeder's chain.** `migrate --seed` must never
 * mint a working API credential as a side effect. Run it explicitly:
 *
 *     php artisan db:seed --class=DeviceSeeder
 *
 * The token is random per run and printed once. It is not stored anywhere else,
 * and nothing in the repo depends on its value — tests build their own devices
 * rather than relying on this.
 */
class DeviceSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('DeviceSeeder refuses to run in production.');

            return;
        }

        $barangay = Barangay::firstOrCreate(
            ['name' => 'Valladolid', 'city' => 'Carcar City', 'region' => 'Region VII'],
        );

        $token = Str::random(80);

        Device::create([
            'barangay_id' => $barangay->getKey(),
            'type' => 'shared',
            'label' => 'Local development handset',
            'api_token' => $token,
            'status' => 'active',
            'is_approved' => true,
            'registered_at' => CarbonImmutable::now('UTC'),
            'last_sync_at' => null,
        ]);

        $this->command?->info('Device enrolled for local development.');
        $this->command?->warn("API token (shown once): {$token}");
    }
}
