<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 16: CLARIFICATION_ANSWER.
 *
 * A patient's answer to one follow-up question. `is_red_flag` is what makes a
 * red-flag escalation reconstructible after the fact: it is the only stored
 * trace that ADR-0001 step 1 fired. Engine replay (ADR-0007) re-evaluates the
 * answer itself against the session's ruleset version.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clarification_answers', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('triage_session_id');
            $table->unsignedInteger('clarification_question_id');
            $table->string('answer', 50);
            $table->boolean('is_red_flag');

            $table->foreign('triage_session_id')->references('id')->on('triage_sessions')->cascadeOnDelete();
            $table->foreign('clarification_question_id')->references('id')->on('clarification_questions')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clarification_answers');
    }
};
