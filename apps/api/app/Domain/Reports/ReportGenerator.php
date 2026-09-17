<?php

namespace App\Domain\Reports;

use App\Domain\Aggregation\AggregateReader;
use App\Domain\Aggregation\DateRange;
use App\Domain\Aggregation\SuppressionRule;
use App\Domain\Auth\BarangayScope;
use App\Domain\DomainActionException;
use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Report;
use App\Models\SymptomCode;
use App\Models\User;
use Carbon\CarbonImmutable;
use Dompdf\Dompdf;
use Illuminate\Support\Facades\Storage;

/**
 * Data & Reports export, CSV or PDF (Figure 34, UT-018), and the de-identified
 * audit log export (Figure 41).
 *
 * "Every export inherits the same privacy guarantees as the live dashboard":
 * every count is written through SuppressionRule, every query is scoped through
 * BarangayScope, and no row identifies a patient — there is nothing in the
 * aggregate tables that could. The REPORT row (Table 18) is created through the
 * model, so the export itself is audited ("data exports", Figure 41).
 *
 * Deliberately absent: an all-barangay total row beneath per-barangay rows.
 * With one barangay suppressed, subtracting the others from that total would
 * reveal it.
 */
final class ReportGenerator
{
    public const TYPES = [
        'tier_summary' => 'Triage outcomes by barangay',
        'symptom_summary' => 'Sessions by symptom',
        'daily_volume' => 'Daily triage volume',
        'audit_log' => 'Audit log (de-identified)',
    ];

    public const FORMATS = ['csv', 'pdf'];

    public function __construct(private readonly AggregateReader $reader)
    {
    }

    /** @throws DomainActionException */
    public function generate(User $user, string $type, DateRange $range, string $format, ?int $barangayId): Report
    {
        if (! array_key_exists($type, self::TYPES) || ! in_array($format, self::FORMATS, true)) {
            throw DomainActionException::invalid(['type' => ['Unknown report type or format.']]);
        }

        if ($type === 'audit_log' && ! BarangayScope::isUnscoped($user)) {
            throw DomainActionException::conflict('Only a super-admin can export the audit log.');
        }

        // A sub-admin's report is always their own barangay's, whatever was
        // requested (UT-016). An explicit request for another barangay is an
        // error rather than a silent substitution.
        if (! BarangayScope::isUnscoped($user)) {
            if ($barangayId !== null && $barangayId !== $user->barangay_id) {
                throw DomainActionException::conflict('This account can only report on its assigned barangay.');
            }
            $barangayId = $user->barangay_id;
        }

        $barangay = $barangayId === null ? null : Barangay::find($barangayId);

        [$columns, $rows] = match ($type) {
            'tier_summary' => $this->tierSummary($user, $range, $barangayId),
            'symptom_summary' => $this->symptomSummary($user, $range, $barangayId),
            'daily_volume' => $this->dailyVolume($user, $range, $barangayId),
            'audit_log' => $this->auditLog($range),
        };

        $title = self::TYPES[$type];
        $contents = $format === 'csv'
            ? $this->csv($title, $range, $barangay, $columns, $rows)
            : $this->pdf($title, $range, $barangay, $columns, $rows);

        $report = Report::create([
            'type' => $type,
            'barangay_id' => $barangayId,
            'start_date' => $range->from->toDateString(),
            'end_date' => $range->to->toDateString(),
            'format' => $format,
            'file_size_kb' => max(1, (int) ceil(strlen($contents) / 1024)),
            'generated_by_id' => $user->getKey(),
            'generated_at' => CarbonImmutable::now('UTC'),
        ]);

        Storage::disk('local')->put(self::path($report), $contents);

        return $report;
    }

    public static function path(Report $report): string
    {
        return "reports/{$report->getKey()}.{$report->format}";
    }

    /** @return array{0: list<string>, 1: list<list<string>>} */
    private function tierSummary(User $user, DateRange $range, ?int $barangayId): array
    {
        $barangays = Barangay::query()->orderBy('name');
        BarangayScope::apply($barangays, $user, 'id');
        if ($barangayId !== null) {
            $barangays->whereKey($barangayId);
        }

        $rows = [];
        foreach ($barangays->get() as $barangay) {
            $tiers = $this->reader->tierTotals($user, $range, $barangay->id);
            $cells = SuppressionRule::partition($tiers);
            $rows[] = [
                $barangay->name,
                $cells['home']['display'],
                $cells['rhu']['display'],
                $cells['emergency']['display'],
                SuppressionRule::render(array_sum($tiers)),
            ];
        }

        return [['Barangay', 'Home management', 'RHU referral', 'Emergency referral', 'Total sessions'], $rows];
    }

    /** @return array{0: list<string>, 1: list<list<string>>} */
    private function symptomSummary(User $user, DateRange $range, ?int $barangayId): array
    {
        $totals = $this->reader->symptomTotals($user, $range, $barangayId);

        // Every code is listed, including those with no sessions, so a masked
        // "<5" does not reveal that a symptom occurred at all.
        $rows = SymptomCode::orderBy('code')->get()
            ->map(fn (SymptomCode $code): array => [
                $code->code,
                $code->display_name,
                SuppressionRule::render($totals[$code->code] ?? 0),
            ])
            ->all();

        return [['Symptom code', 'Symptom', 'Sessions'], $rows];
    }

