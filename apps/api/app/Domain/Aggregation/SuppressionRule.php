<?php

namespace App\Domain\Aggregation;

use InvalidArgumentException;

/**
 * The single implementation of the small-cell suppression rule (UT-020).
 *
 * Any aggregate bucket below 5 renders as "<5" rather than as its true count,
 * so that a figure can never identify an individual in a small barangay. Every
 * aggregate read path — dashboard, trends, map, CSV, PDF — must call this.
 * Never reimplement the comparison inline: a second copy is a second place for
 * the threshold to drift, and the failure is silent and unrecoverable, because
 * a report that leaked a count of 2 has already been distributed.
 *
 * Suppression is applied at read time only. AGGREGATE_STAT stores raw counts,
 * because the same bucket may clear the threshold when re-aggregated over a
 * wider period, and a pre-suppressed store could never recover that.
 */
final class SuppressionRule
{
    /** Counts strictly below this are suppressed. */
    public const THRESHOLD = 5;

    /** What a suppressed bucket renders as. */
    public const MASK = '<5';

    private function __construct()
    {
        // Static-only: there is nothing to configure, and a configurable
        // threshold is exactly what this class exists to prevent.
    }

    public static function isSuppressed(int $count): bool
    {
        self::guard($count);

        return $count < self::THRESHOLD;
    }

    /**
     * Render a count for display. Returns "<5" when suppressed, otherwise the
     * count as a string.
     *
     * Note that a true zero also renders as "<5". That is deliberate: the rule
     * is "any bucket under 5", and showing a bare 0 discloses the absence of
     * cases just as a 1 discloses their presence.
     */
    public static function render(int $count): string
    {
        return self::isSuppressed($count) ? self::MASK : (string) $count;
    }

    /**
     * Render a keyed set of counts in one pass, for a dashboard row or an
     * export column.
     *
     * @param  array<array-key, int>  $counts
     * @return array<array-key, string>
     */
    public static function renderMany(array $counts): array
    {
        return array_map(static fn (int $count): string => self::render($count), $counts);
    }

    private static function guard(int $count): void
    {
        if ($count < 0) {
            throw new InvalidArgumentException(
                "Aggregate counts cannot be negative; got {$count}. A negative count means the "
                .'aggregation query is wrong, and suppressing it would hide that bug.'
            );
        }
    }
}
