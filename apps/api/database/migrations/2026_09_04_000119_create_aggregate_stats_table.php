<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 23: AGGREGATE_STAT.
 *
 * Precomputed rollups behind the trends dashboard and cluster-detection
 * banner (UT-017).
 *
 * session_count is stored raw. Suppression is a read-time concern, applied by
 * App\Domain\Aggregation\SuppressionRule on every path that renders a figure —
 * dashboard, trends, map, CSV, PDF. Storing a pre-suppressed value would make
 * the underlying counts unrecoverable and would silently corrupt any later
 * re-aggregation over a wider period, where the same bucket may well clear the
 * threshold.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aggregate_stats', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('barangay_id');
            $table->unsignedInteger('symptom_code_id')->nullable();
            $table->date('period_start');
            $table->date('period_end');
            $table->string('granularity', 10);
            $table->string('outcome_tier', 15)->nullable();
            $table->string('language', 5)->nullable();
            $table->integer('session_count');
            $table->dateTime('computed_at');

            $table->index(['barangay_id', 'period_start', 'period_end']);

            $table->foreign('barangay_id')->references('id')->on('barangays')->restrictOnDelete();
            $table->foreign('symptom_code_id')->references('id')->on('symptom_codes')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aggregate_stats');
    }
};
