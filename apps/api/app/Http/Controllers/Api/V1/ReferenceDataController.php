<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Barangay;
use App\Models\Facility;
use Illuminate\Http\JsonResponse;

/**
 * Public reference data a patient device needs before and during triage.
 */
class ReferenceDataController extends Controller
{
    /**
     * The barangay list for onboarding (Figure 20, UT-001).
     *
     * Unauthenticated on purpose: a device must choose its barangay *before*
     * it can register, and the list of barangays is public geography, not
     * patient data. The PWA caches it for offline use.
     */
    public function barangays(): JsonResponse
    {
        $barangays = Barangay::orderBy('name')->orderBy('id')->get()
            ->map(fn (Barangay $b): array => [
                'id' => $b->getKey(),
                'name' => $b->name,
                'city' => $b->city,
            ])
            ->all();

        return response()->json(['barangays' => $barangays]);
    }

    /**
     * Active facilities, for the emergency "Call for help" action (Figure 27).
     *
     * This is what wires FACILITY (Table 20) into a use case — the table was
     * orphaned in the manuscript. All active facilities are returned, not only
     * the device's own barangay: a patient may change barangay in Settings, and
     * the PWA picks the nearest match locally, offline. Facility contact
     * details are public service information, not patient data.
     */
    public function facilities(): JsonResponse
    {
        $facilities = Facility::where('is_active', true)
            ->orderBy('name')->orderBy('id')->get()
            ->map(fn (Facility $f): array => [
                'id' => $f->getKey(),
                'barangayId' => $f->barangay_id,
                'name' => $f->name,
                'type' => $f->type,
                'address' => $f->address,
                'contactNumber' => $f->contact_number,
                'operatingHours' => $f->operating_hours,
            ])
            ->all();

        return response()->json(['facilities' => $facilities]);
    }
}
