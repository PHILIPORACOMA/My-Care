<?php

namespace App\Console\Commands;

use App\Domain\Aggregation\Aggregator;
use App\Domain\Aggregation\DateRange;
use App\Domain\DomainActionException;
use Illuminate\Console\Command;

/**
 * Rebuilds AGGREGATE_STAT by replaying sessions through the triage engine.
 *
 * Scheduled every ten minutes (routes/console.php) over the last
 * `mycare.aggregation.rebuild_days` days, so late uploads from devices that
 * were offline for weeks are counted in the day they happened. Run it by hand
 * for a wider window:
 *
 *     php artisan mycare:aggregate --from=2026-01-01 --to=2026-09-17
 */
class Aggregate extends Command
{
    protected $signature = 'mycare:aggregate
        {--from= : First day to rebuild, YYYY-MM-DD (Asia/Manila)}
        {--to= : Last day to rebuild, YYYY-MM-DD (Asia/Manila)}';

    protected $description = 'Rebuild daily aggregate statistics from stored triage sessions';

    public function handle(Aggregator $aggregator): int
    {
        try {
            $range = ($this->option('from') === null && $this->option('to') === null)
                ? DateRange::lastDays((int) config('mycare.aggregation.rebuild_days'))
                : DateRange::fromInput($this->option('from'), $this->option('to'));
        } catch (DomainActionException $e) {
            foreach ($e->errors as $messages) {
                foreach ($messages as $message) {
                    $this->error($message);
                }
            }

            return self::FAILURE;
        }

        $summary = $aggregator->rebuild($range);

        $this->info("Rebuilt {$summary['from']} to {$summary['to']}: {$summary['sessions']} sessions, {$summary['rows']} rows.");

        if ($summary['replayFailures'] > 0) {
            $this->warn("{$summary['replayFailures']} sessions could not be replayed and were not counted.");
        }

        if ($summary['deviceDisagreements'] > 0) {
            $this->warn("{$summary['deviceDisagreements']} sessions replayed to a different rule than the device reported.");
        }

        return self::SUCCESS;
    }
}
