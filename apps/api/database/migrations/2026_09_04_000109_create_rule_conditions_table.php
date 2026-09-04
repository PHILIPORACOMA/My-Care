<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 10: RULE_CONDITION.
 *
 * A condition tests either the presence of a symptom code, or an attribute
 * against a named severity threshold. `operator` says how this condition
 * combines with the ones before it in the parent rule (the first condition's
 * operator is ignored — there is nothing yet to combine with).
 *
 * `attribute` is the qualifier a clarification answer populates. Note that
 * CLARIFICATION_QUESTION (Table 15) has no `attribute` column of its own:
 * per ADR-0001 its `question_key` doubles as the attribute name referenced
 * here, which is why no schema change was needed there.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rule_conditions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('triage_rule_id');
            $table->unsignedInteger('symptom_code_id')->nullable();
            $table->unsignedInteger('severity_threshold_id')->nullable();
            $table->string('operator', 10);
            $table->string('attribute', 30)->nullable();
            $table->string('comparator', 5)->nullable();

            $table->foreign('triage_rule_id')->references('id')->on('triage_rules')->cascadeOnDelete();
            $table->foreign('symptom_code_id')->references('id')->on('symptom_codes')->restrictOnDelete();
            $table->foreign('severity_threshold_id')->references('id')->on('severity_thresholds')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rule_conditions');
    }
};
