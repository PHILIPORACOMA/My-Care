<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 18: REPORT.
 *
 * A generated CSV/PDF export (UT-018). barangay_id is nullable so a
 * super-admin can export across all barangays; a sub-admin's export is always
 * scoped to their own (UT-016).
 *
 * Every figure in a generated report passes through
 * App\Domain\Aggregation\SuppressionRule first — the export path is not
 * exempt from the under-5 rule.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->increments('id');
            $table->string('type', 30);
            $table->unsignedInteger('barangay_id')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('format', 10);
            $table->integer('file_size_kb');
            $table->unsignedInteger('generated_by_id');
            $table->dateTime('generated_at');

            $table->foreign('barangay_id')->references('id')->on('barangays')->nullOnDelete();
            $table->foreign('generated_by_id')->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
