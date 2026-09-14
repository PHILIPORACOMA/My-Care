<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 8: LEXICON_TERM.
 *
 * Tagalog and Cebuano surface forms mapped to canonical symptom codes. This
 * is what the on-device NLP layer matches free text against (UT-003), and
 * is_negation is what powers negation detection such as "walay hilanat"
 * (UT-004). The lexicon proposes symptom codes; only the rule engine ever
 * assigns a tier.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lexicon_terms', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('ruleset_version_id');
            $table->unsignedInteger('symptom_code_id');
            $table->string('language', 5);
            $table->string('term', 100);
            $table->boolean('is_negation');

            // A surface form resolves to one meaning per language per version.
            $table->unique(['ruleset_version_id', 'language', 'term']);

            $table->foreign('ruleset_version_id')->references('id')->on('ruleset_versions')->cascadeOnDelete();
            $table->foreign('symptom_code_id')->references('id')->on('symptom_codes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lexicon_terms');
    }
};
