<?php

namespace App\Domain\Aggregation;

/**
 * The automated cluster-detection banner on Trends & Surveillance (Figure 32):
 * "flags statistically unusual rises".
 *
 * For one series (a symptom, or a symptom within a tier), it compares this
 * week's count with the average of the preceding weeks and flags a rise when:
 *
 *   1. this week's count is at least `min_count` — so a flag never draws
 *      attention to a bucket that suppression hides;
 *   2. it exceeds the recent weekly average by at least `min_increase`; and
 *   3. it is unlikely under a Poisson model of that average (upper-tail
 *      probability below `p_value`).
 *
 * This is a screening heuristic for a human to look at, not an outbreak
 * declaration, and the defaults in config/mycare.php need review by the City
 * Health Office. Pure: no database, no clock — testable in isolation.
 */
final class ClusterDetector
{
    /**
     * @param  list<int>  $weeks  Oldest first; the last element is the current week.
     * @return array{flagged: bool, changePercent: int|null, pValue: float|null}
     */
    public static function assess(array $weeks): array
    {
        $current = (int) end($weeks);
        $baseline = array_slice($weeks, 0, -1);
        $previous = $baseline === [] ? 0 : (int) end($baseline);

        // Week-over-week change is only stated when both weeks are displayable;
        // a percentage over a suppressed denominator would reveal it.
        $changePercent = (! SuppressionRule::isSuppressed($current) && ! SuppressionRule::isSuppressed($previous))
            ? (int) round(($current - $previous) / $previous * 100)
            : null;

        $config = config('mycare.clusters');

        if ($current < (int) $config['min_count'] || $baseline === []) {
            return ['flagged' => false, 'changePercent' => $changePercent, 'pValue' => null];
        }

        // A zero baseline would make any count infinitely surprising; half a
        // session a week is the floor.
        $mean = max(array_sum($baseline) / count($baseline), 0.5);
        $pValue = self::poissonUpperTail($current, $mean);

        $flagged = $current >= $mean * (1 + (float) $config['min_increase'])
            && $pValue < (float) $config['p_value'];

        return ['flagged' => $flagged, 'changePercent' => $changePercent, 'pValue' => $pValue];
    }

    /** P(X >= k) for X ~ Poisson(lambda). */
    public static function poissonUpperTail(int $k, float $lambda): float
    {
        if ($k <= 0) {
            return 1.0;
        }

        $term = exp(-$lambda);
        $cumulative = $term;

        for ($i = 1; $i < $k; $i++) {
            $term *= $lambda / $i;
            $cumulative += $term;
        }

        return max(0.0, 1.0 - $cumulative);
    }
}
