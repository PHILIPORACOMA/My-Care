# ADR-0002: Phase 3 schema decisions

## Status

Accepted. Implemented in `apps/api`, verified by execution against MySQL 8 on
2026-09-09 (`migrate:fresh --seed`, Pest 35 passed / 124 assertions) and
re-checked against `docs/data-dictionary.md` on 2026-09-12.

One decision here — adding `created_at` to `AUDIT_LOG` — is a **manuscript
amendment that was approved on 2026-09-04 but whose `.docx` edit is still
owed**. Until that edit lands, the code and the manuscript disagree by exactly
one column, knowingly. See
[Decision 2](#decision-2-created_at-added-to-audit_log-table-19).

## Context

Phase 3 builds the Laravel API's persistence layer: the 20 entities of the
manuscript's Data Dictionary (Tables 5–24), now transcribed in
`docs/data-dictionary.md`.

The governing constraint is that **the manuscript is the specification**. A
column name, type, or nullability that differs from the Data Dictionary is not
a style choice; it is either a defect or an amendment requiring approval. That
makes the interesting decisions in this phase the ones where a framework
convention pulls against the manuscript, or where the manuscript is silent,
internally inconsistent, or simply missing something the system needs.

Four such decisions are substantial enough to record in full. A further set of
smaller ones is captured below them so the reasoning is not lost to git
archaeology.

---

## Decision 1: Laravel 13, not Laravel 11

**The manuscript pins no Laravel version.** Table 25 says only
`Backend Framework | Laravel`. **No amendment was needed**, and none was made.

Laravel 11 is uninstallable in practice. It reaches end of life in March 2026
and carries 7 unpatched security advisories; Composer refuses every 11.x
release on that basis. Shipping a health-triage backend on a framework that
cannot receive a security patch is not defensible in a capstone whose privacy
model is a graded requirement.

13 was chosen over 12 because 12's security window closes around February 2027,
which is inside this project's plausible maintenance life. Installed and
verified: **`laravel/framework` v13.30.1, PHP 8.4.13.**

Because the manuscript names only the framework, the runtime choices around it
— PHP 8.4, Node 20 — are likewise ours to make and change without amendment.

## Decision 2: `created_at` added to `AUDIT_LOG` (Table 19)

**This is a manuscript amendment. Approved 2026-09-04; the `.docx` edit is
still owed.** The row to add:

```
 | created_at | Date Recorded | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes |  |
```

Table 19 as written records *who* did *what* to *which row*, and the prior
state in `old_value` — but not *when*. An audit trail without a timestamp
cannot order events, cannot be filtered by date, and cannot answer the only
question an auditor reliably asks, which is what happened during some window.

The amendment was framed not as a new requirement but as **correcting an
internal contradiction**: Figure 41's own body text already promises each entry
is "stamped with the responsible actor and timestamp". The Data Dictionary
contradicted the manuscript's own prose, and the prose is what the system was
defended on. No ERD change is needed — it adds a non-key column and alters no
relationship in Figure 42.

**`new_value` was considered and deliberately rejected.** It looks like the
natural companion to `old_value`, but Figure 41's reconstruction claim is
already served by the version-scoped ruleset tables: any published state can be
rebuilt from the `RULESET_VERSION` it belonged to. Storing the post-change state
as well would duplicate that, double the write volume of the audit path, and
widen the blast radius of a logging bug. `old_value` alone is sufficient to
answer "what did this used to be".

`audit_logs.created_at` is, by design, **the only timestamp column in the entire
database** — see Decision 4.

## Decision 3: derive the session tier; do not store it

`TRIAGE_SESSION` (Table 13) has no `outcome_tier` column. Rather than add one,
the tier is reconstructed by `app/Domain/Triage/SessionTierResolver.php`,
following the same precedence the engine used (ADR-0001):

1. a red-flag clarification answer → `emergency`
2. a matched rule → that rule's `outcome_tier`
3. nothing matched → `rhu`, the fail-safe default, never `home`

Step 1 is checked before step 2 deliberately. A red-flag answer outranks a rule
match in the engine, so a session carrying both resolved to `emergency` at the
time; reading the rule's tier first would silently under-report it.

Adding the column unasked was rejected because a derived value that always
agrees with the engine is strictly better than a stored one that can drift out
of agreement with it. The stored copy would become a second source of truth for
the most safety-critical number in the system.

### The Phase 4 tripwire

**Derivation is exact today and stops being exact the moment a super-admin
authors an override threshold.**

ADR-0001 step 2 — an `is_override` severity threshold escalating straight to a
tier — leaves no trace in the schema. No column links a session to the threshold
that fired. Such a session has no matched rule and no red-flag answer, so it
falls through to step 3 and reads as `rhu`, when the tier at the time may well
have been `emergency`.

This is **unreachable today**: the v1 bundle ships zero severity thresholds and
zero clarification questions, so only steps 2 and 3 can occur. It becomes a live
defect the first time UT-009's authoring UI is used, which is Phase 4 scope.

It is pinned by a deliberately-named test —
`it('documents the known Phase 4 gap: a threshold-override session reads as rhu')`
in `tests/Feature/SessionTierResolverTest.php` — so the gap is asserted rather
than merely commented, and a future change that appears to fix it has to
confront the test.

**The fix is a manuscript amendment adding `outcome_tier` (ideally plus
`resolution_source`) to Table 13, to be decided when Phase 4 starts. Do not
paper over it in the resolver.** A resolver that guessed would produce a
plausible wrong number, which is worse for surveillance data than an obvious
gap: a visible hole gets investigated, a confident wrong tier gets charted.

## Decision 4: strict Data Dictionary timestamp adherence

**No `timestamps()` anywhere. Every model sets `$timestamps = false`.**

Laravel adds `created_at` / `updated_at` to a table by default. The Data
Dictionary declares its own temporal columns per entity — `registered_at`,
`published_at`, `computed_at`, `generated_at`, `started_at`, `completed_at`,
`synced_at`, `last_sync_at` — and declares no others. Accepting the framework
default would have silently added 40 columns that no manuscript table describes,
and every one of them would be an undocumented divergence.

Verified in the live schema: `audit_logs.created_at` is the only timestamp
column in the database, and it is there by approved amendment (Decision 2).

Two related points hold throughout:

- **All timestamps are stored in UTC**, converted to `Asia/Manila` at display
  only. `Recorder` stamps `CarbonImmutable::now('UTC')` explicitly, and
  `phpunit.xml` pins `APP_TIMEZONE=UTC`. Devices may be offline for weeks;
  drifting timezones corrupt trend charts and the cluster-detection banner, and
  in the audit trail the corruption is unrecoverable after the fact.
- **Table 13 uses `TIMESTAMP` where every other entity uses `DATETIME`.** That
  is the manuscript's inconsistency, not ours, and the schema follows it
  literally — `triage_sessions` uses `timestamp()`, everything else
  `dateTime()`. Reconciling it would be a silent amendment.

---

## Smaller decisions, recorded for the trail

**`increments()` / `unsignedInteger()`, never `id()`.** The dictionary says
`INT`; Laravel's `id()` emits `BIGINT`. Confirmed in the live schema — keys are
`int unsigned`.

**SQLite removed outright from `config/database.php`.** The stock sqlite,
mariadb, pgsql and sqlsrv connections were deleted rather than left unused, so
no stray `DB_CONNECTION` value can silently fall back to another engine.
`SchemaTest` asserts the driver is `mysql`. The project rule is that SQLite is
never used, not even for tests: an in-memory SQLite run masks exactly the
suppression and aggregate bugs this system exists to avoid (UT-018, UT-020). If
a test run cannot reach MySQL it must fail loudly — that is the point.

**`USER.password_hash` kept over Laravel's `password`.** The `User` model
overrides `getAuthPassword()` rather than renaming a manuscript column to suit
the framework.

**Table names are Laravel-plural** (`barangays`, `triage_sessions`). The
dictionary names *entities*, not tables; columns map one-to-one. The mapping is
tabulated in `docs/data-dictionary.md`.

**Suppression is a read-path concern with exactly one implementation.**
`AGGREGATE_STAT.session_count` stores raw counts, because the same bucket may
clear the threshold when re-aggregated over a wider period and a pre-suppressed
store could never recover that. `Domain/Aggregation/SuppressionRule` is the
single place the `<5` rule lives; it is static-only and non-instantiable
precisely so the threshold cannot be made configurable. Every aggregate read —
dashboard, trends, map, CSV, PDF — must call it.

**Audit writes go through `Domain/Audit/Recorder`, from model observers only.**
A controller-level write covers the one path its author had in mind and misses
every other — a second caller, a console command, a queued job — and the gap is
invisible until an auditor asks why an action has no entry. `Recorder` throws on
an over-length `action_type` rather than truncating, because these are
programmer-supplied constants and a silent truncation corrupts the trail instead
of surfacing the bug.

**Pest 5 + PHPUnit 13**, because CLAUDE.md's documented command is
`./vendor/bin/pest`. Installed: `pestphp/pest` v5.1.3, `phpunit/phpunit` 13.3.1.

**Test credentials stay out of version control.** `phpunit.xml` is tracked and
carries no username or password, but keeps `DB_DATABASE=mycare_test` as a hard
guard so a test run cannot reach the development schema even if `.env.testing`
is missing. CI must supply `DB_USERNAME` / `DB_PASSWORD` as env vars.

**Laravel's bundled `CLAUDE.md` / `AGENTS.md` were deleted** from `apps/api`.
They instruct agents to install `laravel/boost`, which is not a dependency this
project wants chosen on its behalf.

## Consequences

- The schema is a faithful, verified implementation of Tables 5–24. As of
  2026-09-12 the only divergence between code and manuscript is
  `audit_logs.created_at`, and it is an approved amendment.
- **Two documentation debts are outstanding against the `.docx`**, both owed by
  Philipo: the Table 19 `created_at` row, and the Data Dictionary intro sentence
  that claims only aggregates sync when Tables 13 and 22 plainly show session
  records do.
- Phase 4 inherits two decisions this ADR deliberately does not make: whether
  to amend Table 13 with `outcome_tier`, and whether staff auth uses stateless
  JWT (no table, no amendment) or Sanctum (one new table, amendment required).
  The dictionary contains no token table of any kind.
- Adding a Data Dictionary entity or column later means amending the manuscript,
  updating `docs/data-dictionary.md`, and adding a migration — in that order,
  and in the same change.
- A loose end worth closing: `composer.json` still carries the Laravel skeleton's
  `post-create-project-cmd` line that touches `database/database.sqlite`. It is
  dead — it fires only on `composer create-project`, no such file exists, and
  the sqlite connection is gone — but it reads as a contradiction of the
  no-SQLite rule and should be deleted.

## Traceability

- Data Dictionary Tables 5–24 → `docs/data-dictionary.md`, the 20 migrations in
  `apps/api/database/migrations/`.
- Resolution precedence → `docs/adr/0001-triage-resolution.md`.
- UT-015 (deduplication) → `client_batch_uuid` and `client_session_uuid` UNIQUE
  indexes, asserted in `tests/Feature/SchemaTest.php`.
- UT-018, UT-020 (suppression) → `tests/Unit/SuppressionRuleTest.php`.
- UT-009 (threshold override) → the Phase 4 tripwire in
  `tests/Feature/SessionTierResolverTest.php`.
- Figure 41 (audit log) → `tests/Feature/AuditRecorderTest.php`.
- Phase status and open items → `docs/STATUS.md`.
