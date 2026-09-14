<?php

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
    | login is intentionally outside auth:sanctum (you cannot be authenticated
    | before authenticating) and carries its own per-email+IP throttle plus an
    | audit entry for every failure.
    */
    Route::prefix('staff')->group(function (): void {
        Route::post('/login', [AuthController::class, 'login'])->name('api.v1.staff.login');

        Route::middleware('auth:sanctum')->group(function (): void {
            Route::post('/logout', [AuthController::class, 'logout'])->name('api.v1.staff.logout');
            Route::get('/me', [AuthController::class, 'me'])->name('api.v1.staff.me');
        });
    });

    /*
    | Devices — DEVICE.api_token.
    */
    Route::middleware('device')->group(function (): void {
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
