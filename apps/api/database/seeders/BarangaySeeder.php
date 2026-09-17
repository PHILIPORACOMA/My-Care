<?php

namespace Database\Seeders;

use App\Models\Barangay;
use Illuminate\Database\Seeder;

/**
 * The 15 barangays of Carcar City, Cebu — the study's research environment.
 *
 * Source: PhilAtlas, "Carcar City, Cebu profile" (2023), which the manuscript
 * itself cites in its References. Names are spelled exactly as PhilAtlas lists
 * them, including "Ocana" without the tilde. Checked 2026-09-17.
 *
 * ⚠️ Verify against the City Health Office's own list before deployment. This
 * is public geography, not clinical content, but the barangay a session is
 * attributed to is the finest grain of the surveillance data, so a wrong name
 * here is a wrong row on every dashboard.
 *
 * Idempotent: safe to run on every `migrate --seed`. It never deletes a
 * barangay, because sessions and devices reference them.
 */
class BarangaySeeder extends Seeder
{
    public const CITY = 'Carcar City';

    public const REGION = 'Region VII';

    public const NAMES = [
        'Bolinawan',
        'Buenavista',
        'Calidngan',
        'Can-asujan',
        'Guadalupe',
        'Liburon',
        'Napo',
        'Ocana',
        'Perrelos',
        'Poblacion I',
        'Poblacion II',
        'Poblacion III',
        'Tuyom',
        'Valencia',
        'Valladolid',
    ];

    public function run(): void
    {
        foreach (self::NAMES as $name) {
            Barangay::firstOrCreate(['name' => $name, 'city' => self::CITY, 'region' => self::REGION]);
        }
    }
}
