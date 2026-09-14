<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Guards the schema contract itself: the 20 Data Dictionary entities, the
 * engine it runs on, and the two constraints that silently corrupt
 * surveillance data if they go missing.
 */
it('runs against MySQL, never SQLite', function () {
    // The project rule is that SQLite is never used, not even for tests: an
    // in-memory run masks exactly the suppression and aggregate bugs these
    // tests exist to catch. config/database.php defines no sqlite connection,
    // and this assertion is the tripwire if one is ever added back.
    expect(DB::connection()->getDriverName())->toBe('mysql');
});

it('creates all 20 Data Dictionary entities and nothing else', function () {
    $expected = [
        'barangays',               // Table 5
        'symptom_codes',           // Table 6
        'ruleset_versions',        // Table 7
        'lexicon_terms',           // Table 8
        'triage_rules',            // Table 9
        'rule_conditions',         // Table 10
        'severity_thresholds',     // Table 11
        'devices',                 // Table 12
        'triage_sessions',         // Table 13
        'session_symptoms',        // Table 14
        'clarification_questions', // Table 15
        'clarification_answers',   // Table 16
        'users',                   // Table 17
        'reports',                 // Table 18
        'audit_logs',              // Table 19
        'facilities',              // Table 20
        'health_tips',             // Table 21
        'sync_batches',            // Table 22
        'aggregate_stats',         // Table 23
        'roles',                   // Table 24
    ];

    foreach ($expected as $table) {
        expect(Schema::hasTable($table))->toBeTrue("missing table: {$table}");
    }

    expect($expected)->toHaveCount(20);

    // No cache / jobs / sessions / password_reset_tokens: the drivers are set
    // to file, sync and array precisely so the schema stays equal to the
    // manuscript's entity list plus Laravel's own `migrations` bookkeeping.
    //
    // personal_access_tokens is on this list for a sharper reason. Sanctum IS
    // installed, but in SPA (cookie) mode, which issues no tokens and needs no
    // table. Sanctum 4.x only *publishes* that migration rather than loading
    // it, so the table appears the moment someone runs `install:api` or
    // `vendor:publish --tag=sanctum-migrations` — and a 21st table would break
    // the manuscript's 20-entity Data Dictionary without anyone noticing.
    // This assertion is the thing that notices. See ADR-0004.
    foreach (['cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'sessions', 'password_reset_tokens', 'personal_access_tokens'] as $absent) {
        expect(Schema::hasTable($absent))->toBeFalse("unexpected framework table: {$absent}");
    }
});

it('carries no Eloquent timestamp columns, per the Data Dictionary', function () {
    // The Data Dictionary lists no created_at/updated_at on any entity, so
    // timestamps() is off everywhere. audit_logs.created_at is the single
    // approved amendment (Table 19) and is therefore expected.
    $tables = [
        'roles', 'barangays', 'users', 'symptom_codes', 'ruleset_versions',
        'lexicon_terms', 'severity_thresholds', 'triage_rules', 'rule_conditions',
        'clarification_questions', 'health_tips', 'facilities', 'devices',
        'sync_batches', 'triage_sessions', 'session_symptoms',
        'clarification_answers', 'reports', 'aggregate_stats',
    ];

    foreach ($tables as $table) {
        expect(Schema::hasColumn($table, 'created_at'))->toBeFalse("{$table} grew a created_at")
            ->and(Schema::hasColumn($table, 'updated_at'))->toBeFalse("{$table} grew an updated_at");
    }

    expect(Schema::hasColumn('audit_logs', 'created_at'))->toBeTrue()
        ->and(Schema::hasColumn('audit_logs', 'updated_at'))->toBeFalse();
});

it('has no outcome_tier on triage_sessions, so derivation stays the only path', function () {
    // Documents a deliberate decision, not an oversight: Table 13 defines no
    // tier column, so SessionTierResolver reconstructs it. If this ever starts
    // failing, the manuscript amendment has landed and the resolver's known
    // limit should be revisited.
    expect(Schema::hasColumn('triage_sessions', 'outcome_tier'))->toBeFalse();
});

it('enforces sync batch idempotency at the database level', function () {
    // UT-015. The UNIQUE index is what makes a retried upload impossible to
    // double-count, even if application-level checks are bypassed or racing.
    $barangay = DB::table('barangays')->insertGetId([
        'name' => 'Valladolid', 'city' => 'Carcar City', 'region' => 'Region VII',
    ]);

    $device = DB::table('devices')->insertGetId([
        'barangay_id' => $barangay, 'type' => 'shared', 'label' => 'BHW handset 1',
        'api_token' => 'token-a', 'status' => 'active', 'is_approved' => true,
        'registered_at' => '2026-09-04 00:00:00', 'last_sync_at' => null,
    ]);

    $batch = [
        'device_id' => $device,
        'client_batch_uuid' => '6f1c8a52-3d44-4d2b-9d1e-0b7a2c9e5f10',
        'session_count' => 3, 'status' => 'complete', 'attempt_count' => 1,
        'error_code' => null, 'started_at' => '2026-09-04 00:00:00', 'completed_at' => null,
    ];

    DB::table('sync_batches')->insert($batch);

    expect(fn () => DB::table('sync_batches')->insert($batch))
        ->toThrow(QueryException::class);
});

it('enforces session idempotency at the database level', function () {
    $barangay = DB::table('barangays')->insertGetId([
        'name' => 'Can-asujan', 'city' => 'Carcar City', 'region' => 'Region VII',
    ]);

    $version = DB::table('ruleset_versions')->insertGetId([
        'label' => 'v1-draft', 'status' => 'draft', 'published_at' => null, 'published_by_id' => null,
    ]);

    $session = [
        'client_session_uuid' => 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        'barangay_id' => $barangay, 'device_id' => null, 'ruleset_version_id' => $version,
        'matched_rule_id' => null, 'sync_batch_id' => null, 'language' => 'ceb',
        'started_at' => '2026-09-04 01:00:00', 'completed_at' => '2026-09-04 01:02:00', 'synced_at' => null,
    ];

    DB::table('triage_sessions')->insert($session);

    expect(fn () => DB::table('triage_sessions')->insert($session))
        ->toThrow(QueryException::class);
});
