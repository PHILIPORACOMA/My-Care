<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 22: SYNC_BATCH.
 *
 * One upload attempt from one device.
 *
 * The UNIQUE index on client_batch_uuid is the idempotency guarantee (UT-015):
 * a device that retries after a timeout re-POSTs the same batch uuid, and the
 * duplicate must return 200 with the original result — never 409, and never a
 * second set of rows. Double-counting corrupts surveillance data, which is the
 * one failure mode this table exists to prevent.
 *
 * The uuid is generated on the device, so uniqueness is enforced globally
 * rather than per-device: a uuid collision across devices would be a client
 * bug, and silently accepting it would be worse than failing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_batches', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('device_id');
            $table->char('client_batch_uuid', 36);
            $table->integer('session_count');
            $table->string('status', 15);
            $table->integer('attempt_count');
            $table->string('error_code', 50)->nullable();
            $table->dateTime('started_at');
            $table->dateTime('completed_at')->nullable();

            $table->unique('client_batch_uuid');

            $table->foreign('device_id')->references('id')->on('devices')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_batches');
    }
};
