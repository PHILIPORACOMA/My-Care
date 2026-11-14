<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Domain\Auth\BarangayScope;
use App\Http\Controllers\Api\V1\Console\FacilityController;
use App\Http\Controllers\Controller;
use App\Models\Facility;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The portal's read-only "Emergency numbers" panel.
 *
 * Lets RHU staff see the numbers patients are given by "Call for help"
 * (Figure 27), so a wrong or outdated one is noticed and reported to the
 * super-admin, who changes it in the console. Nothing here writes.
 *
 * Scoped through BarangayScope like every staff read path (UT-016): a
 * sub-admin sees their own barangay's facilities plus the city-wide ones
 * (no barangay), because a patient in their barangay may be given either. A
 * super-admin sees all. Inactive facilities are left out: phones never get
 * them.
 */
class FacilityDirectoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $visible = BarangayScope::visibleBarangayIds($user);

        $facilities = Facility::with('barangay')
            ->where('is_active', true)
            ->when($visible !== null, fn ($q) => $q->where(
                fn ($w) => $w->whereIn('barangay_id', $visible)->orWhereNull('barangay_id')
            ))
            ->orderBy('name')->orderBy('id')
            ->get()
            ->map(fn (Facility $f): array => FacilityController::present($f));

        return response()->json(['facilities' => $facilities]);
    }
}
