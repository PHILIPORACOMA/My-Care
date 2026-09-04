# Development status checkpoint

Last updated: 2026-09-04, mid-Phase 3. The Laravel API is scaffolded and the
20 Data Dictionary migrations are written, but **nothing in `apps/api` has been
executed yet** — see "Not verified" below before trusting any of it. Update this
file at the end of any session that changes phase status, adds a major decision,
or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `docs/STATUS.md`, `docs/REPO.md`, `docs/adr/0001-triage-resolution.md`,
> and `docs/ut-matrix.md` before doing anything else. Phase 3 is mid-flight and
> unverified — I need to give you the MySQL root password before anything in
> `apps/api` can run. Tell me what you understand the current state to be and
> wait for direction.

## What this is

Offline-first PWA performing deterministic health triage on-device, in
Cebuano and Filipino, for geographically isolated barangays in Carcar
City, Cebu. BS Information Technology capstone; the manuscript is the
specification.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo, CI, conventions | ✅ workspaces + `engine-purity` CI wired. No other CI yet. |
| 1 | Triage engine + ruleset schema | ✅ |
| 2 | Ruleset v1 from the Clinical Appraisal Form | ✅ 23 presentations encoded and tested; ⚠️ **not yet clinician-reviewed** |
| 3 | Laravel API + 20 migrations | 🔨 **in progress, unverified** — scaffold + 20 migrations + 20 models + 3 domain classes + 4 test files written; none of it run |
| 4 | Super-admin console | ⬜ not started |
| 5 | Patient PWA | ⬜ not started |
| 6 | Offline sync layer | ⬜ not started |
| 7 | Sub-admin dashboard | ⬜ not started |
| 8 | Integration + offline E2E | ⬜ not started |
| 9 | Deployment | ⬜ not started |

## ⛔ First thing next session

**`apps/api` has never been run.** The session ended before verification. In
order:

1. **MySQL root password needed.** `mysql -u root` fails with
   `ERROR 1045 (28000): Access denied`. The databases `mycare` and `mycare_test`
   do not exist yet. Provide the password (or a dedicated user) and set
   `DB_PASSWORD` in `apps/api/.env`.
2. Create both schemas, then run `php artisan migrate` and `./vendor/bin/pest`.
3. **Expect failures.** 20 migrations, 20 models and 4 test files were written
   in one pass without a single execution. Treat the first green run as the
   real end of Phase 3, not the file count.

**Manuscript edit owed by Philipo (not code):** add one row to Table 19,
AUDIT_LOG, in the .docx:

```
 | created_at | Date Recorded | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes |  |
```

Approved this session. Rationale below. No ERD change needed — it adds a
non-key column and alters no relationship in Figure 42.

## What's built and verified

Phases 0–2, unchanged from the previous checkpoint:

- npm workspaces (`packages/*`), shared `tsconfig.base.json`.
- `packages/ruleset`: `src/schema.ts`, `src/bundle/v1.ts` (23 presentations:
  6 home / 8 rhu / 9 emergency).
- `packages/triage-engine`: `evaluate(input, bundle)`, zero runtime
  dependencies, 12 passing tests, `scripts/check-purity.mjs` + CI.
- `docs/adr/0001-triage-resolution.md`, `docs/ut-matrix.md`, `docs/REPO.md`.
- Committed and pushed to `origin/main` (`56c0588`, `9358811`).

Verified *this* session:

- **The full Data Dictionary was read for the first time.** Extracted from
  `My Care Manuscript (2).docx` — all 20 entities, Tables 5–24. A plain-text
  dump lives in the scratchpad only; `docs/data-dictionary.md` is **not yet
  written** (see Next steps).
- **`packages/ruleset/src/schema.ts` has zero drift** against Tables 6–11 and
  15. Every field matches. Nothing in Phases 1–2 needs correcting.
- **Laravel 11 is uninstallable.** Composer blocks every version `v11.0.0`–
  `v11.56.1` behind 7 published security advisories; Laravel 11 went EOL for
  security fixes in March 2026. Confirmed by dry-run: 11 blocked, 12 clean,
  13 clean.
- `apps/api` scaffolded — `php artisan --version` reports **Laravel Framework
  13.30.1** on PHP 8.4.13.
- Pest 5 + PHPUnit 13 installed, advisory-clean.

## Not verified — written this session but never executed

Everything below is **unrun code**. No lint, no migration, no test.

- `apps/api/database/migrations/` — 20 migrations,
  `2026_09_04_000101`–`000120`, ordered by FK dependency.
- `apps/api/app/Models/` — 20 Eloquent models, all `$timestamps = false`.
- `apps/api/app/Domain/Aggregation/SuppressionRule.php` — the single `<5`
  implementation (UT-020).
