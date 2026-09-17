<?php

use Illuminate\Support\Facades\Schedule;

/*
| Scheduled work. The server's cron must run `php artisan schedule:run` every
| minute (docs/DEPLOYMENT.md).
|
| Aggregation replays sessions through the triage engine and rebuilds the
| recent window of AGGREGATE_STAT. withoutOverlapping() keeps a slow run from
| stacking up behind itself.
*/
Schedule::command('mycare:aggregate')
    ->everyTenMinutes()
    ->withoutOverlapping(30);
