<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A device moving to another barangay (Settings, "Change barangay").
 *
 * The barangay is the only thing a device may change about itself. Its type,
 * label, approval and status belong to the console.
 */
class MoveDeviceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'barangay_id' => ['required', 'integer', 'exists:barangays,id'],
        ];
    }
}
