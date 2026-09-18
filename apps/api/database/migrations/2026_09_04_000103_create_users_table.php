<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 17: USER.
 *
 * Staff accounts only — super-admin (dev team) and sub-admin (RHU/LGU).
 * Patients are anonymous under RA 10173: no account, no login, no PII, and
 * no row in this table ever corresponds to a patient.
 *
 * barangay_id is nullable because a super-admin is not scoped to one
 * barangay; a sub-admin always is (UT-016).
 *
 * Note the column is `password_hash`, not Laravel's conventional `password`.
 * App\Models\User overrides getAuthPassword() so authentication still works.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('email', 150);
            $table->string('password_hash', 255);
            $table->dateTime('email_verified_at')->nullable();
            $table->unsignedInteger('role_id');
            $table->unsignedInteger('barangay_id')->nullable();

            $table->unique('email');

            $table->foreign('role_id')->references('id')->on('roles')->restrictOnDelete();
            $table->foreign('barangay_id')->references('id')->on('barangays')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