- `apps/api/app/Domain/Audit/Recorder.php` — the only writer to `audit_logs`.
- `apps/api/app/Domain/Triage/SessionTierResolver.php` — derives a stored
  session's tier per ADR-0001 precedence.
- `apps/api/tests/` — `Unit/SuppressionRuleTest.php` (no DB),
  `Feature/SchemaTest.php`, `Feature/AuditRecorderTest.php`,
  `Feature/SessionTierResolverTest.php`, plus `Pest.php`.
- `apps/api/database/seeders/RoleSeeder.php` — the two staff roles only.
- Config: `config/database.php` (MySQL-only), `phpunit.xml` (MySQL testing),
  `.env.example`, `.env` (key generated).

## Key decisions made (and why)

Carried forward from earlier sessions:

- **Resolution precedence** (ADR-0001): red-flag clarification → `is_override`
  threshold → highest tier among matching rules → `rhu` fail-safe, never `home`.
- **`@mycare/ruleset` is a type-only `devDependency`** of `triage-engine`.
- **v1 bundle is a literal 1-symptom-code-to-1-rule encoding** — clinical
  grouping is the reviewer's job, not something to infer.
- **`CLARIFICATION_QUESTION.attribute` gap resolved without a schema change** —
  `question_key` doubles as the attribute name. **Now confirmed against the
  source:** Table 10 `RULE_CONDITION` *does* have `attribute VARCHAR(30) NULL`,
  and Table 15 has none. The convention holds. This item is closed.
- **Test script points at an explicit file** in `triage-engine` — still needs a
  manual edit when a second test file is added there.

New this session:

- **Laravel 13, not Laravel 11.** Forced by the advisory block above. Note the
  manuscript does *not* pin a Laravel version — Table 25 says only
  `Backend Framework | Laravel`, so **no manuscript amendment is needed**; the
  "Laravel 11" constraint existed only in CLAUDE.md. Chose 13 over 12 because
  Laravel 12's security window closes around February 2027, which risks hitting
  this identical wall mid-capstone; 13 is supported into 2028.
- **`created_at` added to AUDIT_LOG (Table 19).** Framed as correcting an
  internal contradiction rather than adding a feature: the manuscript's own
  Figure 41 text already says each entry is "stamped with the responsible actor
  and timestamp", and a log that cannot be ordered in time is not an audit
  trail. `new_value` was considered and **deliberately not added** — Figure 41's
  reconstruction claim is served by the version-scoped ruleset tables, so
  `old_value` alone suffices.
- **No `outcome_tier` on TRIAGE_SESSION; the tier is derived.** Table 13 is
  built exactly as written. `SessionTierResolver` reconstructs the tier:
  red-flag answer → `emergency`; else matched rule → its tier; else `rhu`.
  This is exact for the v1 bundle, which ships zero severity thresholds and
  zero clarification questions. See the Phase 4 tripwire below.
- **Strict Data Dictionary adherence: no `timestamps()` anywhere.** The
  dictionary lists no `created_at`/`updated_at` on any of the 20 entities, so
  every model sets `$timestamps = false`. `audit_logs.created_at` is the single
  approved exception.
- **`increments()` / `unsignedInteger()`, not `id()`.** Laravel's `id()` creates
  `BIGINT UNSIGNED`; the dictionary says `INT`. Matching the manuscript won.
- **SQLite removed outright.** `config/database.php` defines *only* a mysql
  connection — the stock sqlite/mariadb/pgsql/sqlsrv entries were deleted so no
  stray `DB_CONNECTION` can silently fall back. `SchemaTest` asserts the driver
  is `mysql`.
- **The schema is exactly the 20 entities plus Laravel's `migrations` table.**
  `CACHE_STORE=file`, `QUEUE_CONNECTION=sync`, `SESSION_DRIVER=file`, and the
  three default Laravel migrations were deleted, so no `cache`, `jobs`,
  `sessions` or `password_reset_tokens` tables are created.
- **`USER.password_hash` kept over Laravel's `password`.** `App\Models\User`
  overrides `getAuthPassword()` instead. Renaming the column to suit the
  framework would have meant amending the manuscript.
- **Table names are Laravel-plural** (`barangays`, `symptom_codes`). The
  dictionary names *entities*, not tables; columns still match one-to-one.
- **Laravel's bundled `CLAUDE.md` and `AGENTS.md` were deleted** from
  `apps/api`. They instruct agents to install `laravel/boost`, which would
  hijack future sessions and add an unrequested dependency.
- **Pest 5 + PHPUnit 13**, because CLAUDE.md's documented command is
  `./vendor/bin/pest`. Laravel 13 ships PHPUnit only; Pest 5 needed PHPUnit 13,
  so the skeleton's `^12.5` pin was raised.

