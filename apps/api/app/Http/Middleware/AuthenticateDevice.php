<?php

namespace App\Http\Middleware;

use App\Domain\Device\DeviceToken;
use App\Domain\Device\PendingQueueReport;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates an enrolled PWA installation against DEVICE.api_token
 * (Data Dictionary Table 12).
 *
 * This is deliberately not Sanctum. The dictionary has no token table, and
 * adding one would need a manuscript amendment; api_token is the credential the
 * manuscript already specifies for a device. A device is not an account, has no
 * role, and must never reach a staff endpoint (ADR-0003, ADR-0004).
 *
 * The column stores a lookup prefix and a SHA-256 digest, never the secret
 * itself — see Domain/Device/DeviceToken.
 *
 * A device is rejected unless it is both approved and active. Self-registered
 * devices are approved on registration (ADR-0005); `is_approved = false` is how
 * a super-admin revokes one, and it is audited.
 */
class AuthenticateDevice
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if ($token === null || $token === '') {
            return $this->deny('Device token missing.');
        }

        $device = DeviceToken::find($token);

        if ($device === null) {
            return $this->deny('Device token not recognised.');
        }

        if (! $device->is_approved) {
            return $this->deny('Device is not approved. It may have been revoked.', 403);
        }

        if ($device->status !== 'active') {
            return $this->deny("Device is not active (status: {$device->status}).", 403);
        }

        PendingQueueReport::record($device, $request->header(PendingQueueReport::HEADER));

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
