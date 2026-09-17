<?php

namespace App\Domain\Device;

use App\Models\Device;
use Illuminate\Support\Facades\Cache;

/**
 * How many completed sessions each device says it is still holding offline.
 *
 * Figures 33 and 40 show "the size of the pending upload queue". That number
 * only exists on the handset, and the Data Dictionary has no column for it —
 * SYNC_BATCH rows exist only for uploads that arrived. Rather than add one
 * (an amendment), a device reports its queue size in an `X-Pending-Sessions`
 * header on every authenticated request, and the server keeps the latest value
 * in the cache.
 *
 * It is deliberately transient: a monitoring hint, not a record. If the cache is
 * cleared the dashboards show "not reported" until each device next checks in,
 * which is the honest answer. It carries a count only — never session content.
 */
final class PendingQueueReport
{
    public const HEADER = 'X-Pending-Sessions';

    /** Reports older than this are treated as unknown. */
    private const TTL_SECONDS = 14 * 24 * 60 * 60;

    /** Anything above this is a client bug, not a real queue. */
    private const MAX_REPORTED = 100_000;

    public static function record(Device $device, ?string $headerValue): void
    {
        if ($headerValue === null || ! ctype_digit($headerValue)) {
            return;
        }

        $count = min((int) $headerValue, self::MAX_REPORTED);

        Cache::put(self::key($device->getKey()), $count, self::TTL_SECONDS);
    }

    /** Null means the device has not reported recently. */
    public static function forDevice(int $deviceId): ?int
    {
        $value = Cache::get(self::key($deviceId));

        return $value === null ? null : (int) $value;
    }

    private static function key(int $deviceId): string
    {
        return "device-pending-sessions:{$deviceId}";
    }
}
