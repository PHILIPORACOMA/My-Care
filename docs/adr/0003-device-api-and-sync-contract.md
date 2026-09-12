# ADR-0003: The device API and the sync contract

## Status

Accepted. Implemented in `apps/api` (Phase 3), verified against MySQL 8 —
**Pest 70 passed, 249 assertions**.

This ADR defines a contract whose consumer does not exist yet: the patient PWA
is Phase 5 and the offline sync layer is Phase 6. That is deliberate — the
server side is buildable and testable now, and writing the contract down is what
stops it being invented twice — but it means **the shape below is a proposal
until a real device has spoken it**. Expect one revision when `apps/pwa` is
built.

## Context

Phase 3's remaining work is the device-facing API: a handset must be able to
pull the ruleset it triages against, and push what it recorded while offline.

Two constraints shape everything here:

- **Devices are offline for weeks.** A handset may be carrying a ruleset
  version that is no longer current, and may retry an upload it has no way of
  knowing succeeded.
- **Raw symptom text never leaves the device.** This is the project's hardest
  privacy rule and the one a payload schema can actually enforce.

A third constraint shapes what is *not* here: staff authentication is still
undecided (JWT vs Sanctum, Phase 4), so no staff-facing endpoint could be built
even if Phase 3 wanted one.

## Decision

### 1. Devices authenticate with `DEVICE.api_token`; Sanctum is not installed

`AuthenticateDevice` middleware resolves a bearer token against Table 12, and
rejects anything that is not both `is_approved` and `status = 'active'`.

This sidesteps the open staff-auth question entirely. `api_token` is a
credential the manuscript already specifies, so using it needs no amendment,
and a device is not an account — it has no role and must never reach a staff
endpoint.

**`php artisan install:api` must not be run.** It installs Laravel Sanctum,
which would add a `personal_access_tokens` table the Data Dictionary does not
have *and* pre-empt the Phase 4 decision. `routes/api.php` is therefore
registered by hand in `bootstrap/app.php`.

`is_approved` is load-bearing, not decorative: it is what stops an
enrolled-but-unvetted handset pushing into the surveillance record before a
super-admin has looked at it.

**Known limit:** `api_token` is stored and compared in plaintext. Table 12 types
it `VARCHAR(80)` with no hashing implied, and a hashed column cannot be looked
up directly. Revisit in Phase 4 alongside staff auth — a prefix-plus-hash scheme
fits the same column width.

### 2. `GET /api/v1/ruleset/current` serves only published versions

A draft is unreviewed clinical content by definition. A handset that cached one
would be triaging patients against rules nobody has signed off, so the status
filter is a safety control.

When nothing is published the endpoint returns **503, not 404**: the resource is
not missing, the server is not yet in a state to serve it, and a device should
retry rather than conclude no ruleset exists.

The response body is the `RulesetBundle` shape from
`packages/ruleset/src/schema.ts`, camelCase, so the on-device engine consumes it
without a translation layer. `Domain/Ruleset/BundleAssembler` is the single
translation point between that contract and the snake_case columns; if the
contract changes it changes in both places together, never in a controller.

Assembly is deterministic — every query is explicitly ordered — because a past
triage result is only reconstructible if the ruleset that produced it can be
rebuilt exactly (Figure 41). A test asserts two successive assemblies are
identical.

### 3. `healthTips` is added to the ruleset contract

`HEALTH_TIP` (Table 21) is `ruleset_version_id`-scoped precisely so it ships to
devices, but `RulesetBundle` had no field for it and the table was stranded.
This adds one. Health tips are presentational only: **a tip never influences a
tier, and `evaluate()` does not read the field.**

`symptomCode` is optional, so a tip can be general to a tier rather than tied to
one symptom.

The v1 bundle ships `healthTips: []`, for the same reason its
`clarificationQuestions` and `severityThresholds` are empty: the appraisal form
specifies presentations and tiers, not the advice that accompanies them. **Tip
content is medical guidance and needs clinical review before it ships.**

### 4. `POST /api/v1/sync/batches` is idempotent on `client_batch_uuid`

- **201** — batch stored for the first time
- **200** — already stored; the original result is returned
- **never 409**

A device cannot distinguish "my upload was lost" from "my acknowledgement was
lost". Answering a retry with an error invites a third attempt and, worse,
tempts a client author into "fixing" it by dropping data. The UNIQUE index is
the real guarantee; the lookup is the fast path; a race between two retries is
caught and resolved to whichever batch landed.

`attempt_count` **is** incremented on replay — a retry is a delivery attempt,
and it feeds the sync monitoring screen (UT-014). It is deliberately absent from
the response, so incrementing it cannot change the answer a retry receives.

**A batch is written entirely or not at all.** A partial write would leave
`SYNC_BATCH.session_count` disagreeing with the rows actually stored, and
nothing downstream could tell which number was right.

A session already stored under an earlier batch **keeps its original batch**.
Re-pointing it would move it between uploads and make `session_count`
unreconcilable after the fact.

### 5. Everything the device sends is resolved against server-side identifiers

