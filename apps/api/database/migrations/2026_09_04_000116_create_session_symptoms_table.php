<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 14: SESSION_SYMPTOM.
 *
 * The resolved symptom codes for one session. `negated` records that the
 * lexicon layer detected a negation cue ("walay hilanat" — no fever), so the
 * symptom is present in the transcript but must not be treated as reported
 * (UT-004).
 *
 * matched_term_id records which lexicon term matched, for explainability. Note
 * this stores a reference to an authored dictionary entry, never the patient's
 * own words — raw symptom text does not leave the device and has no column
 * anywhere in this schema.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_symptoms', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('triage_session_id');
            $table->unsignedInteger('symptom_code_id');
            $table->unsignedInteger('matched_term_id')->nullable();
            $table->boolean('negated');

            // Top-symptom trends group by code (UT-017).
            $table->index('symptom_code_id');

            $table->foreign('triage_session_id')->references('id')->on('triage_sessions')->cascadeOnDelete();
            $table->foreign('symptom_code_id')->references('id')->on('symptom_codes')->restrictOnDelete();
            $table->foreign('matched_term_id')->references('id')->on('lexicon_terms')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('session_symptoms');
    }
};
