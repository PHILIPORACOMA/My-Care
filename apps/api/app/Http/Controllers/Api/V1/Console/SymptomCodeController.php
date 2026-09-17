<?php

namespace App\Http\Controllers\Api\V1\Console;

use App\Domain\Ruleset\SymptomCodeRegistry;
use App\Http\Controllers\Controller;
use App\Models\SymptomCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SYMPTOM_CODE (Table 6) — the canonical codes rules and lexicon terms point at.
 */
class SymptomCodeController extends Controller
{
    public function __construct(private readonly SymptomCodeRegistry $registry)
    {
    }

    public function index(): JsonResponse
    {
        $codes = SymptomCode::orderBy('code')->get()->map(fn (SymptomCode $c): array => $this->present($c));

        return response()->json(['symptomCodes' => $codes]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['symptomCode' => $this->present($this->registry->create($request->all()))], 201);
    }

    public function update(Request $request, SymptomCode $symptomCode): JsonResponse
    {
        return response()->json([
            'symptomCode' => $this->present($this->registry->update($symptomCode, $request->all())),
        ]);
    }

    /** @return array<string, mixed> */
    private function present(SymptomCode $code): array
    {
        return [
            'code' => $code->code,
            'displayName' => $code->display_name,
            'needsClarification' => (bool) $code->needs_clarification,
            // The console disables editing when true.
            'locked' => $this->registry->isFrozen($code),
        ];
    }
}
