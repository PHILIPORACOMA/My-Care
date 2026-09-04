<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 7: RULESET_VERSION.
 *
 * The unit of publication. Everything a device downloads is scoped to one of
 * these rows, which is what makes a past triage result reconstructible: the
 * session stores ruleset_version_id, and the engine is deterministic, so the
 * exact rules in force at the time can always be replayed (Figure 41).
 *
 * published_at / published_by_id are nullable because a draft has neither
 * until it is published (UT-010, UT-011).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ruleset_versions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('label', 20);
            $table->string('status', 15);
            $table->dateTime('published_at')->nullable();
            $table->unsignedInteger('published_by_id')->nullable();

            $table->unique('label');

            $table->foreign('published_by_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ruleset_versions');
    }
};
