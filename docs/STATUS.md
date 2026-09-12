# Development status checkpoint

Last updated: 2026-09-12. **Phase 3 is complete for devices** — schema,
device-facing endpoints, and audit observers all run green against real MySQL 8.
What is left of Phase 3 is staff-facing, and blocked on the auth decision.
Update this file at the end of any session that changes phase status, adds a
major decision, or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `docs/STATUS.md`, `docs/REPO.md`, `docs/adr/0001-triage-resolution.md`,
> `docs/ut-matrix.md`, `docs/data-dictionary.md`, and
> `docs/adr/0003-device-api-and-sync-contract.md` before doing anything else.
> Phase 3's schema and device-facing endpoints are done and verified; staff
> endpoints are blocked on the JWT-vs-Sanctum decision. Tell me what you
> understand the current state to be and wait for direction — don't start new
> work yet.

## What this is

Offline-first PWA performing deterministic health triage on-device, in
Cebuano and Filipino, for geographically isolated barangays in Carcar
City, Cebu. BS Information Technology capstone; the manuscript is the
specification.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo, CI, conventions | ✅ workspaces + two CI workflows: `engine-purity` and `api`, **both green on PR #1**. Note both trigger only on `push` to `main` or on `pull_request` — a feature-branch push alone runs nothing. |
| 1 | Triage engine + ruleset schema | ✅ |
| 2 | Ruleset v1 from the Clinical Appraisal Form | ✅ 23 presentations encoded and tested; ⚠️ **not yet clinician-reviewed** |
| 3 | Laravel API + 20 migrations | 🔨 **schema + device-facing endpoints done and verified.** Staff endpoints blocked on the auth decision (Phase 4) |
| 4 | Super-admin console | ⬜ not started |
| 5 | Patient PWA | ⬜ not started |
| 6 | Offline sync layer | ⬜ not started |
| 7 | Sub-admin dashboard | ⬜ not started |
| 8 | Integration + offline E2E | ⬜ not started |
| 9 | Deployment | ⬜ not started |

## What's built and verified

Phases 0–2 (unchanged, re-verified 2026-09-09):

- npm workspaces (`packages/*`), shared `tsconfig.base.json`.
- `packages/ruleset`: `src/schema.ts`, `src/bundle/v1.ts` (23 presentations:
  6 home / 8 rhu / 9 emergency).
- `packages/triage-engine`: `evaluate(input, bundle)`, zero runtime
  dependencies. **12/12 tests pass, typecheck clean, purity check passes.**
- `docs/adr/0001-triage-resolution.md`, `docs/ut-matrix.md`, `docs/REPO.md`.

Phase 3 schema — **verified by execution, not just written**:

- `apps/api` on **Laravel 13.30.1**, PHP 8.4.13, MySQL 8.
- **All 20 migrations run clean** from `migrate:fresh` (Tables 5–24).
- `RoleSeeder` seeds the two staff roles. `DeviceSeeder` exists for local
  development and is deliberately **not** in the default chain — `migrate
  --seed` must never mint a working API credential. Run it explicitly:
  `php artisan db:seed --class=DeviceSeeder`.
- **Pest: 70 passed, 249 assertions.**
- Confirmed directly in MySQL, not merely via test names:
  - **21 tables** = the 20 Data Dictionary entities + Laravel's `migrations`.
    No `cache`, `jobs`, `sessions`, or `password_reset_tokens`.
  - **`audit_logs.created_at` is the only timestamp column in the database.**
  - Keys are `int unsigned`, not `bigint` — `increments()` behaved as intended.
  - `triage_sessions` has no `outcome_tier`, so derivation stays the only path.
- `app/Domain/Aggregation/SuppressionRule.php` (UT-020),
  `app/Domain/Audit/Recorder.php`, `app/Domain/Triage/SessionTierResolver.php`.
- 20 Eloquent models, all `$timestamps = false`.

