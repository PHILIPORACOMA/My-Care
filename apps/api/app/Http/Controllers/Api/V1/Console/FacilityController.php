<?php

namespace App\Http\Controllers\Api\V1\Console;

use App\Domain\Facility\FacilityRules;
use App\Http\Controllers\Controller;
use App\Models\Facility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * FACILITY (Table 20): the numbers behind the patient app's emergency "Call for
 * help" button (Figure 27, ADR-0005).
 *
 * When an RHU reports a new number, the super-admin changes it here instead of
 * re-importing the City Health Office CSV. Every change is audited by the
 * model observer with the value it replaced, never from this controller.
 *
 * A facility is deactivated, never deleted: the audit trail keeps pointing at
 * a real row, and a mistaken deactivation is one click to undo.
 *
 * Phones pick up a change the next time the app opens with signal. Until then
 * a phone that stays offline keeps calling the number it last downloaded.
 */
class FacilityController extends Controller
{
    public function index(): JsonResponse
    {
        $facilities = Facility::with('barangay')
            ->orderByDesc('is_active')->orderBy('name')->orderBy('id')
            ->get()
            ->map(fn (Facility $f): array => self::present($f));

        return response()->json(['facilities' => $facilities, 'suggestedTypes' => FacilityRules::SUGGESTED_TYPES]);
    }

    public function store(Request $request): JsonResponse
    {
        $facility = Facility::create($this->validated($request, null) + ['is_active' => true]);

        return response()->json(['facility' => self::present($facility->load('barangay'))], 201);
    }

    public function update(Request $request, Facility $facility): JsonResponse
    {
        $facility->update($this->validated($request, $facility));

        return response()->json(['facility' => self::present($facility->load('barangay'))]);
    }

    /** @return array<string, mixed> */
    public static function present(Facility $facility): array
    {
        return [
            'id' => $facility->getKey(),
            'barangayId' => $facility->barangay_id,
            'barangayName' => $facility->barangay?->name,
            'name' => $facility->name,
            'type' => $facility->type,
            'address' => $facility->address,
            'contactNumber' => $facility->contact_number,
            'operatingHours' => $facility->operating_hours,
            'isActive' => (bool) $facility->is_active,
        ];
    }

    /**
     * Column widths from Data Dictionary Table 20. Field names are the API's
     * camelCase, so the console can put each error under its own field.
     *
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Facility $existing): array
    {
        // Required to create; on an edit, checked only when sent, and then
        // never blank.
        $presence = $existing === null ? ['required'] : ['sometimes', 'required'];

        $input = $request->validate([
            'name' => [...$presence, 'string', 'max:150'],
            'type' => [...$presence, 'string', 'max:30'],
            // A number can be changed but not cleared: an "active" facility
            // with no number is one "Call for help" skips silently. To stop
            // using a facility, deactivate it.
            'contactNumber' => [...$presence, ...FacilityRules::contactNumber()],
            'barangayId' => ['sometimes', 'nullable', 'integer', Rule::exists('barangays', 'id')],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'operatingHours' => ['sometimes', 'nullable', 'string', 'max:100'],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        $columns = [
            'name' => 'name',
            'type' => 'type',
            'contactNumber' => 'contact_number',
            'barangayId' => 'barangay_id',
            'address' => 'address',
            'operatingHours' => 'operating_hours',
            'isActive' => 'is_active',
        ];

        $data = [];
        foreach ($columns as $field => $column) {
            if (array_key_exists($field, $input)) {
                $value = $input[$field];
                $data[$column] = is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
            }
        }

        $this->rejectDuplicate($data, $existing);

        return $data;
    }

    /**
     * The CSV importer matches rows on name + barangay, so two facilities
     * sharing both would make the next import update whichever it found first.
     *
     * @param  array<string, mixed>  $data
     */
    private function rejectDuplicate(array $data, ?Facility $existing): void
    {
        $name = $data['name'] ?? $existing?->name;
        $barangayId = array_key_exists('barangay_id', $data) ? $data['barangay_id'] : $existing?->barangay_id;

        $clash = Facility::query()
            ->where('name', $name)
            ->when($barangayId === null, fn ($q) => $q->whereNull('barangay_id'), fn ($q) => $q->where('barangay_id', $barangayId))
            ->when($existing !== null, fn ($q) => $q->whereKeyNot($existing->getKey()))
            ->exists();

        if ($clash) {
            throw ValidationException::withMessages([
                'name' => 'A facility with this name already exists for this barangay.',
            ]);
        }
    }
}
