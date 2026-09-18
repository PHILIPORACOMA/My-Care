<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 9: TRIAGE_RULE.
 *
 * `expression` is the human-readable IF/AND/NOT mirror shown in the rule
 * authoring UI (Figure 39); `rule_conditions` rows are what actually
 * evaluate. `priority` is a tie-break only — it breaks ties between rules
 * that already share the same tier, and never outranks tier order itself
 * (ADR-0001 step 3).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('triage_rules', function (Blueprint $table) {
            $table->increments('id');
            $table->string('code', 20);
            $table->unsignedInteger('ruleset_version_id');
            $table->string('name', 150);
            $table->text('expression');
            $table->string('outcome_tier', 15);
            $table->integer('priority');
            $table->boolean('is_active');

            // Rule codes (R-001, R-014...) are cited in explanations and must
            // be unambiguous within a version.
            $table->unique(['ruleset_version_id', 'code']);

            $table->foreign('ruleset_version_id')->references('id')->on('ruleset_versions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('triage_rules');
    }
};
