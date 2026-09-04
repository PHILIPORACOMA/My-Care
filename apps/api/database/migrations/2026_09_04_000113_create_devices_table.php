<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 12: DEVICE.
 *
 * An enrolled installation of the PWA, not a person. A device is tied to a
 * barangay so uploaded sessions can be attributed to one without any patient
 * identity being involved.
 *
 * api_token authenticates sync requests; it is unique so a token resolves to
 * exactly one device.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devices', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('barangay_id');
            $table->string('type', 30);
            $table->string('label', 50);
            $table->string('api_token', 80);
            $table->string('status', 15);
            $table->boolean('is_approved');
            $table->dateTime('registered_at');
            $table->dateTime('last_sync_at')->nullable();

            $table->unique('api_token');

            $table->foreign('barangay_id')->references('id')->on('barangays')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devices');
    }
};
