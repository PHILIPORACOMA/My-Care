<?php

namespace App\Http\Controllers\Api\V1\Staff;

use App\Domain\Audit\Recorder;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * Staff session authentication for apps/portal and apps/console.
 *
 * Sanctum in SPA (cookie) mode: the SPA calls GET /sanctum/csrf-cookie, then
 * POST /api/v1/staff/login, and is authenticated by a first-party session
 * cookie from then on. No token is issued and no personal_access_tokens table
 * exists — see docs/adr/0004-staff-authentication.md.
 */
class AuthController extends Controller
{
    /** Failed attempts allowed per email+IP before lockout. */
    private const MAX_ATTEMPTS = 5;

    private const DECAY_SECONDS = 60;

    public function __construct(private readonly Recorder $recorder)
    {
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (($guard = $this->requireSession($request)) !== null) {
            return $guard;
        }

        $credentials = $request->validated();
        $key = $this->throttleKey($request, $credentials['email']);

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);

            // The lockout itself is auditable: a burst of these is what a
            // brute-force attempt looks like from the inside.
            $this->recordAttempt('login_throttled', $credentials['email']);

            return response()->json([
                'message' => "Too many login attempts. Try again in {$seconds} seconds.",
            ], 429);
        }

        // USER.password_hash, not Laravel's `password`; the User model points
        // getAuthPassword() at it, so the standard guard works unmodified.
        // No remember-me: see User::getRememberTokenName().
        if (! Auth::attempt(
            ['email' => $credentials['email'], 'password' => $credentials['password']],
        )) {
            RateLimiter::hit($key, self::DECAY_SECONDS);
            $this->recordAttempt('login_failed', $credentials['email']);

            // Deliberately does not say whether the email exists. That
            // distinction is an account-enumeration oracle.
            return response()->json(['message' => 'Those credentials do not match our records.'], 422);
        }

        RateLimiter::clear($key);

        // Session fixation: the id the client held before authenticating must
        // not remain valid afterwards.
        $request->session()->regenerate();

        /** @var User $user */
        $user = Auth::user();

        $this->recorder->record(
            actionType: 'login',
            targetTable: 'users',
            targetId: $user->getKey(),
            actor: $user,
        );

        return response()->json(['user' => $this->profile($user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        if (($guard = $this->requireSession($request)) !== null) {
            return $guard;
        }

        /** @var User|null $user */
        $user = $request->user();

        if ($user !== null) {
            $this->recorder->record(
                actionType: 'logout',
                targetTable: 'users',
                targetId: $user->getKey(),
                actor: $user,
            );
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Signed out.']);
    }

    /** The authenticated account, for an SPA rehydrating on page load. */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json(['user' => $this->profile($user)]);
    }

    /**
     * What the SPA is told about the signed-in account.
     *
     * password_hash is absent — it is in the model's $hidden, and nothing here
     * reaches past that.
     *
     * @return array<string, mixed>
     */
    private function profile(User $user): array
    {
        $user->loadMissing(['role', 'barangay']);

        return [
            'id' => $user->getKey(),
            'email' => $user->email,
            'role' => $user->role?->name,
            'roleLabel' => $user->role?->label,
            // Null for a super-admin, who is unscoped; always set for a
            // sub-admin (UT-016). The SPA uses this to decide what to render,
            // but it is never the enforcement point — the server scopes every
            // query through Domain/Auth/BarangayScope regardless.
            'barangayId' => $user->barangay_id,
            'barangayName' => $user->barangay?->name,
        ];
    }

    /**
     * Records a login that did not succeed.
     *
     * **The actor is always null here, never the matched account.** Whoever
     * typed that password failed to prove they are the account holder, so
     * attributing the entry to them would put an action in a person's audit
     * trail that they did not perform — and the trail is worth less than
     * nothing if it can say that.
     *
     * `target_id` still names the account when the address matches one, so an
     * account under attack is visible; the attempted address is kept in
     * old_value either way, because a burst of unknown addresses is itself the
     * signal worth seeing. These are staff work addresses, never patient data.
     */
    private function recordAttempt(string $action, string $email): void
    {
        // recordUnattributed, not record(actor: null). The latter falls back to
        // Auth::user(), and this request may carry a valid session for a
        // different account — which would file the failed attempt under that
        // innocent account's name.
        $this->recorder->recordUnattributed(
            actionType: $action,
            targetTable: 'users',
            targetId: User::where('email', $email)->value('id'),
            oldValue: ['attempted_email' => $email],
        );
    }

    /**
     * Cookie-mode Sanctum only starts a session for requests it recognises as
     * first-party — which it decides from the Referer/Origin header against
     * SANCTUM_STATEFUL_DOMAINS. A browser SPA always sends one; a misconfigured
     * origin, or a curl call, sends none.
     *
     * Without this guard, such a request reaches $request->session() and dies
     * with a RuntimeException and a 500, which tells the operator nothing about
     * the actual problem. Returning the diagnosis is the whole point.
     */
    private function requireSession(Request $request): ?JsonResponse
    {
        if ($request->hasSession()) {
            return null;
        }

        return response()->json([
            'message' => 'Staff authentication requires a first-party session. This request carried no '
                .'Origin or Referer matching SANCTUM_STATEFUL_DOMAINS, so no session was started.',
        ], 400);
    }

    private function throttleKey(Request $request, string $email): string
    {
        return Str::transliterate(Str::lower($email).'|'.$request->ip());
    }
}
