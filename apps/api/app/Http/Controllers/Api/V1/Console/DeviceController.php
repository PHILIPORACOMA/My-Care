<?php

namespace App\Http\Controllers\Api\V1\Console;

use App\Domain\Device\PendingQueueReport;
use App\Http\Controllers\Controller;
use App\Models\Device;
use Illuminate\Http\JsonResponse;

/**
 * Enrolled devices, and revoking one (ADR-0005).
 *
 * Revocation sets is_approved = false rather than changing `status`: the audit
 * observer deliberately ignores `status` (it is the "Connectivity State"
 * heartbeat), and a revocation is exactly the kind of privileged decision
 * Figure 41 must show.
 */
class DeviceController extends Controller
{
    public function index(): JsonResponse
    {
        $devices = Device::with('barangay')->orderByDesc('id')->limit(1000)->get()
            ->map(fn (Device $d): array => [
                'id' => $d->getKey(),
                'label' => $d->label,
                'type' => $d->type,
                'barangayId' => $d->barangay_id,
                'barangayName' => $d->barangay?->name,
                'approved' => (bool) $d->is_approved,
                'status' => $d->status,
                'registeredAt' => $d->registered_at?->toIso8601String(),
                'lastSyncAt' => $d->last_sync_at?->toIso8601String(),
                'pendingSessions' => PendingQueueReport::forDevice($d->getKey()),
            ]);

        return response()->json(['devices' => $devices]);
    }

    public function revoke(Device $device): JsonResponse
    {
        $device->update(['is_approved' => false]);

        return response()->json(['approved' => false]);
    }

    public function reinstate(Device $device): JsonResponse
    {
        $device->update(['is_approved' => true]);

        return response()->json(['approved' => true]);
    }
}
