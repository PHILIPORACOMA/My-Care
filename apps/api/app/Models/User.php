<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * Data Dictionary Table 17: USER.
 *
 * Staff accounts only. Patients are anonymous under RA 10173 and never have a
 * row here.
 *
 * The Data Dictionary names the credential column `password_hash`, not
 * Laravel's conventional `password`, so getAuthPassword() is overridden below.
 * Renaming the column to suit the framework would mean amending the manuscript.
 */
class User extends Authenticatable
{
    use Notifiable;

    public $timestamps = false;

    protected $fillable = ['email', 'password_hash', 'email_verified_at', 'role_id', 'barangay_id'];

    protected $hidden = ['password_hash'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password_hash' => 'hashed',
        ];
    }

    /**
     * Laravel's guard reads the credential from getAuthPassword(); point it at
     * the Data Dictionary's column name.
     */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    /**
     * Remember-me is not supported: Table 17 has no remember_token column, and
     * neither staff login screen (Figures 30, 36) offers the option.
     *
     * An empty name makes Laravel's remember-me machinery a no-op rather than a
     * SQL error — setRememberToken() writes nothing and getRememberToken()
     * returns null, so a recall cookie can never authenticate. This guards any
     * future caller of Auth::login($user, remember: true), not only /login.
     * Overridden as a method because redeclaring the trait's
     * $rememberTokenName property with a different default is a fatal error.
     */
    public function getRememberTokenName(): string
    {
        return '';
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** Null for a super-admin; always set for a barangay-scoped sub-admin (UT-016). */
    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }
}
