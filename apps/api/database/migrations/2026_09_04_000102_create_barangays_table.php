<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 5: BARANGAY.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('barangays', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name', 100);
            $table->string('city', 100);
            $table->string('region', 100);

            // Barangay names repeat across municipalities; the natural key is
            // the full triple. Not in the Data Dictionary.
            $table->unique(['name', 'city', 'region']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barangays');
    }
};
