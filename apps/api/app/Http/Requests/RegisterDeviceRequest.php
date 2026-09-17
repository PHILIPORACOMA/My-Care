<?php

namespace App\Http\Requests;

use App\Http\Controllers\Api\V1\DeviceRegistrationController;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Anonymous device self-registration.
 *
 * Only what DEVICE (Table 12) needs and nothing that identifies a person: the
 * barangay the device serves and its deployment class. No name, number, model,
 * IMEI, advertising id or location — RA 10173, anonymous patients.
 */
class RegisterDeviceRequest extends FormRequest
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
            'type' => ['required', 'string', Rule::in(DeviceRegistrationController::TYPES)],
        ];
    }
}
