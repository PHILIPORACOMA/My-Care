<?php

namespace App\Domain\Aggregation;

use App\Domain\DomainActionException;
use Carbon\CarbonImmutable;

/**
 * An inclusive range of calendar days in the display timezone (Asia/Manila).
 *
 * Aggregates are bucketed by local day because that is the day a health worker
 * means. Storage stays UTC; conversion happens here and nowhere else.
 */
final class DateRange
{
    /** Longest range a dashboard or report may request. */
    public const MAX_DAYS = 366;

    private function __construct(public readonly CarbonImmutable $from, public readonly CarbonImmutable $to)
    {
    }

    public static function timezone(): string
    {
        return (string) config('mycare.aggregation.timezone');
    }

    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(self::timezone())->startOfDay();
    }

    /** The last $days days, ending today. */
    public static function lastDays(int $days): self
    {
        $today = self::today();

        return new self($today->subDays($days - 1), $today);
    }

    /**
     * From request strings (Y-m-d), defaulting to the last 30 days.
     *
     * @throws DomainActionException
     */
    public static function fromInput(?string $from, ?string $to): self
    {
        if ($from === null && $to === null) {
            return self::lastDays(30);
        }

        try {
            $start = CarbonImmutable::createFromFormat('!Y-m-d', (string) $from, self::timezone());
            $end = CarbonImmutable::createFromFormat('!Y-m-d', (string) $to, self::timezone());
        } catch (\Throwable) {
            $start = $end = false;
        }

        if ($start === false || $end === false) {
            throw DomainActionException::invalid(['from' => ['Dates must be YYYY-MM-DD, and both from and to are required.']]);
        }

        if ($end->lessThan($start)) {
            throw DomainActionException::invalid(['to' => ['The end date is before the start date.']]);
        }

        if ($start->diffInDays($end) + 1 > self::MAX_DAYS) {
            throw DomainActionException::invalid(['to' => ['A range can cover at most '.self::MAX_DAYS.' days.']]);
        }

        return new self($start, $end);
    }

    /** Start of the first day, in UTC, for querying stored timestamps. */
    public function startUtc(): CarbonImmutable
    {
        return $this->from->startOfDay()->utc();
    }

    /** Start of the day AFTER the last day, in UTC (exclusive bound). */
    public function endExclusiveUtc(): CarbonImmutable
    {
        return $this->to->addDay()->startOfDay()->utc();
    }

    public function days(): int
    {
        return (int) $this->from->diffInDays($this->to) + 1;
    }

    /** @return list<string> */
    public function dates(): array
    {
        $dates = [];
        for ($day = $this->from; $day->lessThanOrEqualTo($this->to); $day = $day->addDay()) {
            $dates[] = $day->toDateString();
        }

        return $dates;
    }

    /** @return array{from: string, to: string} */
    public function toArray(): array
    {
        return ['from' => $this->from->toDateString(), 'to' => $this->to->toDateString()];
    }
}
