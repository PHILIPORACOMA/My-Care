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
            // Cookie-mode Sanctum rides Laravel's session, so "remember me" is
            // the framework's long-lived recall cookie, not a stored token.
            'remember' => ['sometimes', 'boolean'],
        ];
    }
}
