<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 13: TRIAGE_SESSION.
 *
 * One completed triage on one device. Anonymous by construction: there is no
 * patient identifier, no name, no GPS — only the barangay, the device, and the
 * ruleset version that produced the result. Raw symptom text never reaches
 * this table; only resolved symptom codes do, via session_symptoms.
 *
 * There is deliberately no outcome_tier column — the Data Dictionary does not
 * define one. The tier is recovered by replaying the stored inputs through the
 * real triage engine against this row's ruleset version
 * (App\Domain\Triage\EngineReplayer, ADR-0007), which is exact for every
 * resolution path including is_override thresholds. (Comment updated
 * 2026-09-17; the migration itself is unchanged.)
 *
 * client_session_uuid is UNIQUE for the same reason sync_batches.client_batch_uuid
 * is: a retried upload must not create a second copy of the same session.
 *
 * started_at / completed_at / synced_at are stored in UTC, always. Devices go
 * offline for weeks; converting to Asia/Manila happens at display only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('triage_sessions', function (Blueprint $table) {
            $table->increments('id');
            $table->char('client_session_uuid', 36);
            $table->unsignedInteger('barangay_id');
            $table->unsignedInteger('device_id')->nullable();
            $table->unsignedInteger('ruleset_version_id');
            $table->unsignedInteger('matched_rule_id')->nullable();
            $table->unsignedInteger('sync_batch_id')->nullable();
            $table->string('language', 5);
            $table->timestamp('started_at');
            $table->timestamp('completed_at');
            $table->timestamp('synced_at')->nullable();

            $table->unique('client_session_uuid');

            // Dashboard and trend queries are always barangay + time scoped
            // (UT-016, UT-017).
            $table->index(['barangay_id', 'completed_at']);

            $table->foreign('barangay_id')->references('id')->on('barangays')->restrictOnDelete();
            $table->foreign('device_id')->references('id')->on('devices')->nullOnDelete();
            $table->foreign('ruleset_version_id')->references('id')->on('ruleset_versions')->restrictOnDelete();
            $table->foreign('matched_rule_id')->references('id')->on('triage_rules')->nullOnDelete();
            $table->foreign('sync_batch_id')->references('id')->on('sync_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('triage_sessions');
    }
};
