<?php

namespace App\Domain\Aggregation;

use App\Domain\Auth\BarangayScope;
use App\Models\AggregateStat;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Reads raw daily counts from AGGREGATE_STAT for one staff user.
 *
 * Every query starts from BarangayScope (UT-016), so a sub-admin can never read
 * another barangay's rows however the parameters are set. The values returned
 * here are RAW integers for the caller to compute with; nothing leaves the API
 * without passing through SuppressionRule first — the controllers and the
 * report generator are the read paths, and each one does.
 */
final class AggregateReader
{
    public const TIERS = ['home', 'rhu', 'emergency'];

    /**
     * Sessions per tier over the range.
     *
     * @return array{home: int, rhu: int, emergency: int}
     */
    public function tierTotals(User $user, DateRange $range, ?int $barangayId = null): array
    {
        $rows = $this->base($user, $range, $barangayId)
            ->whereNull('symptom_code_id')->whereNotNull('outcome_tier')->whereNull('language')
            ->groupBy('outcome_tier')
            ->selectRaw('outcome_tier, SUM(session_count) AS total')
            ->pluck('total', 'outcome_tier');

        $totals = [];
        foreach (self::TIERS as $tier) {
            $totals[$tier] = (int) ($rows[$tier] ?? 0);
        }

        return $totals;
    }

    /**
     * Sessions per symptom code over the range, highest first.
     *
     * @return array<string, int> code => count
     */
    public function symptomTotals(User $user, DateRange $range, ?int $barangayId = null, ?string $tier = null): array
    {
        $query = $this->base($user, $range, $barangayId)
            ->join('symptom_codes', 'symptom_codes.id', '=', 'aggregate_stats.symptom_code_id')
            ->whereNull('language');

        $tier === null ? $query->whereNull('outcome_tier') : $query->where('outcome_tier', $tier);

        return $query->groupBy('symptom_codes.code')
            ->selectRaw('symptom_codes.code AS code, SUM(session_count) AS total')
            ->orderByDesc('total')->orderBy('code')
            ->pluck('total', 'code')
            ->map(fn ($v): int => (int) $v)
            ->all();
    }

    /**
     * Per day, per tier.
     *
     * @return array<string, array{home: int, rhu: int, emergency: int}> date => tiers
     */
    public function dailyTiers(User $user, DateRange $range, ?int $barangayId = null): array
    {
        $rows = $this->base($user, $range, $barangayId)
            ->whereNull('symptom_code_id')->whereNotNull('outcome_tier')->whereNull('language')
            ->groupBy('period_start', 'outcome_tier')
            ->selectRaw('period_start, outcome_tier, SUM(session_count) AS total')
            ->get();

        $days = [];
        foreach ($range->dates() as $date) {
            $days[$date] = array_fill_keys(self::TIERS, 0);
        }

        foreach ($rows as $row) {
            $date = substr((string) $row->period_start, 0, 10);
            if (isset($days[$date])) {
                $days[$date][$row->outcome_tier] = (int) $row->total;
            }
        }

        return $days;
    }

    /**
     * Per symptom (optionally per symptom × tier), per day — cluster detection's input.
     *
     * @return array<string, array<string, int>> "code|tier-or-*" => [date => count]
     */
    public function dailySymptomSeries(User $user, DateRange $range, ?int $barangayId = null): array
    {
        $rows = $this->base($user, $range, $barangayId)
            ->join('symptom_codes', 'symptom_codes.id', '=', 'aggregate_stats.symptom_code_id')
            ->whereNull('language')
            ->groupBy('symptom_codes.code', 'outcome_tier', 'period_start')
            ->selectRaw('symptom_codes.code AS code, outcome_tier, period_start, SUM(session_count) AS total')
            ->get();

        $series = [];
        foreach ($rows as $row) {
            $key = $row->code.'|'.($row->outcome_tier ?? '*');
            $series[$key][substr((string) $row->period_start, 0, 10)] = (int) $row->total;
        }

        return $series;
    }

    /**
     * Sessions per barangay over the range.
     *
     * @return array<int, int> barangay_id => count
     */
    public function barangayTotals(User $user, DateRange $range): array
    {
        return $this->base($user, $range, null)
            ->whereNull('symptom_code_id')->whereNull('outcome_tier')->whereNull('language')
            ->groupBy('barangay_id')
            ->selectRaw('barangay_id, SUM(session_count) AS total')
            ->pluck('total', 'barangay_id')
            ->map(fn ($v): int => (int) $v)
            ->all();
    }

    /** When the aggregates were last rebuilt, if ever. */
    public function lastComputedAt(): ?string
    {
        $at = AggregateStat::max('computed_at');

        return $at === null ? null : \Carbon\CarbonImmutable::parse($at, 'UTC')->toIso8601String();
    }

    private function base(User $user, DateRange $range, ?int $barangayId): Builder
    {
        $query = AggregateStat::query()
            ->where('granularity', 'day')
            ->whereBetween('period_start', [$range->from->toDateString(), $range->to->toDateString()]);

        BarangayScope::apply($query, $user, 'aggregate_stats.barangay_id');

        if ($barangayId !== null) {
            $query->where('aggregate_stats.barangay_id', $barangayId);
        }

        return $query;
    }
}