A handset offline for weeks may be carrying an older ruleset, so its notion of
"rule 14" is not necessarily the server's. The payload therefore carries
*codes*, not ids: `ruleset_version_label`, `matched_rule_code`, `symptom_code`,
`question_key`.

- **Sessions against an older or archived version are accepted.** Rejecting them
  would discard real clinical encounters.
- **An unknown version label is rejected, not reassigned.** Attributing a
  session to a ruleset that did not produce it breaks the reconstruction claim
  in Figure 41 — the entire point of recording `ruleset_version_id`.
- **An unresolvable lexicon term degrades to null** rather than failing the
  batch. `matched_term_id` is nullable and purely evidential; losing that trace
  is a smaller harm than discarding the session it belongs to.

### 6. The payload schema is where the privacy rule is enforced

`StoreSyncBatchRequest` has **no field anywhere that can carry free text a
patient typed**, and no patient identifier of any kind — no name, age, contact,
or coordinates. Barangay is the finest granularity recorded.

Because validated input drops unknown keys, a future client that started sending
`symptom_text` would have it silently discarded rather than persisted. A test
asserts exactly that, using a Cebuano symptom phrase.

The one field that looks like text is not: `matched_term` identifies a lexicon
entry from the server's *own published bundle* by surface form and language —
vocabulary the server wrote, never the patient's words.

### 7. The audit log records privileged decisions, not the data stream

`AuditableObserver` is registered from `AppServiceProvider` for 14 models: the
ruleset and everything version-scoped under it, accounts and roles, devices, and
the reference data dashboards read against.

Four categories are deliberately excluded:

- **Patient data** (`TRIAGE_SESSION`, `SESSION_SYMPTOM`,
  `CLARIFICATION_ANSWER`) — these arrive by the thousand, are nobody's
  privileged decision, and auditing them would both drown the log Figure 41
  describes and copy de-identified clinical data into a second table more staff
  can read.
- **Sync plumbing** (`SYNC_BATCH`) — same volume argument; delivery attempts are
  already recorded on the batch for UT-014.
- **Derived data** (`AGGREGATE_STAT`) — recomputed, not decided.
- **`AUDIT_LOG` itself** — observing it would recurse.

Two refinements:

- `DEVICE.last_sync_at` is a machine heartbeat, not a decision by a person, and
  is ignored. Without this every sync would append an entry and Figure 41's
  screen would be unreadable. Approving a device is still audited.
- **Secrets are redacted.** `password_hash`, `api_token` and `remember_token`
  never reach `old_value`. More staff can read the audit log than can read the
  users table; a digest in there would turn the audit trail into a credential
  store.

`old_value` stores only the columns that actually changed, so an entry reads as
a diff rather than a full row dump — which is what "State Before" is for.

## Consequences

- Phase 3's endpoint work is complete for devices. **No staff endpoint exists**,
  and none can be built until the JWT-vs-Sanctum decision is made.
- `packages/ruleset` gained a field, so the contract version shipped to devices
  is no longer byte-identical to the one Phase 2 published. Nothing consumes it
  yet, which is why now was the cheap moment.
- An existing assertion in `AuditRecorderTest` had to change: it asserted a
  global `AuditLog::count() === 1`, written when no observers existed. Its
  fixtures now legitimately audit a Role, Barangay and User, so it measures the
  delta instead. The observer was not weakened — UT-019 *requires* account
  creation to leave a trail.
- **A new schema gap surfaced.** `RULE_CONDITION` (Table 10) has no sequence
  column, but condition order is semantically load-bearing: each condition's
  `operator` says how it combines with the ones before it, so reordering can
  change the tier a rule produces. Insertion order — the primary key — is the
  only ordering the schema offers, and `BundleAssembler` sorts by `id`
  accordingly. **This is stable only while conditions are append-only.** A
  rule-authoring UI that lets a super-admin reorder them (Phase 4, UT-007) needs
  either a sequence column by amendment, or delete-and-reinsert semantics.
  Recorded in `docs/STATUS.md`.
- There is still no way to get the v1 bundle *into* the database. `GET
  /ruleset/current` returns 503 on a fresh install because nothing publishes
  `packages/ruleset/src/bundle/v1.ts` into Tables 6–11/15/21. That importer is
  Phase 4 publish work (UT-010, UT-011).
- `DeviceSeeder` exists for local development and is deliberately **not** in
  `DatabaseSeeder`'s chain: `migrate --seed` must never mint a working API
  credential as a side effect. Run `php artisan db:seed --class=DeviceSeeder`;
  it refuses to run in production and prints a random token once.

## Traceability

- UT-012 (aggregate sync, raw text never transmitted) → `SyncBatchTest`
- UT-013 (version sync) → `RulesetBundleTest`
- UT-015 (deduplication) → `SyncBatchTest`, the replay and double-count tests
- Figure 41 (audit log) → `AuditObserverTest`
- Resolution precedence → `docs/adr/0001-triage-resolution.md`
- Schema decisions → `docs/adr/0002-phase-3-schema-decisions.md`
- Bundle contract → `packages/ruleset/src/schema.ts`