    /** @return array{0: list<string>, 1: list<list<string>>} */
    private function dailyVolume(User $user, DateRange $range, ?int $barangayId): array
    {
        $rows = [];
        foreach ($this->reader->dailyTiers($user, $range, $barangayId) as $date => $tiers) {
            $cells = SuppressionRule::partition($tiers);
            $rows[] = [$date, $cells['home']['display'], $cells['rhu']['display'], $cells['emergency']['display'], SuppressionRule::render(array_sum($tiers))];
        }

        return [['Date', 'Home management', 'RHU referral', 'Emergency referral', 'Total sessions'], $rows];
    }

    /**
     * "The log itself can be exported in de-identified form for external
     * review" (Figure 41). Staff email addresses are replaced by account ids
     * and roles; an attempted login address is removed from old_value.
     *
     * @return array{0: list<string>, 1: list<list<string>>}
     */
    private function auditLog(DateRange $range): array
    {
        $roles = User::with('role')->get()->mapWithKeys(fn (User $u): array => [$u->id => $u->role?->name ?? 'account']);

        $rows = AuditLog::query()
            ->where('created_at', '>=', $range->startUtc())
            ->where('created_at', '<', $range->endExclusiveUtc())
            ->orderBy('id')
            ->get()
            ->map(function (AuditLog $entry) use ($roles): array {
                $old = $entry->old_value;
                if (is_array($old) && array_key_exists('attempted_email', $old)) {
                    $old['attempted_email'] = '[removed]';
                }

                return [
                    CarbonImmutable::parse($entry->created_at, 'UTC')->setTimezone(DateRange::timezone())->format('Y-m-d H:i:s'),
                    $entry->actor_id === null ? 'system' : ($roles[$entry->actor_id] ?? 'account').' #'.$entry->actor_id,
                    AuditCategory::of($entry),
                    $entry->action_type,
                    $entry->target_table,
                    (string) ($entry->target_id ?? ''),
                    $old === null ? '' : json_encode($old, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ];
            })
            ->all();

        return [['Recorded (Asia/Manila)', 'Actor', 'Category', 'Action', 'Table', 'Row', 'State before'], $rows];
    }

    /**
     * @param  list<string>  $columns
     * @param  list<list<string>>  $rows
     */
    private function csv(string $title, DateRange $range, ?Barangay $barangay, array $columns, array $rows): string
    {
        $out = fopen('php://temp', 'r+');

        foreach ($this->preamble($title, $range, $barangay) as $line) {
            fputcsv($out, [$line], escape: '\\');
        }
        fputcsv($out, [], escape: '\\');
        fputcsv($out, $columns, escape: '\\');
        foreach ($rows as $row) {
            fputcsv($out, $row, escape: '\\');
        }

        rewind($out);
        $csv = (string) stream_get_contents($out);
        fclose($out);

        return $csv;
    }

    /**
     * @param  list<string>  $columns
     * @param  list<list<string>>  $rows
     */
    private function pdf(string $title, DateRange $range, ?Barangay $barangay, array $columns, array $rows): string
    {
        $e = fn (string $v): string => htmlspecialchars($v, ENT_QUOTES, 'UTF-8');

        $html = '<html><head><meta charset="utf-8"><style>'
            .'body{font-family:DejaVu Sans,sans-serif;font-size:10px;color:#1f2933}'
            .'h1{font-size:15px;margin:0 0 4px}p{margin:1px 0;color:#52606d}'
            .'table{border-collapse:collapse;width:100%;margin-top:10px}'
            .'th,td{border:1px solid #cbd2d9;padding:4px 6px;text-align:left}th{background:#e4f2f0}'
            .'</style></head><body>';
        $html .= '<h1>'.$e($title).'</h1>';
        foreach (array_slice($this->preamble($title, $range, $barangay), 1) as $line) {
            $html .= '<p>'.$e($line).'</p>';
        }
        $html .= '<table><thead><tr>';
        foreach ($columns as $column) {
            $html .= '<th>'.$e($column).'</th>';
        }
        $html .= '</tr></thead><tbody>';
        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach ($row as $cell) {
                $html .= '<td>'.$e($cell).'</td>';
            }
            $html .= '</tr>';
        }
        if ($rows === []) {
            $html .= '<tr><td colspan="'.count($columns).'">No data in this range.</td></tr>';
        }
        $html .= '</tbody></table></body></html>';

        $dompdf = new Dompdf(['isRemoteEnabled' => false]);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', count($columns) > 5 ? 'landscape' : 'portrait');
        $dompdf->render();

        return (string) $dompdf->output();
    }

    /** @return list<string> */
    private function preamble(string $title, DateRange $range, ?Barangay $barangay): array
    {
        return [
            "My Care — {$title}",
            'Barangay: '.($barangay?->name ?? 'All barangays in scope'),
            "Period: {$range->from->toDateString()} to {$range->to->toDateString()} (Asia/Manila)",
            'Generated: '.CarbonImmutable::now(DateRange::timezone())->format('Y-m-d H:i').' (Asia/Manila)',
            'De-identified and aggregated. Any count below '.SuppressionRule::THRESHOLD.' is shown as "'.SuppressionRule::MASK.'".',
        ];
    }
}
