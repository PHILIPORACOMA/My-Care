<?php

namespace App\Domain\Facility;

use Closure;

/**
 * The one definition of a valid FACILITY (Table 20) contact number, shared by
 * the console editor and the CSV importer.
 *
 * The number is what the patient app's emergency "Call for help" button dials
 * (Figure 27), as a tel: link. A number that cannot be dialled leaves a
 * patient in an emergency pressing a button that does nothing, so it is
 * checked wherever a number enters the system, not only in one form:
 *
 * - digits, spaces, hyphens and brackets, with an optional leading "+";
 * - at least 3 digits (911 is the shortest real number);
 * - at most 30 characters, the column width in the Data Dictionary.
 *
 * It cannot check that the number reaches the right place. That is what the
 * console's confirmation step and the audit log are for.
 */
final class FacilityRules
{
    /** Common facility types. `type` stays free text (VARCHAR 30); these are suggestions. */
    public const SUGGESTED_TYPES = ['emergency_hotline', 'rhu', 'health_station', 'hospital'];

    /** @return list<mixed> */
    public static function contactNumber(): array
    {
        return ['string', 'max:30', self::dialable(...)];
    }

    public static function dialable(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            return;
        }

        if (preg_match('/^\+?[0-9() \-]+$/', $value) !== 1) {
            $fail('A phone number may contain only digits, spaces, hyphens, brackets and a leading +.');

            return;
        }

        if (preg_match_all('/[0-9]/', $value) < 3) {
            $fail('A phone number needs at least 3 digits.');
        }
    }
}
