<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 21: HEALTH_TIP.
 *
 * Plain-language guidance shown alongside a triage result (UT-006). Scoped to
 * a ruleset version, so tips ship to devices with the bundle they belong to.
 *
 * Open item: packages/ruleset's RulesetBundle has no healthTips field yet, so
 * this content is not currently part of the published bundle contract. That is
 * a ruleset-contract change and is deferred until the publish endpoint is
 * built — see docs/STATUS.md.
 *
 * Health tips are medical content and require clinical review before any real
 * text is seeded here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('health_tips', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('ruleset_version_id');
            $table->unsignedInteger('symptom_code_id')->nullable();
            $table->string('outcome_tier', 15);
            $table->string('language', 5);
            $table->string('title', 150);
            $table->text('body');
            $table->integer('display_order');

            $table->foreign('ruleset_version_id')->references('id')->on('ruleset_versions')->cascadeOnDelete();
            $table->foreign('symptom_code_id')->references('id')->on('symptom_codes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('health_tips');
    }
};
