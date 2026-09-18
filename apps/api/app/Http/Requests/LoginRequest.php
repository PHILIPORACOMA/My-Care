<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Staff login credentials (portal and console).
 *
 * Patients never reach this: they are anonymous, have no account, and there is
 * no row in USER for them (RA 10173).
 */
class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:150'],
            'password' => ['required', 'string', 'max:255'],
            // No "remember" field. Remember-me needs USER.remember_token, which
            // Table 17 does not have, and neither login mockup (Figures 30, 36)
            // offers it. A client that sends one is ignored like any other
            // unknown field — the session lifetime is the only persistence.
        ];
    }
}
