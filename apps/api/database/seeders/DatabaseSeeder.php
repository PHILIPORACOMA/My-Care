<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Reference data only.
 *
 * Nothing clinical is seeded here. Symptom codes, lexicon terms, triage rules,
 * severity thresholds and health tips are all versioned content that must come
 * from the Clinical Plausibility and Content Validity Appraisal Form and pass
 * clinical review — they are published through a RULESET_VERSION, never
 * planted by a seeder.
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
        ]);
    }
}
