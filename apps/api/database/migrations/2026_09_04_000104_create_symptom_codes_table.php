<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 6: SYMPTOM_CODE.
 *
 * Unlike the other ruleset content entities, SYMPTOM_CODE carries no
 * ruleset_version_id — canonical codes are stable across ruleset versions,
 * and the versioned content (lexicon terms, rules, thresholds, questions,
 * health tips) all point at them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('symptom_codes', function (Blueprint $table) {
            $table->increments('id');
            $table->string('code', 50);
            $table->string('display_name', 100);
            $table->boolean('needs_clarification');

            // The code is the identifier the triage engine bundle uses.
            $table->unique('code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('symptom_codes');
    }
};
