<?php

namespace App\Domain\Auth;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The single implementation of barangay-scoped visibility (UT-016).
 *
 * A sub-admin sees only their assigned barangay's data; a super-admin sees
 * everything. USER.barangay_id being nullable is what encodes the difference
 * (Table 17): null means unscoped.
 *
 * Every staff read path that touches barangay-bearing data must call this, for
 * the same reason every aggregate read path must call SuppressionRule: a second
 * copy of the rule is a second place for it to drift, and the failure is
 * silent. A sub-admin shown another barangay's counts has been handed data they
 * were never cleared for, and nothing in the response says so.
 *
 * Deliberately not a global Eloquent scope. A global scope applies invisibly
 * and would also filter the aggregation jobs and the device sync path, which
 * legitimately operate across all barangays. Making the call explicit means a
 * reviewer can see, at each query, whether scoping was applied on purpose.
 */
final class BarangayScope
{
    /**
     * Constrain a query to what this user may see.
     *
     * @param  string  $column  The barangay foreign key on the table being queried.
     */
    public static function apply(Builder $query, User $user, string $column = 'barangay_id'): Builder
    {
        if (self::isUnscoped($user)) {
            return $query;
        }

        return $query->where($column, $user->barangay_id);
    }

    /**
     * A super-admin is unscoped. Note this is decided by role, not by whether
     * barangay_id happens to be null: a sub-admin with no barangay assigned is
     * a misconfigured account, and must see nothing rather than everything.
     */
    public static function isUnscoped(User $user): bool
    {
        $user->loadMissing('role');

        return $user->role?->name === 'super_admin';
    }

    /**
     * The barangay ids a user may see, or null for unscoped.
     *
     * @return list<int>|null
     */
    public static function visibleBarangayIds(User $user): ?array
    {
        if (self::isUnscoped($user)) {
            return null;
        }

        return $user->barangay_id === null ? [] : [$user->barangay_id];
    }
}