Phase 3 endpoints — **device-facing only** (2026-09-12):

- `GET /api/v1/ruleset/current` and `POST /api/v1/sync/batches`, both behind
  `AuthenticateDevice` (`DEVICE.api_token`). Sanctum is **not** installed and
  `php artisan install:api` must not be run — it would add a token table the
  dictionary lacks and pre-empt the Phase 4 auth decision.
- `Domain/Ruleset/BundleAssembler` — the single translation point between the
  snake_case columns and the camelCase `RulesetBundle` contract.
- `Domain/Sync/BatchIngestor` — idempotent, one transaction per batch.
- `Observers/AuditableObserver` on 14 configuration models.
- `packages/ruleset` gained `healthTips`; engine still 12/12, purity clean.

Full reasoning: `docs/adr/0003-device-api-and-sync-contract.md`.

Branch `feat/UT-020-laravel-api-schema`, **PR #1 open**: `ec1246e` (scaffold +
schema), `116865c` (index-name fix), `538b399` (credentials out of phpunit.xml),
then the Phase 3 documentation set and the endpoints.

## Environment notes (needed to run this on a fresh machine)

- **`pdo_mysql` must be enabled in `D:\php-8.4.13\php.ini`.** It was not, though
  the DLL was present — and `pdo_sqlite` *was* enabled. Added
  `extension=pdo_mysql`; backup at `php.ini.bak-20260909`. That PHP install is
  shared with another project (its php.ini comment reads "SQLite is used for
  local dev/tests; pgsql for production"), so the change was additive.
- MySQL 8 service `MySQL80`, user `root`. Schemas `mycare` and `mycare_test`
  exist.
- **Credentials live only in `apps/api/.env` and `apps/api/.env.testing`, both
  gitignored.** `phpunit.xml` is tracked and deliberately carries no username or
  password; it keeps `DB_DATABASE=mycare_test` as a guard so a test run cannot
  reach the dev schema. CI must supply `DB_USERNAME`/`DB_PASSWORD` as env vars.

## Key decisions made (and why)

Carried forward:

- **Resolution precedence** (ADR-0001): red-flag clarification → `is_override`
  threshold → highest tier among matches (priority breaks ties) → `rhu`
  fail-safe, never `home`.
- **`@mycare/ruleset` is a type-only `devDependency`** of `triage-engine`.
- **v1 bundle is a literal 1-symptom-code-to-1-rule encoding** — clinical
  grouping is the reviewer's job, not something to infer.
- **`CLARIFICATION_QUESTION.attribute` needs no column** — `question_key`
  doubles as the attribute name. Confirmed against the source: Table 10
  `RULE_CONDITION` *does* have `attribute VARCHAR(30) NULL`; Table 15 has none.
  **Closed.**
- **`triage-engine`'s test script points at an explicit file** — still needs a
  manual edit when a second test file is added there.

Phase 3:

- **Laravel 13, not 11.** Composer blocks every 11.x release behind 7 security
  advisories (EOL March 2026). The manuscript pins no Laravel version — Table 25
  says only `Backend Framework | Laravel` — so **no manuscript amendment was
  needed**. Chose 13 over 12 because 12's security window closes ~February 2027.
- **`created_at` added to AUDIT_LOG (Table 19)** — approved. Framed as
  correcting an internal contradiction: Figure 41's own text says each entry is
  "stamped with the responsible actor and timestamp". `new_value` was considered
  and **rejected** — the version-scoped ruleset tables already serve the
  reconstruction claim.
- **No `outcome_tier` on TRIAGE_SESSION; the tier is derived** by
  `SessionTierResolver` (red flag → matched rule → `rhu`). Exact for the v1
  bundle, which ships no severity thresholds. See the Phase 4 tripwire below.
- **Strict Data Dictionary adherence: no `timestamps()` anywhere.** Verified in
  the live schema.
- **`increments()` / `unsignedInteger()`, not `id()`** — the dictionary says
  `INT`; Laravel's `id()` is `BIGINT`.
- **SQLite removed outright** from `config/database.php`; `SchemaTest` asserts
  the driver is `mysql`.
- **`USER.password_hash` kept** over Laravel's `password`; `User` overrides
  `getAuthPassword()` rather than renaming a manuscript column.
- **Table names are Laravel-plural**; the dictionary names entities, not tables.
  Columns match one-to-one.
- **Pest 5 + PHPUnit 13**, because CLAUDE.md's documented command is
  `./vendor/bin/pest`.
- **Laravel's bundled `CLAUDE.md`/`AGENTS.md` were deleted** from `apps/api` —
  they instruct agents to install `laravel/boost`.

## Known gaps / open items

Carried forward:

- The v1 ruleset bundle has **not** been through clinician review. Every tier in
  `packages/ruleset/src/bundle/v1.ts` is draft.
- The lexicon/NLP layer doesn't exist. UT-003, UT-004 pending.
- `apps/pwa`, `apps/portal`, `apps/console` are still empty.
- ~~The `api` workflow has never actually run.~~ **Resolved 2026-09-12 — it
  ran and passed on its first attempt** (PR #1, 49s): migrations applied,
  `RoleSeeder` ran, **Pest 35 passed / 124 assertions** (the count at that
  commit; it is 70/249 now) on a MySQL 8 service
  container, matching the local result exactly. The two parts flagged as
  risky — the MySQL handshake and the `.env`/`phpunit.xml` precedence — both
  worked; the log confirms `DB_DATABASE: mycare_test` and
  `Creating database mycare_test`.
- **Both workflows trigger only on `push` to `main` or on `pull_request`.** A
  feature-branch push alone runs nothing, which is why nothing had ever run
  against this branch before PR #1 was opened. If per-push feedback on feature
  branches is wanted, both need their `push.branches` filter widened — a
  deliberate choice, currently set narrow.
- CI emits a deprecation warning: `actions/checkout@v4` and `actions/cache@v4`
  target Node.js 20, which GitHub runners now force onto Node 24. Harmless
  today; bump both to `@v5` when convenient. `engine-purity` uses the same
  pinned actions.
- `docs/REPO.md` and `docs/ut-matrix.md` cite table numbers by hand.
- **`RULE_CONDITION` (Table 10) has no sequence column, but condition order is
  semantically load-bearing.** Each condition's `operator` says how it combines
  with the ones before it, so reordering a rule's conditions can change the tier
  it produces. Insertion order — the primary key — is the only ordering the
  schema offers, and `BundleAssembler` sorts by `id` accordingly. Stable only
  while conditions are append-only. **A rule-authoring UI that lets a
  super-admin reorder them (Phase 4, UT-007) needs either a sequence column by
  amendment, or delete-and-reinsert semantics.** Found 2026-09-12 while building
  the bundle endpoint.
- **Nothing publishes the v1 bundle into the database.** `GET
  /api/v1/ruleset/current` returns 503 on a fresh install because no importer
  exists to write `packages/ruleset/src/bundle/v1.ts` into Tables 6–11/15/21.
  Phase 4 publish work.
- **`DEVICE.api_token` is stored and compared in plaintext.** Table 12 types it
  `VARCHAR(80)` with no hashing implied, and a hashed column cannot be looked up
  directly. Revisit in Phase 4 with staff auth — prefix-plus-hash fits the same
  width.
- `apps/api/composer.json` still carries the Laravel skeleton's
  `post-create-project-cmd` line that touches `database/database.sqlite`. Dead
  — it fires only on `composer create-project`, no such file exists, and the
  sqlite connection is gone from `config/database.php` — but it reads as a
  contradiction of the no-SQLite rule. One line to delete.

Open, from the manuscript review:

- **Phase 4 tripwire — threshold-override tiers are unrecoverable.** ADR-0001
  step 2 (an `is_override` severity threshold) leaves no trace in
  TRIAGE_SESSION, so such a session derives to `rhu` even if it escalated to
  `emergency`. Unreachable today (v1 ships no thresholds); **becomes a live
  defect the first time a super-admin authors an override threshold (UT-009)**.
  Pinned by a deliberately-named test in `SessionTierResolverTest`. Fix is a
  manuscript amendment adding `outcome_tier` (ideally plus `resolution_source`)
  to Table 13 — decide when Phase 4 starts.
- ~~**`HEALTH_TIP` (Table 21) is not in the bundle contract.**~~ **Resolved
  2026-09-12.** `healthTips` was added to `packages/ruleset/src/schema.ts` and
  the bundle endpoint serves it, ordered by `display_order`. Tips are
  presentational only — a tip never influences a tier and `evaluate()` does not
  read the field. The v1 bundle ships `healthTips: []`: **tip content is medical
  guidance and still needs clinical review before anything is written.**
- **Staff auth has no token table.** No `personal_access_tokens` in the
  dictionary. Phase 4 must choose stateless JWT (no table, no amendment) or
  Sanctum (+1 table, amendment). Not decided.
- **Does a true zero suppress?** `SuppressionRule::render(0)` returns `<5`,
  following CLAUDE.md literally. Arguable either way — showing a bare 0
  discloses absence just as a 1 discloses presence. **Still needs your call.**
- **`FACILITY` still orphaned.** Table built as specified; wire-or-drop deferred
  to Phase 5.
- **Data Dictionary intro sentence is wrong** (manuscript ~line 482): says "only
  de-identified aggregates are synchronized", but Table 13 has
  `sync_batch_id`/`synced_at` and Table 22 has `session_count`. Session records
  sync. One-sentence manuscript fix, still owed.

**Manuscript edit still owed by Philipo** — add one row to Table 19, AUDIT_LOG:

```
 | created_at | Date Recorded | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes |  |
```

Approved 2026-09-04; the code already implements it. No ERD change needed — it
adds a non-key column and alters no relationship in Figure 42.

## Next steps

Documentation debt:

- ~~`docs/data-dictionary.md` — transcribe Tables 5–24 so no future session
  needs the 22 MB .docx.~~ **Done 2026-09-12.** All 20 entities transcribed
  verbatim from `My Care Manuscript (2).docx` (22.3 MB, modified 2026-08-19 —
  the authoritative revision; older copies in `~/Downloads` are stale). Table
  numbers taken from the manuscript's own List of Tables, not inferred.
  Transcription verified cell-for-cell against the .docx by script, and
  conformance-checked against the 20 migrations: **every entity matches
  column-for-column**, the only divergence being the approved
  `audit_logs.created_at`. The file also records the manuscript's own
  inconsistencies (`9999` vs `255` in the Format column, Table 13's
  `TIMESTAMP`, the `CLARIFICATIO_ANSWER` typo in the List of Tables) and
  carries a re-extraction snippet so it can be regenerated.
- ~~`docs/adr/0002-phase-3-schema-decisions.md` — the `created_at` amendment,
  the derive-don't-store tier decision, strict timestamp adherence,
  Laravel 13.~~ **Done 2026-09-12.** Those four are recorded as full decisions
  with their rejected alternatives (`new_value`, storing `outcome_tier`,
  Laravel 12); the smaller ones — `increments()` over `id()`, SQLite removed
  outright, `password_hash`, plural table names, read-time-only suppression,
  audit-writes-via-`Recorder`, Pest 5, credentials out of `phpunit.xml` — are
  recorded below them so the reasoning survives. Versions in the ADR were read
  from `composer.lock`, not from memory.
- ~~`docs/ut-matrix.md` — mark UT-015 and UT-020 as covered at the
  schema/domain level.~~ **Done 2026-09-12**, but not symmetrically, because
  the two are not at the same distance from their test case. **UT-020 is
  Implemented** at the domain level — the rule *is* the unit Table 31 names,
  and only its Phase 7 callers are missing. **UT-015 is only Partially
  implemented**: the UNIQUE indexes make double-counting impossible at the
  database and are asserted by real duplicate inserts, but Table 31 describes a
  retried *submission*, and the endpoint is not built — marking it done would
  claim an HTTP contract nothing has exercised. The Notes section now also
  flags that `it('suppresses a true zero as well')` is pinned to your undecided
  zero-suppression question.
- ~~`.github/workflows/api.yml` — PHP 8.4 + MySQL 8 service container, Pest,
  with `DB_USERNAME`/`DB_PASSWORD` supplied as env vars.~~ **Written
  2026-09-12, not yet run** (see Known gaps). A separate workflow from
  `engine-purity` on purpose, so the safety-critical engine job never waits on
  or flakes with a database it does not use. `DB_DATABASE=mycare_test` is set
  at job level too, because the standalone `artisan migrate:fresh --seed` step
  does not read `phpunit.xml` and `.env.example` points at `mycare`, which the
  service container does not create. An explicit migrate+seed step runs before
  Pest, since `RefreshDatabase` migrates but never invokes `RoleSeeder`.

**Documentation debt is clear.**

Phase 3 endpoints — ~~controllers and routes~~, ~~the idempotent sync
endpoint~~, ~~model observers wired to `Domain/Audit/Recorder`~~ — **all done
2026-09-12**, verified by **Pest 70 passed / 249 assertions** (was 35/124). See
`docs/adr/0003-device-api-and-sync-contract.md`.

What was built:

- `GET /api/v1/ruleset/current` — serves the latest **published** bundle, never
  a draft; 503 (not 404) when nothing is published. Deterministic assembly, so
  a version rebuilds byte-identically (Figure 41).
- `POST /api/v1/sync/batches` — idempotent on `client_batch_uuid`: **201**
  first, **200 with the original result** on replay, **never 409**. One
  transaction per batch. `attempt_count` increments on replay but is absent
  from the response, so it cannot change the answer a retry gets.
- `AuthenticateDevice` middleware on `DEVICE.api_token`, rejecting any device
  not both approved and active.
- `AuditableObserver` on 14 configuration models, with patient data, sync
  plumbing, derived data and `AUDIT_LOG` itself deliberately excluded.

**What Phase 3 does not have, and cannot until you decide:** any staff-facing
endpoint. Dashboard, trends, reports, rule authoring and account management all
need the JWT-vs-Sanctum call first.

Next, in the order they unblock things:

1. **Decide staff auth** (JWT vs Sanctum). Blocks Phases 4 and 7 entirely.
2. **A ruleset importer/publisher** — nothing currently gets
   `packages/ruleset/src/bundle/v1.ts` into Tables 6–11/15/21, so
   `GET /ruleset/current` returns 503 on a fresh install. Phase 4 publish work
   (UT-010, UT-011).
3. Phase 4 proper: the super-admin console.

## Commands to re-verify state

```bash
# Phases 1-2
npm install
npm test -w @mycare/triage-engine      # 12/12
npm run typecheck
npm run purity -w @mycare/triage-engine

# Phase 3
cd apps/api
composer install
php artisan migrate:fresh --seed --force
./vendor/bin/pest                      # 70 passed, 249 assertions
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`.
- **Working branch: `feat/UT-020-laravel-api-schema`**, ahead of `main` and
  pushed to `origin`. **PR #1 is open** and green on both workflows; not yet
  merged or reviewed. https://github.com/PHILIPORACOMA/My-Care/pull/1
- `main` is still at `9358811`.
- `apps/api/vendor/`, `apps/api/.env`, `apps/api/.env.testing` are gitignored.
- The project working-agreement file (`CLAUDE.md`) is intentionally
  **not committed** — don't assume a fresh clone has it.
