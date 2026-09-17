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

    /**
     * A count as the API sends it: never the raw value when suppressed.
     *
     * `value` is null for a suppressed bucket, so a client cannot recover the
     * true count from the payload even if it ignores `display`. Charts plot
     * null as a gap and label it with `display`.
     *
     * @return array{display: string, suppressed: bool, value: int|null}
     */
    public static function cell(int $count): array
    {
        $suppressed = self::isSuppressed($count);

        return [
            'display' => $suppressed ? self::MASK : (string) $count,
            'suppressed' => $suppressed,
            'value' => $suppressed ? null : $count,
        ];
    }

    /**
     * Render the parts of a whole that is itself displayed — for example the
     * three tier counts under a total.
     *
     * Primary suppression alone is not enough here. If a total of 12 is shown
     * with home 7, rhu 5 and emergency "<5", anyone can subtract: emergency is
     * 0. So when exactly one part is suppressed, the smallest remaining part is
     * suppressed too ("complementary suppression"). With two parts masked the
     * difference only reveals their sum, not either count.
     *
     * Only applies across one partition. A reader combining several different
     * breakdowns of the same sessions could still narrow a range — an accepted,
     * documented limit (ADR-0007), not something this method claims to solve.
     *
     * @param  array<array-key, int>  $counts
     * @return array<array-key, array{display: string, suppressed: bool, value: int|null}>
     */
    public static function partition(array $counts): array
    {
        $suppressedKeys = array_keys(array_filter($counts, static fn (int $c): bool => self::isSuppressed($c)));

        if (count($suppressedKeys) === 1 && count($counts) > 1) {
            $visible = array_diff_key($counts, array_flip($suppressedKeys));
            asort($visible);
            $suppressedKeys[] = array_key_first($visible);
        }

        $cells = [];
        foreach ($counts as $key => $count) {
            $cells[$key] = in_array($key, $suppressedKeys, true)
                ? ['display' => self::MASK, 'suppressed' => true, 'value' => null]
                : self::cell($count);
        }

        return $cells;
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
