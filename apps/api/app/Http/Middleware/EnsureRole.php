<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gates a staff route on the authenticated user's role (Table 24).
 *
 * Used as `role:super_admin` or `role:super_admin,sub_admin`. Roles are
 * compared by ROLE.name, not by id — ids are seeded and would silently mean
 * something different on another installation.
 *
 * This checks *who you are*, not *what you may see*. Barangay scoping — a
 * sub-admin seeing only their own barangay's data (UT-016) — is a separate
 * concern handled by Domain/Auth/BarangayScope, because it filters rows rather
 * than allowing or denying a whole route.
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->loadMissing('role');

        if (! in_array($user->role?->name, $roles, strict: true)) {
            // 403, not 404: the account is known, the route exists, and the
            // answer is that this role may not use it. Hiding that behind a
            // 404 would make a legitimate permissions problem look like a bug.
            return response()->json([
                'message' => 'This account does not have access to that resource.',
            ], 403);
        }

        return $next($request);
    }
}
