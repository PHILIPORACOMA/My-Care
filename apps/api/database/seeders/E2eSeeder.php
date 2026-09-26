<?php

namespace Database\Seeders;

use App\Domain\Accounts\AccountManager;
use App\Domain\Ruleset\BundleImporter;
use App\Domain\Ruleset\RulesetLifecycle;
use App\Models\Barangay;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Fixture for the Playwright end-to-end suite (e2e/, Phase 8). Nothing else.
 *
 * It publishes the v1 bundle and mints two staff accounts with known
 * passwords, so it **refuses to run against any schema but `mycare_e2e`**:
 * not the development database, not `mycare_test`, never production. The
 * guard is on the schema name rather than APP_ENV because the risk is the
 * data, and the E2E server runs with the ordinary local environment.
 *
 * The publish below is **not a clinical-review attestation.** It happens only
 * inside a throwaway schema that `migrate:fresh` wipes before every run, the
 * same way the Pest suite publishes in `mycare_test`. The real v1 sign-off is
 * the one recorded in the development database, given by a named person
 * (BUILD-LOG 8h).
 *
 * Run by e2e/global-setup.ts:
 *
 *     php artisan db:seed --class=E2eSeeder --force     (with DB_DATABASE=mycare_e2e)
 */
class E2eSeeder extends Seeder
{
    public const SCHEMA = 'mycare_e2e';

    /** Test-only credentials, valid only inside the mycare_e2e schema. */
    public const SUPER_ADMIN = ['email' => 'e2e-super@mycare.test', 'password' => 'e2e-super-pass-2026'];

    public const SUB_ADMIN = ['email' => 'e2e-sub@mycare.test', 'password' => 'e2e-sub-pass-2026'];

    /** The sub-admin's barangay, and the one the patient journey onboards into. */
    public const BARANGAY = 'Valladolid';

    public function run(AccountManager $accounts, BundleImporter $importer, RulesetLifecycle $lifecycle): void
    {
        $schema = config('database.connections.'.config('database.default').'.database');

        if ($schema !== self::SCHEMA || app()->environment('production')) {
            throw new RuntimeException("E2eSeeder only runs against the '".self::SCHEMA."' schema; this is '{$schema}'.");
        }

        $path = base_path('../../packages/ruleset/dist/v1.json');

        if (! is_readable($path)) {
            throw new RuntimeException("{$path} is missing. Run: npm run export:v1 -w @mycare/ruleset");
        }

        $super = $accounts->createSuperAdmin(self::SUPER_ADMIN['email'], self::SUPER_ADMIN['password']);

        $accounts->createSubAdmin([
            'email' => self::SUB_ADMIN['email'],
            'password' => self::SUB_ADMIN['password'],
            'barangayId' => Barangay::where('name', self::BARANGAY)->firstOrFail()->getKey(),
        ]);

        $draft = $importer->import(json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR));
        $published = $lifecycle->publish($lifecycle->submitForReview($draft), $super, clinicalReviewConfirmed: true);

        $this->command?->info("E2E fixture: {$published->label} published, two test staff accounts created.");
    }
}
