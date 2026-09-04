<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 11: SEVERITY_THRESHOLD.
 *
 * `is_override` marks a red-flag threshold: once satisfied it escalates
 * straight to `tier`, ahead of normal rule matching (ADR-0001 step 2, UT-009).
 *
 * `key` is quoted by the query builder — it is a MySQL reserved word.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('severity_thresholds', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('ruleset_version_id');
            $table->string('key', 50);
            $table->string('label', 100);
            $table->string('value', 30);
            $table->string('tier', 15);
            $table->boolean('is_override');

            // Rule conditions reference a threshold by key within a version.
            $table->unique(['ruleset_version_id', 'key']);

            $table->foreign('ruleset_version_id')->references('id')->on('ruleset_versions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('severity_thresholds');
    }
};
