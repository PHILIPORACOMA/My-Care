<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Domain\Aggregation\DateRange;
use App\Domain\Auth\BarangayScope;
use App\Domain\Reports\ReportGenerator;
use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Figure 34, Data & Reports (UT-018).
 */
class ReportController extends Controller
{
    public function __construct(private readonly ReportGenerator $generator)
    {
    }

    /** Recently generated reports this account may download. */
    public function index(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $query = Report::with(['barangay', 'generatedBy'])->orderByDesc('id')->limit(50);

        if (! BarangayScope::isUnscoped($user)) {
            // A sub-admin sees their barangay's reports — never an
            // all-barangay export (barangay_id null) a super-admin made.
            $query->where('barangay_id', $user->barangay_id ?? 0)->where('type', '!=', 'audit_log');
        }

        return response()->json([
            'types' => collect(ReportGenerator::TYPES)
                ->when(! BarangayScope::isUnscoped($user), fn ($types) => $types->except('audit_log'))
                ->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label])
                ->values(),
            'reports' => $query->get()->map(fn (Report $r): array => $this->present($r)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'string'],
            'format' => ['required', 'in:'.implode(',', ReportGenerator::FORMATS)],
            'from' => ['required', 'date_format:Y-m-d'],
            'to' => ['required', 'date_format:Y-m-d'],
            'barangayId' => ['nullable', 'integer'],
        ]);

        $report = $this->generator->generate(
            $this->user($request),
            $data['type'],
            DateRange::fromInput($data['from'], $data['to']),
            $data['format'],
            isset($data['barangayId']) ? (int) $data['barangayId'] : null,
        );

        return response()->json(['report' => $this->present($report->load(['barangay', 'generatedBy']))], 201);
    }

    public function download(Request $request, Report $report): StreamedResponse|JsonResponse
    {
        $user = $this->user($request);

        if (! BarangayScope::isUnscoped($user)
            && ($report->barangay_id === null || $report->barangay_id !== $user->barangay_id || $report->type === 'audit_log')) {
            // 404, not 403: a sub-admin should not learn which report ids exist
            // for other barangays.
            return response()->json(['message' => 'Report not found.'], 404);
        }

        $path = ReportGenerator::path($report);

        if (! Storage::disk('local')->exists($path)) {
            return response()->json(['message' => 'The report file is no longer available. Generate it again.'], 410);
        }

        $name = sprintf('mycare-%s-%s-to-%s.%s', $report->type, $report->start_date->toDateString(), $report->end_date->toDateString(), $report->format);

        return Storage::disk('local')->download($path, $name, [
            'Content-Type' => $report->format === 'pdf' ? 'application/pdf' : 'text/csv; charset=UTF-8',
        ]);
    }

    /** @return array<string, mixed> */
    private function present(Report $report): array
    {
        return [
            'id' => $report->id,
            'type' => $report->type,
            'label' => ReportGenerator::TYPES[$report->type] ?? $report->type,
            'format' => $report->format,
            'barangayName' => $report->barangay?->name,
            'from' => $report->start_date->toDateString(),
            'to' => $report->end_date->toDateString(),
            'fileSizeKb' => $report->file_size_kb,
            'generatedBy' => $report->generatedBy?->email,
            'generatedAt' => $report->generated_at->toIso8601String(),
        ];
    }

    private function user(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();

        return $user;
    }
}
