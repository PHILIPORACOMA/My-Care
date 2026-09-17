<?php

/*
|--------------------------------------------------------------------------
| My Care application settings
|--------------------------------------------------------------------------
|
| Nothing here is clinical. Clinical content lives in versioned ruleset
| tables and is authored in the console. These are operational settings.
|
*/

return [

    /*
    | A short build identifier shown on the System Dashboard (Figure 37),
    | e.g. a git commit or a release tag. Set by the deployment.
    */
    'version' => env('MYCARE_VERSION', 'dev'),

    /*
    | Engine replay (ADR-0007). The server replays stored sessions through the
    | real triage engine to recover each session's tier, because TRIAGE_SESSION
    | has no outcome_tier column. Build the script with:
    |
    |     npm run build -w @mycare/engine-replay
    */
    'replay' => [
        'node_binary' => env('MYCARE_NODE_BINARY', 'node'),
        'script' => env('MYCARE_REPLAY_SCRIPT', base_path('../../packages/engine-replay/dist/replay.mjs')),
        'timeout_seconds' => (int) env('MYCARE_REPLAY_TIMEOUT', 120),
        // Sessions per replay call; bounds memory on both sides.
        'chunk_size' => 2000,
    ],

    /*
    | Aggregation. Days are calendar days in the display timezone, because a
    | health worker's "Tuesday" is a Manila Tuesday. Timestamps stay UTC in
    | storage (CLAUDE.md non-negotiable #6); only the bucket boundary is local.
    */
    'aggregation' => [
        'timezone' => 'Asia/Manila',
        // How far back each scheduled run rebuilds. Devices may be offline for
        // weeks, so a late upload still lands in the right day.
        'rebuild_days' => (int) env('MYCARE_AGGREGATE_DAYS', 60),
    ],

    /*
    | Cluster detection on the Trends screen (Figure 32).
    |
    | A surveillance heuristic, not a diagnosis and not a validated outbreak
    | threshold. It flags a symptom or symptom-and-tier cluster when this week's
    | count is at least `min_count`, at least `min_increase` above the recent
    | weekly average, and unlikely under a Poisson model of that average
    | (p < `p_value`). These defaults should be reviewed with the City Health
    | Office's surveillance officer before anyone acts on a banner.
    */
    'clusters' => [
        'baseline_weeks' => 4,
        'min_count' => 5,
        'min_increase' => 0.20,
        'p_value' => 0.05,
    ],
];
