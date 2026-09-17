<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Device\DeviceToken;
use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterDeviceRequest;
use App\Models\Device;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

/**
 * Anonymous device self-registration (ADR-0005).
 *
 * The manuscript has no enrolment screen, but TRIAGE_SESSION rows need a
 * device and SYNC_BATCH rows require one. Decided 2026-09-17: a PWA registers
 * itself the first time it is online, and is approved immediately so patient
 * phones actually sync. The route is rate-limited per IP, and a super-admin can
 * revoke any device from the console (is_approved = false, audited).
 *
 * The plain token is returned exactly once. Only its prefix and digest are
 * stored, so it can never be shown again — a device that loses it registers
 * afresh.
 */
class DeviceRegistrationController extends Controller
{
    /** Deployment classes (Figure 33 names health-station devices and BHW field phones). */
    public const TYPES = ['patient_phone', 'health_station', 'bhw_phone'];

    public function store(RegisterDeviceRequest $request): JsonResponse
    {
        $data = $request->validated();
        $token = DeviceToken::issue();

        $device = Device::create([
            'barangay_id' => $data['barangay_id'],
            'type' => $data['type'],
            // A human-readable handle for the console. The six characters come
            // from the public lookup prefix, never from the secret.
            'label' => str_replace('_', ' ', $data['type']).' '.substr($token['stored'], 0, 6),
            'api_token' => $token['stored'],
            'status' => 'active',
            'is_approved' => true,
            'registered_at' => CarbonImmutable::now('UTC'),
            'last_sync_at' => null,
        ]);

        return response()->json([
            'token' => $token['plain'],
            'device' => [
                'id' => $device->getKey(),
                'label' => $device->label,
                'type' => $device->type,
                'barangayId' => $device->barangay_id,
                'registeredAt' => $device->registered_at->toIso8601String(),
            ],
        ], 201);
    }
}
