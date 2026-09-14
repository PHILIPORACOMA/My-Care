<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 24: ROLE.
 *
 * Columns match the manuscript one-to-one. No created_at/updated_at: the Data
 * Dictionary does not list them on any entity, so Eloquent timestamps are off
 * across the whole application (see each model's $timestamps = false).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name', 20);
            $table->string('label', 50);
            $table->string('description', 255);

            // Not in the Data Dictionary — role names are looked up by name
            // throughout authorisation, and duplicates would be ambiguous.
            $table->unique('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
