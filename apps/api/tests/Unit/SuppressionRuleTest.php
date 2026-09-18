<?php

use App\Domain\Aggregation\SuppressionRule;

/**
 * UT-020 — Suppression Rule.
 *
 * Manuscript expected result: "Aggregate count for a symptom/barangay falls
 * below 5 -> Value is suppressed rather than displayed, per the less-than-5
 * privacy rule."
 *
 * No database and no Laravel boot: this is pure arithmetic on a privacy
 * boundary, and it should stay runnable even if everything else is broken.
 */
it('suppresses every count below the threshold', function (int $count) {
    expect(SuppressionRule::isSuppressed($count))->toBeTrue()
        ->and(SuppressionRule::render($count))->toBe('<5');
})->with([0, 1, 2, 3, 4]);

it('displays counts at or above the threshold', function (int $count) {
    expect(SuppressionRule::isSuppressed($count))->toBeFalse()
        ->and(SuppressionRule::render($count))->toBe((string) $count);
})->with([5, 6, 9, 47, 1000]);

it('treats 5 itself as safe to display, not suppressed', function () {
    // The rule is "under 5", so 5 is the first visible value. Off-by-one here
    // either leaks a 4 or needlessly hides a 5; both matter.
    expect(SuppressionRule::isSuppressed(4))->toBeTrue()
        ->and(SuppressionRule::isSuppressed(5))->toBeFalse();
});

it('suppresses a true zero as well', function () {
    // A bare 0 discloses the absence of cases just as a 1 discloses their
    // presence, so it renders masked like any other sub-threshold bucket.
    expect(SuppressionRule::render(0))->toBe('<5');
});

it('rejects a negative count instead of masking it', function () {
    // A negative count means the aggregation query is wrong. Suppressing it
    // would hide the bug behind a privacy mask.
    SuppressionRule::render(-1);
})->throws(InvalidArgumentException::class);

it('renders a keyed set in one pass, preserving keys', function () {
    $rendered = SuppressionRule::renderMany([
        'home' => 12,
        'rhu' => 4,
        'emergency' => 0,
    ]);

    expect($rendered)->toBe([
        'home' => '12',
        'rhu' => '<5',
        'emergency' => '<5',
    ]);
});

it('exposes the threshold as a constant so no caller hardcodes 5', function () {
    expect(SuppressionRule::THRESHOLD)->toBe(5)
        ->and(SuppressionRule::MASK)->toBe('<5');
});
