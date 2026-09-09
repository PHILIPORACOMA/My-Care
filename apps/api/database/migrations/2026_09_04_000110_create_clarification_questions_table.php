<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 15: CLARIFICATION_QUESTION.
 *
 * Follow-up questions asked when a symptom code needs disambiguation
 * (Figure 23, "how severe is your chest pain?"). An answer equal to
 * `red_flag_answer` escalates straight to emergency ahead of everything
 * else (ADR-0001 step 1).
 *
 * There is deliberately no `attribute` column: `question_key` is itself the
 * attribute name that rule_conditions.attribute and severity_thresholds.key
 * reference. Whoever authors a question is responsible for choosing a key
 * that matches the qualifier it is meant to feed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clarification_questions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('ruleset_version_id');
            $table->unsignedInteger('symptom_code_id');
            $table->string('question_key', 50);
            $table->string('language', 5);
            $table->text('prompt');
            $table->string('answer_type', 15);
            $table->json('allowed_answers');
            $table->string('red_flag_answer', 50)->nullable();

            // One phrasing per language per version. The index is named
            // explicitly because Laravel's generated name for these three
            // columns is 71 characters, past MySQL's 64-character limit.
            $table->unique(
                ['ruleset_version_id', 'question_key', 'language'],
                'clarification_questions_version_key_lang_unique'
            );

            $table->foreign('ruleset_version_id')->references('id')->on('ruleset_versions')->cascadeOnDelete();
            $table->foreign('symptom_code_id')->references('id')->on('symptom_codes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clarification_questions');
    }
};
