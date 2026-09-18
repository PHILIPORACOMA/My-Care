<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 20: FACILITY.
 *
 * Open item carried from the manuscript review: no module or use case
 * currently reads this entity. Its shape (contact_number, operating_hours,
 * barangay_id) fits the emergency "Call for help" action, but the wiring
 * decision is deferred to Phase 5 rather than guessed at here. The table is
 * created as specified so the schema matches the manuscript; if the decision
 * is to drop it, that becomes a manuscript amendment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facilities', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('barangay_id')->nullable();
            $table->string('name', 150);
            $table->string('type', 30);
            $table->string('address', 255)->nullable();
            $table->string('contact_number', 30)->nullable();
            $table->string('operating_hours', 100)->nullable();
            $table->boolean('is_active');

            $table->foreign('barangay_id')->references('id')->on('barangays')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facilities');
    }
};
