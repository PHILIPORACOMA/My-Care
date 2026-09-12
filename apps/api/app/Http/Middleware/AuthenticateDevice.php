<?php

namespace App\Http\Middleware;

use App\Models\Device;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates an enrolled PWA installation against DEVICE.api_token
 * (Data Dictionary Table 12).
 *
 * This is deliberately not Sanctum. The dictionary has no token table, and
 * adding one would need a manuscript amendment; api_token is the credential the
 * manuscript already specifies for a device. Staff authentication is a separate,
 * still-undecided question (Phase 4) and must not be built on top of this — a
 * device is not an account, has no role, and must never reach a staff endpoint.
 *
 * A device is rejected unless it is both approved and active. is_approved exists
 * precisely so that an enrolled-but-unvetted handset cannot push data into the
 * surveillance record before a super-admin has looked at it.
 *
 * KNOWN LIMIT: api_token is stored and compared in plaintext. The dictionary
 * types it VARCHAR(80) with no hashing implied, and a hashed column could not be
 * looked up directly. Revisit in Phase 4 alongside the staff-auth decision —
 * a prefix-plus-hash scheme would fit the same column width. Until then, treat
 * the token as a shared secret and never log it.
 */
class AuthenticateDevice
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if ($token === null || $token === '') {
            return $this->deny('Device token missing.');
        }

        $device = Device::where('api_token', $token)->first();

        if ($device === null) {
            return $this->deny('Device token not recognised.');
        }

        if (! $device->is_approved) {
            return $this->deny('Device is enrolled but not yet approved.', 403);
        }

        if ($device->status !== 'active') {
            return $this->deny("Device is not active (status: {$device->status}).", 403);
        }

        // Downstream controllers read the device from here rather than
        // re-querying it, so there is exactly one place the identity is
        // resolved.
        $request->attributes->set('device', $device);

        return $next($request);
    }

    private function deny(string $message, int $status = 401): Response
    {
        return response()->json(['message' => $message], $status);
    }
}
