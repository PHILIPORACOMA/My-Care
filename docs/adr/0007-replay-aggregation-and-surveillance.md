# ADR-0007: Engine replay, aggregation, and the surveillance read paths

## Status

Accepted 2026-09-17. Implemented in `apps/api` and `packages/engine-replay`,
verified against MySQL 8 — Pest 174 passed, 708 assertions; engine-replay 5/5.
**No manuscript amendment.**

## Context

The sub-admin portal (Figures 31–35) and the super-admin health screens
(Figures 37, 40) need counts of sessions by tier, symptom, barangay and day.
`AGGREGATE_STAT` (Table 23) holds them, but something has to compute them —
and **`TRIAGE_SESSION` (Table 13) has no `outcome_tier`**.

`SessionTierResolver` (Phase 3) derived a tier from stored columns: red-flag
answer → matched rule → `rhu`. It could not see an `is_override` severity
threshold, which leaves no trace in any column, so such a session read as `rhu`
even when the patient was told `emergency`. That was the Phase 4 tripwire: live
the moment a super-admin authored an override (UT-009, now possible). The
earlier proposed fix was an amendment adding `outcome_tier`. That is now off the
table.

## Decision

### 1. Recover the tier by replaying the real engine (Philipo's decision)

Everything `evaluate()` needs is stored: the non-negated symptom codes
(`SESSION_SYMPTOM`), the clarification answers (`CLARIFICATION_ANSWER`, joined
to their `question_key`), and the ruleset version (`TRIAGE_SESSION.ruleset_version_id`)
— whose content never changes after it is written (ADR-0006). The engine is
deterministic. So the server runs **the same `evaluate()` the patient's phone
ran**, over the same inputs and the same rules, and gets the same tier. Every
resolution path is exact, including override thresholds and red flags.

- `packages/engine-replay` is a thin Node CLI around `@mycare/triage-engine`
  (bundled with esbuild to `dist/replay.mjs`). It reads a JSON request on stdin
  and writes results to stdout. The engine package itself is untouched and
  stays pure.
- `Domain/Triage/EngineReplayer` (PHP) builds the requests in chunks and runs
  the CLI through `Process`.
- **If Node or the script is missing, it throws.** A dashboard built on guessed
  tiers is worse than one that refuses to refresh. System Health shows the
  replay service as down.
- Rejected: a PHP port of the engine (two implementations to keep in step — the
  thing the purity rule exists to prevent), and blocking override authoring
  (UT-009 would be incomplete).

`SessionTierResolver` and its test are deleted; `EngineReplayTest` replaces
them, including a test for exactly the override case the resolver got wrong.

**Integrity signal.** Each replay is compared with the rule the device reported.
A disagreement means a buggy or tampered client, or content the server does not
have. The replayed tier is still used (it comes from the published rules), the
count is logged and shown on System Health.

**Deployment consequence:** the server needs Node 20 and a built
`dist/replay.mjs`. Recorded in the deployment guide.

### 2. Aggregation rebuilds a window, idempotently

`php artisan mycare:aggregate` (scheduled every ten minutes, last 60 days)
replays every session in the window and writes daily rows per barangay: total,
by tier, by symptom, symptom × tier, by language. The window is deleted and
rewritten in one transaction, so reruns never double-count and late uploads from
devices offline for weeks land in the right day.

A **day is an Asia/Manila calendar day.** Timestamps stay UTC in storage
(non-negotiable #6); only the bucket boundary is local, because a health
worker's Tuesday is a Manila Tuesday. A test pins that 17:30 UTC counts on the
next Manila day.

Counts are stored raw; suppression is read-time only.

### 3. Every read path is suppressed and scoped, through the single implementations

- `SuppressionRule` gains `cell()` — the API shape
  `{display, suppressed, value}` where **`value` is null when suppressed**, so a
  client cannot recover a masked count by ignoring `display` — and
  `partition()`, **complementary suppression**: when exactly one part of a
  displayed total is masked, the smallest remaining part is masked too, so
  subtraction cannot reveal it (total 13, home 7, rhu 5 → emergency would be 1).
  Still one class, still the only place the threshold lives.
- `AggregateReader` starts every query from `BarangayScope`. A sub-admin asking
  for another barangay by id receives nothing, not that barangay's data.
- Rankings (top symptoms) include only displayable buckets; ordering masked
  buckets against each other would leak their relative size.
- Reports list every symptom code, including ones that never occurred, so a
  `<5` does not reveal that a symptom was seen at all.
- Reports have no all-barangay total row beneath per-barangay rows.

**Accepted limit:** complementary suppression is applied within one partition.
A determined reader combining several different breakdowns over overlapping
ranges could still narrow some ranges. Full disclosure control across queries
is beyond a capstone; the limit is written down rather than hidden.

### 4. Cluster detection is a documented heuristic

Figure 32 promises a banner that "flags statistically unusual rises". This
week's count is compared with the mean of the previous four weeks; a series is
flagged when this week is at least 5 (so a flag never points at a masked
bucket), at least 20% above the mean, and has a Poisson upper-tail probability
below 0.05. Week-over-week percentages are shown only when both weeks are
displayable. The parameters live in `config/mycare.php` and **need review by
the City Health Office** before anyone acts on a banner.

### 5. Reports and the audit export

CSV or PDF (dompdf), stored under `storage/app/private/reports`, one `REPORT`
row each (so every export is audited as a data export). A sub-admin's report is
always their own barangay; asking for another is refused, and downloading
another barangay's report returns 404. The audit log export (super-admin only)
replaces staff emails with `role #id` and removes attempted login addresses —
Figure 41's "exported in de-identified form".

### 6. Where the figures could not be followed exactly

- **Figure 33/40's pending upload queue** is reported by devices in a header
  (ADR-0005), so it is "not reported" until a device checks in.
- **Figure 37's "report worker"** does not exist: reports are generated in the
  request and the only background job is aggregation. The service panel shows
  the database, engine replay and the aggregation job instead.
- **Figure 41's audit categories** are derived from the table and action, since
  `AUDIT_LOG` has no category column.

## Traceability

- UT-014 → `tests/Feature/Staff/SurveillanceTest.php` ("reports last sync…")
- UT-016 → `SurveillanceTest` ("shows a sub-admin only their own barangay…"),
  `ReportTest` ("refuses a sub-admin another barangay's report…")
- UT-017 → `SurveillanceTest` ("shows correct tier counts and top symptoms")
- UT-018 → `tests/Feature/Staff/ReportTest.php`
- UT-020 read paths → `SurveillanceTest` ("never sends a raw count under 5…"),
  `tests/Unit/SuppressionRuleTest.php`
- Replay → `tests/Feature/Aggregation/EngineReplayTest.php`,
  `packages/engine-replay/src/replay.test.ts`
- Aggregation → `tests/Feature/Aggregation/AggregationTest.php`