## Known gaps / open items

Carried forward:

- The v1 ruleset bundle has **not** been through clinician review. Every tier in
  `packages/ruleset/src/bundle/v1.ts` is draft.
- The lexicon/NLP layer doesn't exist. UT-003, UT-004 pending.
- `apps/pwa`, `apps/portal`, `apps/console` are still empty.
- No CI beyond `engine-purity`.
- `docs/REPO.md` and `docs/ut-matrix.md` cite table numbers by hand.

New:

- **Phase 4 tripwire — threshold-override tiers are unrecoverable.** ADR-0001
  step 2 (an `is_override` severity threshold) leaves no trace in
  TRIAGE_SESSION: no column links a session to the threshold that fired. Such a
  session derives to `rhu` even if it escalated to `emergency`. Unreachable
  today (v1 has no thresholds); **becomes a live defect the first time a
  super-admin authors an override threshold in the console (UT-009)**. Pinned by
  a deliberately-named test in `SessionTierResolverTest`. The fix is a
  manuscript amendment adding `outcome_tier` (and ideally `resolution_source`)
  to Table 13 — decide when Phase 4 starts, not before.
- **`HEALTH_TIP` (Table 21) is not in the bundle contract.** It is
  `ruleset_version_id`-scoped, so it ships to devices, but `RulesetBundle` in
  `packages/ruleset` has no `healthTips` field. That's a ruleset-contract
  change; deferred until the publish endpoint is built.
- **Staff auth has no token table.** The Data Dictionary defines no
  `personal_access_tokens`. Phase 4 must choose between stateless JWT (no table,
  no amendment) or Sanctum (+1 table, amendment). Not decided.
- **Does a true zero suppress?** `SuppressionRule::render(0)` returns `<5`,
  following CLAUDE.md literally ("any bucket under 5 renders `<5`"). Arguable
  either way — showing a bare 0 discloses absence just as a 1 discloses
  presence. Confirm this is what you want; it's a privacy-model decision.
- **`FACILITY` still orphaned.** Table created as specified; the wire-or-drop
  decision is deferred to Phase 5.
- **Data Dictionary intro sentence is wrong** (manuscript line ~482): it says
  "only de-identified aggregates are synchronized", but Table 13 has
  `sync_batch_id`/`synced_at` and Table 22 has `session_count`. Session records
  sync. One-sentence manuscript fix, still owed.
- **CLAUDE.md misattributes its version constraints.** It cites Table 25 for
  "PHP 8.4, Node 20, React 18, Laravel 11". Table 25 pins only React 18; MySQL
  8.x comes from Table 29; PHP, Node and Laravel versions appear nowhere in the
  manuscript. CLAUDE.md needs its constraint row corrected to Laravel 13 anyway.

## Next steps (planned, not started)

Written into the approved Phase 3 plan but not yet done:

- `docs/data-dictionary.md` — transcribe Tables 5–24 so no future session needs
  the 22 MB .docx.
- `docs/adr/0002-phase-3-schema-decisions.md` — the `created_at` amendment, the
  derive-don't-store tier decision, strict timestamp adherence, Laravel 13.
- `docs/ut-matrix.md` — mark UT-015 and UT-020 as covered at the schema/domain
  level once the tests actually pass.
- `.github/workflows/api.yml` — PHP 8.4 + MySQL 8 service container, Pest.
- `CLAUDE.md` — correct the Laravel row and the Table 25 attribution; update the
  phase table.
- Then Phase 3's remaining scope: controllers, routes, sync endpoint
  (idempotent on `client_batch_uuid`), model observers wired to `Recorder`.

## Commands to re-verify state

```bash
# Phases 1-2 — known good
npm install
npm test -w @mycare/triage-engine      # expect 12/12 pass
npm run typecheck                      # expect clean
npm run purity -w @mycare/triage-engine

# Phase 3 — never yet run; needs DB_PASSWORD set first
cd apps/api
composer install
mysql -u root -p -e "CREATE DATABASE mycare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE DATABASE mycare_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php artisan migrate --seed
./vendor/bin/pest
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`.
- Latest pushed commit: `9358811` on `main`.
- **Working branch: `feat/UT-020-laravel-api-schema`, with nothing committed
  yet.** All Phase 3 work is uncommitted in the working tree. `git status` will
  show ~50 new files under `apps/api/` plus untracked `CLAUDE.md` and
  `docs/STATUS.md`.
- `apps/api/vendor/` is gitignored; `apps/api/.env` is too (`.env.example` is
  committed).
- A local project working-agreement file (`CLAUDE.md`) exists but is
  intentionally **not committed** — don't assume a fresh clone has it.
