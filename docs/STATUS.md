# Development status checkpoint

Last updated: 2026-09-09. **Phase 3's schema is built and verified** — the 20
migrations, the seed, and the Pest suite all run green against real MySQL 8.
Update this file at the end of any session that changes phase status, adds a
major decision, or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `docs/STATUS.md`, `docs/REPO.md`, `docs/adr/0001-triage-resolution.md`,
> and `docs/ut-matrix.md` before doing anything else. Phase 3's schema is done
> and verified; what remains is documentation debt and then the API endpoints.
> Tell me what you understand the current state to be and wait for direction —
> don't start new work yet.

## What this is

Offline-first PWA performing deterministic health triage on-device, in
Cebuano and Filipino, for geographically isolated barangays in Carcar
City, Cebu. BS Information Technology capstone; the manuscript is the
specification.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo, CI, conventions | ✅ workspaces + `engine-purity` CI. No API CI yet. |
| 1 | Triage engine + ruleset schema | ✅ |
| 2 | Ruleset v1 from the Clinical Appraisal Form | ✅ 23 presentations encoded and tested; ⚠️ **not yet clinician-reviewed** |
| 3 | Laravel API + 20 migrations | 🔨 **schema done and verified**; endpoints not started — see Next steps |
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
- `RoleSeeder` seeds the two staff roles.
- **Pest: 35 passed, 124 assertions.**
- Confirmed directly in MySQL, not merely via test names:
  - **21 tables** = the 20 Data Dictionary entities + Laravel's `migrations`.
    No `cache`, `jobs`, `sessions`, or `password_reset_tokens`.
  - **`audit_logs.created_at` is the only timestamp column in the database.**
  - Keys are `int unsigned`, not `bigint` — `increments()` behaved as intended.
  - `triage_sessions` has no `outcome_tier`, so derivation stays the only path.
- `app/Domain/Aggregation/SuppressionRule.php` (UT-020),
  `app/Domain/Audit/Recorder.php`, `app/Domain/Triage/SessionTierResolver.php`.
- 20 Eloquent models, all `$timestamps = false`.

Commits on `feat/UT-020-laravel-api-schema`: `ec1246e` (scaffold + schema),
`116865c` (index-name fix), `538b399` (credentials out of phpunit.xml).

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
- No CI beyond `engine-purity`.
- `docs/REPO.md` and `docs/ut-matrix.md` cite table numbers by hand.

Open, from the manuscript review:

- **Phase 4 tripwire — threshold-override tiers are unrecoverable.** ADR-0001
  step 2 (an `is_override` severity threshold) leaves no trace in
  TRIAGE_SESSION, so such a session derives to `rhu` even if it escalated to
  `emergency`. Unreachable today (v1 ships no thresholds); **becomes a live
  defect the first time a super-admin authors an override threshold (UT-009)**.
  Pinned by a deliberately-named test in `SessionTierResolverTest`. Fix is a
  manuscript amendment adding `outcome_tier` (ideally plus `resolution_source`)
  to Table 13 — decide when Phase 4 starts.
- **`HEALTH_TIP` (Table 21) is not in the bundle contract.** It is
  `ruleset_version_id`-scoped so it ships to devices, but `RulesetBundle` has no
  `healthTips` field. Ruleset-contract change; deferred to the publish endpoint.
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

Documentation debt (planned, not started):

- `docs/data-dictionary.md` — transcribe Tables 5–24 so no future session needs
  the 22 MB .docx.
- `docs/adr/0002-phase-3-schema-decisions.md` — the `created_at` amendment, the
  derive-don't-store tier decision, strict timestamp adherence, Laravel 13.
- `docs/ut-matrix.md` — mark UT-015 and UT-020 as covered at the schema/domain
  level. **This is now true and verified**, so it can be stated plainly.
- `.github/workflows/api.yml` — PHP 8.4 + MySQL 8 service container, Pest,
  with `DB_USERNAME`/`DB_PASSWORD` supplied as env vars.

Then the rest of Phase 3:

- Controllers and routes.
- The sync endpoint, idempotent on `client_batch_uuid` (a duplicate POST returns
  200 with the original result, never 409).
- Model observers wired to `Domain/Audit/Recorder`.

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
./vendor/bin/pest                      # 35 passed, 124 assertions
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`.
- **Working branch: `feat/UT-020-laravel-api-schema`**, ahead of `main`. Not yet
  merged; no PR opened.
- `main` is still at `9358811`.
- `apps/api/vendor/`, `apps/api/.env`, `apps/api/.env.testing` are gitignored.
- The project working-agreement file (`CLAUDE.md`) is intentionally
  **not committed** — don't assume a fresh clone has it.
