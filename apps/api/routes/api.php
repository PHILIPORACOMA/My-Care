<?php

use App\Http\Controllers\Api\V1\RulesetController;
use App\Http\Controllers\Api\V1\SyncBatchController;
use Illuminate\Support\Facades\Route;

/*
| Device-facing API (Phase 3).
|
| Every route here is used by an enrolled PWA installation, never by a person
| with an account. Staff endpoints — dashboard, reports, rule authoring, account
| management — are Phase 4/7 and are blocked on the staff-auth decision (JWT vs
| Sanctum); do not add them to this file or behind the `device` middleware.
|
| The version prefix is ours, not the manuscript's: it pins no URL scheme. v1
| exists so a published ruleset contract can change shape later without
| stranding handsets that may not be updated for weeks.
*/

Route::prefix('v1')->group(function (): void {
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
