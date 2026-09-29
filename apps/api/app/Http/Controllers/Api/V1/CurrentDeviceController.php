<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MoveDeviceRequest;
use App\Models\Device;
use Illuminate\Http\JsonResponse;

/**
 * The authenticated device, acting on its own record.
 *
 * A patient can change their barangay in Settings without starting over (PR
 * #8). Each session already carries its own barangay_id, so the counts were
 * always right; but DEVICE.barangay_id (Table 12) is what Sync & status
 * (Figure 33, UT-014) and the console's system health group devices by. Left
 * unchanged, the old barangay's staff would keep seeing a phone that now
 * reports for someone else, and the new barangay's would not see it at all.
 *
 * Only the barangay moves. Sessions already stored keep the barangay they
 * were recorded under. The change is audited by the model observer, like any
 * other device update, with no actor: a device is not an account.
 */
class CurrentDeviceController extends Controller
{
    public function update(MoveDeviceRequest $request): JsonResponse
    {
        /** @var Device $device */
        $device = $request->attributes->get('device');

        // A no-op when nothing changed: Eloquent skips the save, so a retried
        // request leaves no second audit entry.
        $device->update(['barangay_id' => (int) $request->validated('barangay_id')]);

        return response()->json([
            'device' => [
                'id' => $device->getKey(),
                'barangayId' => $device->barangay_id,
            ],
        ]);
    }
}
