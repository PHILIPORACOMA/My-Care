<?php

namespace App\Domain\Device;

use App\Models\Device;
use Illuminate\Support\Str;

/**
 * Issues and verifies device credentials stored in DEVICE.api_token (Table 12).
 *
 * The column is VARCHAR(80) and the Data Dictionary implies no hashing, but a
 * plaintext bearer credential in the database means a leaked backup is a
 * working key to every enrolled handset. So the column holds a lookup prefix
 * and a digest instead of the secret:
 *
 *     plain token  (given to the device once):  a1b2c3d4e5f6.<48 random chars>
 *     stored value (DEVICE.api_token):          a1b2c3d4e5f6.<sha256 hex of the secret>
 *
 * 12 + 1 + 64 = 77 characters, inside the dictionary's 80. The prefix is what
 * makes the row findable — a digest cannot be searched for by value without the
 * secret, and a bcrypt-style salted hash could not be looked up at all. The
 * secret has 48 random alphanumeric characters (~285 bits), so an unsalted
 * SHA-256 is sufficient: this is a high-entropy key, not a human password.
 *
 * No schema change, and so no manuscript amendment: the column keeps its name,
 * type and width; only what is written into it changed.
 */
final class DeviceToken
{
    private const PREFIX_LENGTH = 12;

    private const SECRET_LENGTH = 48;

    /**
     * @return array{plain: string, stored: string}
     */
    public static function issue(): array
    {
        $prefix = Str::lower(Str::random(self::PREFIX_LENGTH));
        $secret = Str::random(self::SECRET_LENGTH);

        return [
            'plain' => $prefix.'.'.$secret,
            'stored' => self::stored($prefix, $secret),
        ];
    }

    /** Resolve a presented bearer token to its device, or null. */
    public static function find(string $plain): ?Device
    {
        $parts = explode('.', $plain, 2);

        if (count($parts) !== 2) {
            return null;
        }

        [$prefix, $secret] = $parts;

        // The prefix goes into a LIKE pattern, so it must never carry a
        // wildcard. Anything but the exact generated shape is simply unknown.
        if (! preg_match('/^[a-z0-9]{'.self::PREFIX_LENGTH.'}$/', $prefix) || $secret === '') {
            return null;
        }

        $device = Device::where('api_token', 'like', $prefix.'.%')->first();

        if ($device === null) {
            return null;
        }

        // Constant-time: the comparison must not leak how much of a guess matched.
        return hash_equals($device->api_token, self::stored($prefix, $secret)) ? $device : null;
    }

    private static function stored(string $prefix, string $secret): string
    {
        return $prefix.'.'.hash('sha256', $secret);
    }
}
