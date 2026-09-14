<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Models\ClarificationQuestion;
use App\Models\HealthTip;
use App\Models\LexiconTerm;
use App\Models\Role;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use App\Models\TriageRule;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Enough content to exercise the API by hand (Postman, curl) before the
 * super-admin console exists to author it properly.
 *
 * **Deliberately not in DatabaseSeeder's chain**, and refuses to run in
 * production. It mints a staff account with a known password, which must never
 * happen as a side effect of `migrate --seed`. Run it explicitly:
 *
 *     php artisan db:seed --class=DemoDataSeeder
 *
 * The clinical content here is NOT the v1 ruleset and has had no clinician
 * review. It exists so endpoints return something inspectable. The real bundle
 * lives in packages/ruleset/src/bundle/v1.ts and still needs a publish path
 * into these tables — that is Phase 4 work (UT-010, UT-011).
 */
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('DemoDataSeeder refuses to run in production.');

            return;
        }

        $barangay = Barangay::firstOrCreate(
            ['name' => 'Valladolid', 'city' => 'Carcar City', 'region' => 'Region VII'],
        );

        $superAdmin = Role::where('name', 'super_admin')->firstOrFail();
        $subAdmin = Role::where('name', 'sub_admin')->firstOrFail();

        // password_hash is cast 'hashed', so this is stored as a bcrypt digest.
        User::updateOrCreate(
            ['email' => 'super@mycare.test'],
            ['password_hash' => 'password', 'role_id' => $superAdmin->getKey(), 'barangay_id' => null],
        );

        User::updateOrCreate(
            ['email' => 'sub@mycare.test'],
            ['password_hash' => 'password', 'role_id' => $subAdmin->getKey(), 'barangay_id' => $barangay->getKey()],
        );

        $fever = SymptomCode::updateOrCreate(
            ['code' => 'fever_mild'],
            ['display_name' => 'Fever, mild', 'needs_clarification' => true],
        );

        $chestPain = SymptomCode::updateOrCreate(
            ['code' => 'chest_pain_severe'],
            ['display_name' => 'Severe chest pain', 'needs_clarification' => true],
        );

        $version = RulesetVersion::updateOrCreate(
            ['label' => 'demo-v1'],
            [
                'status' => 'published',
                'published_at' => CarbonImmutable::now('UTC'),
                'published_by_id' => null,
            ],
        );

        TriageRule::updateOrCreate(
            ['ruleset_version_id' => $version->getKey(), 'code' => 'R-001'],
            [
                'name' => 'Mild fever, no red flags',
                'expression' => 'IF fever_mild',
                'outcome_tier' => 'home',
                'priority' => 10,
                'is_active' => true,
            ],
        );

        TriageRule::updateOrCreate(
            ['ruleset_version_id' => $version->getKey(), 'code' => 'R-002'],
            [
                'name' => 'Severe chest pain',
                'expression' => 'IF chest_pain_severe',
                'outcome_tier' => 'emergency',
                'priority' => 1,
                'is_active' => true,
            ],
        );

        foreach ([['ceb', 'hilanat'], ['tl', 'lagnat'], ['ceb', 'sakit sa dughan']] as [$lang, $term]) {
            LexiconTerm::updateOrCreate(
                ['ruleset_version_id' => $version->getKey(), 'language' => $lang, 'term' => $term],
                [
                    'symptom_code_id' => str_contains($term, 'dughan') ? $chestPain->getKey() : $fever->getKey(),
                    'is_negation' => false,
                ],
            );
        }

        ClarificationQuestion::updateOrCreate(
            [
                'ruleset_version_id' => $version->getKey(),
                'question_key' => 'chest_pain_severity',
                'language' => 'ceb',
            ],
            [
                'symptom_code_id' => $chestPain->getKey(),
                'prompt' => 'Unsa ka grabe ang sakit sa imong dughan?',
                'answer_type' => 'single_select',
                'allowed_answers' => ['mild', 'moderate', 'severe_spreading'],
                'red_flag_answer' => 'severe_spreading',
            ],
        );

        HealthTip::updateOrCreate(
            ['ruleset_version_id' => $version->getKey(), 'title' => 'Pahulay ug inom ug tubig'],
            [
                'symptom_code_id' => $fever->getKey(),
                'outcome_tier' => 'home',
                'language' => 'ceb',
                'body' => 'Pagpahulay. Inom ug daghang tubig. Kung molala, adto sa RHU.',
                'display_order' => 1,
            ],
        );

        $this->command?->info('Demo data seeded.');
        $this->command?->line('  ruleset version : demo-v1 (published)');
        $this->command?->line('  super-admin     : super@mycare.test / password');
        $this->command?->line('  sub-admin       : sub@mycare.test / password  (scoped to Valladolid)');
        $this->command?->line("  barangay_id     : {$barangay->getKey()}");
        $this->command?->warn('Demo clinical content — not the v1 ruleset, not clinician-reviewed.');
    }
}
