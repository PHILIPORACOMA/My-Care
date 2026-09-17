<?php

use App\Http\Controllers\Api\V1\Console\RulesetVersionController;
use App\Http\Controllers\Api\V1\Console\SymptomCodeController;
use App\Http\Controllers\Api\V1\DeviceRegistrationController;
use App\Http\Controllers\Api\V1\ReferenceDataController;
use App\Http\Controllers\Api\V1\RulesetController;
use App\Http\Controllers\Api\V1\Staff\AuthController;
use App\Http\Controllers\Api\V1\SyncBatchController;
use Illuminate\Support\Facades\Route;

/*
| The v1 API has two populations that never overlap.
|
| **Devices** are enrolled PWA installations authenticating with
| DEVICE.api_token. A device is not an account: it has no role, no barangay
| scope of its own, and must never reach a staff route.
|
| **Staff** are people with a USER row, authenticating with a first-party
| session cookie via Sanctum's SPA mode. No token is ever issued.
|
| Keeping the two groups textually separate is deliberate — the failure mode
| worth designing against is a staff route quietly ending up behind `device`,
| or the reverse.
|
| The version prefix is ours, not the manuscript's: it pins no URL scheme. v1
| exists so a published ruleset contract can change shape later without
| stranding handsets that may not be updated for weeks.
*/

Route::prefix('v1')->group(function (): void {
    /*
    | Staff — session cookie (Sanctum SPA mode).
    |
    | login is intentionally outside auth:web (you cannot be authenticated
    | before authenticating) and carries its own per-email+IP throttle plus an
    | audit entry for every failure.
    |
    | auth:web, NOT auth:sanctum. Sanctum's guard falls through to a bearer-token
    | lookup against personal_access_tokens whenever an Authorization header is
    | present — a table SPA mode deliberately never creates — so any stray
    | `Authorization: Bearer` header on a staff route became an unauthenticated
    | 500 that echoed SQL in debug mode. No token is ever issued here, so the
    | token path could only fail. The web guard reads the same session that
    | statefulApi() starts, which is the only way staff authenticate
    | (ADR-0004).
    */
    Route::prefix('staff')->group(function (): void {
        Route::post('/login', [AuthController::class, 'login'])->name('api.v1.staff.login');

        Route::middleware('auth:web')->group(function (): void {
            Route::post('/logout', [AuthController::class, 'logout'])->name('api.v1.staff.logout');
            Route::get('/me', [AuthController::class, 'me'])->name('api.v1.staff.me');
        });
    });

    /*
    | Console — super-admin only (Figures 36–41).
    */
    Route::prefix('console')
        ->middleware(['auth:web', 'role:super_admin'])
        ->name('api.v1.console.')
        ->group(function (): void {
            // Figure 39 / UT-007–UT-011.
            Route::get('/ruleset-versions', [RulesetVersionController::class, 'index'])->name('ruleset-versions.index');
            Route::post('/ruleset-versions', [RulesetVersionController::class, 'store'])->name('ruleset-versions.store');
            Route::post('/ruleset-versions/import', [RulesetVersionController::class, 'import'])->name('ruleset-versions.import');
            Route::get('/ruleset-versions/{version}', [RulesetVersionController::class, 'show'])->name('ruleset-versions.show');
            Route::put('/ruleset-versions/{version}/content', [RulesetVersionController::class, 'saveContent'])->name('ruleset-versions.content');
            Route::post('/ruleset-versions/{version}/submit', [RulesetVersionController::class, 'submit'])->name('ruleset-versions.submit');
            Route::post('/ruleset-versions/{version}/return-to-draft', [RulesetVersionController::class, 'returnToDraft'])->name('ruleset-versions.return');
            Route::post('/ruleset-versions/{version}/publish', [RulesetVersionController::class, 'publish'])->name('ruleset-versions.publish');
            Route::post('/ruleset-versions/{version}/rollback', [RulesetVersionController::class, 'rollback'])->name('ruleset-versions.rollback');

            Route::get('/symptom-codes', [SymptomCodeController::class, 'index'])->name('symptom-codes.index');
            Route::post('/symptom-codes', [SymptomCodeController::class, 'store'])->name('symptom-codes.store');
            Route::patch('/symptom-codes/{symptomCode:code}', [SymptomCodeController::class, 'update'])->name('symptom-codes.update');
        });

    /*
    | Public — no credential. Rate-limited.
    |
    | A device has to choose a barangay and register before it holds a token,
    | so these two cannot sit behind `device`. Neither returns patient data.
    */
    Route::get('/barangays', [ReferenceDataController::class, 'barangays'])
        ->middleware('throttle:public-reference')
        ->name('api.v1.barangays.index');

    // ADR-0005: anonymous self-registration, auto-approved, revocable.
    Route::post('/devices', [DeviceRegistrationController::class, 'store'])
        ->middleware('throttle:device-registration')
        ->name('api.v1.devices.store');

    /*
    | Devices — DEVICE.api_token.
    */
    Route::middleware('device')->group(function (): void {
        // Figure 27's "Call for help": FACILITY (Table 20) contact numbers.
        Route::get('/facilities', [ReferenceDataController::class, 'facilities'])
            ->name('api.v1.facilities.index');

        // UT-013: a device checks for and downloads the latest published
        // ruleset. Serves the published version only — a draft must never
        // reach a handset.
        Route::get('/ruleset/current', [RulesetController::class, 'current'])
            ->name('api.v1.ruleset.current');

        // UT-012, UT-015: a device uploads de-identified session records after
        // regaining connectivity. Idempotent on client_batch_uuid — a retried
        // POST returns 200 with the original result, never 409.
        Route::post('/sync/batches', [SyncBatchController::class, 'store'])
            ->name('api.v1.sync.batches.store');
    });
});
