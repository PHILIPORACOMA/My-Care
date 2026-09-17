# Unit test matrix (UT-001 – UT-020)

Source: manuscript Table 31 (Unit Testing). This is the registry every
unit test must map back to. Update the **Status** and
**Implemented in** columns in the same change that adds or moves a test —
do not let this drift from the code.

| Test Case ID | Module | Unit | Description | Expected Result | Status | Implemented in |
|---|---|---|---|---|---|---|
| UT-001 | On-Device Triage Engine | Barangay Selection | Patient selects a barangay from the cached list | Selected barangay is stored in the session and applied to the triage record | Pending — Phase 5 (patient PWA) | — |
| UT-002 | On-Device Triage Engine | Symptom Text Input | Patient types a symptom phrase in Tagalog or Cebuano | Input is accepted and passed to the lexicon matcher | Pending — Phase 5 (patient PWA) | — |
| UT-003 | On-Device Triage Engine | Lexicon Matching | Input "sip-on" is compared against lexicon term "sipon" | Correct symptom code is assigned despite spelling variation | Pending — lexicon/NLP layer not yet built; out of scope for `packages/triage-engine`, which only consumes already-resolved symptom codes | — |
| UT-004 | On-Device Triage Engine | Negation Detection | Patient enters "walay hilanat" (no fever) | Symptom is correctly excluded, not flagged as present | Pending — lexicon/NLP layer, same as UT-003 | — |
| UT-005 | On-Device Triage Engine | Rule Evaluation | Matched symptoms satisfy the conditions of a rule | Correct tier (home / RHU / emergency) is returned with the matching rule ID | **Implemented** | `packages/triage-engine/src/evaluate.test.ts` ("v1 bundle: every one of the 23 presentations...", "highest tier among matches wins", AND/NOT chain test) |
| UT-006 | On-Device Triage Engine | Result Display | Triage session completes | Tier, plain-language explanation, and disclaimer render correctly in the selected language | Pending — Phase 5 (patient PWA UI) | — |
| UT-007 | Triage Rule & Lexicon Configuration | Rule Authoring | Super-admin creates a new rule | Rule is saved as a new draft version and is not yet live | **Implemented** (API). A saved rule lands in a new `draft` version and the device endpoint still serves nothing new. Console UI: Milestone 6 | `apps/api/tests/Feature/Console/RulesetLifecycleTest.php` ("saves a new rule as a draft version that is not live") |
| UT-008 | Triage Rule & Lexicon Configuration | Lexicon Editing | Super-admin adds a synonym to an existing symptom term | Change is saved under a pending lexicon version | **Implemented** (API). The synonym is saved in a new draft; the published version is untouched | `apps/api/tests/Feature/Console/RulesetLifecycleTest.php` ("saves an added synonym under a new pending version") |
| UT-009 | Triage Rule & Lexicon Configuration | Threshold Configuration | Super-admin sets a red-flag override condition | Override forces an emergency-tier result whenever triggered, regardless of other rules | **Implemented** — engine behavior, plus authoring through the API: an override threshold saves, publishes and reaches the device bundle intact | `packages/triage-engine/src/evaluate.test.ts` ("a red-flag severity threshold escalates ahead of normal rule matching", "red-flag clarification answer short-circuits..."); `apps/api/tests/Feature/Console/RulesetLifecycleTest.php` ("saves and publishes a red-flag override threshold") |
| UT-010 | Triage Rule & Lexicon Configuration | Content Versioning | Draft rule set is edited multiple times before publishing | Each save creates a new version; prior versions remain retrievable | **Implemented.** Every save writes a whole new version; earlier drafts become `superseded` and remain retrievable (ADR-0006) | `apps/api/tests/Feature/Console/RulesetLifecycleTest.php` ("creates a new version on every save and keeps the old ones") |
| UT-011 | Triage Rule & Lexicon Configuration | Publish / Rollback | Super-admin publishes a rule version | Devices receive the updated rule set on next sync; rollback restores the prior version | **Implemented** (server). Publish serves the new version to devices; rollback publishes a copy of the prior one. The device picking it up on its next sync is Phase 6 | `apps/api/tests/Feature/Console/RulesetLifecycleTest.php` ("publishes to devices and rolls back to the prior version") |
| UT-012 | Sync & Data Aggregation | Aggregate Sync | Device regains connectivity after being offline | De-identified aggregate data is uploaded; raw symptom text is never transmitted | **Partially implemented** — the receiving endpoint is built and the privacy half is enforced at the schema: `StoreSyncBatchRequest` has no field able to carry free text, so a client sending `symptom_text` has it dropped, asserted by test. The **device side** that regains connectivity and uploads is Phase 6 | `apps/api/tests/Feature/Api/SyncBatchTest.php` ("silently drops any free-text field a client tries to send", plus the store/link/stamp tests) |
| UT-013 | Sync & Data Aggregation | Version Sync | Device checks for rule/lexicon updates | Latest published version is downloaded and cached locally | **Partially implemented** — `GET /api/v1/ruleset/current` serves the latest published bundle and never a draft; assembly is deterministic so a version rebuilds identically every time. **Caching locally** is the device's half, Phase 6 | `apps/api/tests/Feature/Api/RulesetBundleTest.php` (7 tests), `apps/api/app/Domain/Ruleset/BundleAssembler.php` |
| UT-014 | Sync & Data Aggregation | Sync Status Monitoring | Sub-admin opens the Sync Status screen | Last sync timestamp and device/session counts display correctly | Pending — Phase 7 (sub-admin dashboard) | — |
| UT-015 | Sync & Data Aggregation | Deduplication | Same triage session is submitted twice due to a retry | Duplicate is detected and not double-counted in aggregates | **Implemented.** Both halves now hold: UNIQUE on `sync_batches.client_batch_uuid` and `triage_sessions.client_session_uuid` at the database, and the endpoint contract above it — a replayed POST returns **200 with the original result, never 409**, and four identical POSTs still yield one batch and one session. A session already stored keeps its original batch rather than moving between uploads | `apps/api/tests/Feature/Api/SyncBatchTest.php` (replay, double-count, attempt-count and original-batch tests), `apps/api/tests/Feature/SchemaTest.php` (the two index tests) |
| UT-016 | Sync & Data Aggregation | Barangay-Scoped Isolation | Sub-admin account is scoped to Barangay X | Only Barangay X aggregates are visible to that account | **Partially implemented** — `Domain/Auth/BarangayScope` is the single implementation and is tested, including that a super-admin is unscoped and that a sub-admin with no barangay assigned sees **nothing** rather than everything. The aggregate screens that must call it are Phase 7 | `apps/api/app/Domain/Auth/BarangayScope.php`, `apps/api/tests/Feature/BarangayScopeTest.php` (5 tests) |
| UT-017 | Dashboard, Reporting & Account Management | Trends Dashboard | Sub-admin opens the Trends & Surveillance dashboard | Correct tier counts and top-symptom trends are displayed | Pending — Phase 7 | — |
| UT-018 | Dashboard, Reporting & Account Management | Report Export | Sub-admin generates a CSV/PDF report | File downloads with correct date range and de-identified content | Pending — Phase 3/7 (`Domain/Aggregation/SuppressionRule`) | — |
| UT-019 | Dashboard, Reporting & Account Management | Account Management | Super-admin creates a new sub-admin account | Account is created and correctly scoped to its assigned barangay | **Partially implemented** — the authorisation primitives exist and are tested: `EnsureRole` gates routes by ROLE.name, `USER.barangay_id` carries the scope, and account creation is audited. The **create-account UI and endpoint** are Phase 4 | `apps/api/app/Http/Middleware/EnsureRole.php`, `apps/api/tests/Feature/AuditObserverTest.php` ("attributes a change to the acting user") |
| UT-020 | Dashboard, Reporting & Account Management | Suppression Rule | Aggregate count for a symptom/barangay falls below 5 | Value is suppressed rather than displayed, per the less-than-5 privacy rule | **Implemented** at the domain level — the rule itself is built, single-implementation, and fully tested, including the boundary (5 displays, 4 suppresses) and a true zero. The read paths that must call it — dashboard, trends, map, CSV, PDF — are Phase 7 | `apps/api/app/Domain/Aggregation/SuppressionRule.php`, `apps/api/tests/Unit/SuppressionRuleTest.php` (7 tests) |

## Notes

- UT-005 and UT-009 are the two test cases whose *engine* behavior is
  buildable in Phase 2, since `packages/triage-engine` only needs a
  ruleset bundle and pre-resolved symptom codes — it does not depend on
  the lexicon/NLP layer, the Laravel API, or any UI.
- UT-003 and UT-004 look like triage-engine tests but aren't: the project
  rule is that the NLP layer may propose symptom codes, but only the rule
  engine assigns a tier — so lexicon matching and
  negation detection belong to the NLP layer, not `evaluate()`. They stay
  pending until that layer exists (Phase 5, `apps/pwa`).
- **A test case is only "Implemented" when the behaviour Table 31 describes is
  the behaviour under test.** The Status column says how far each one actually
  reaches, and several sit deliberately at "Partially implemented" rather than
  being rounded up. UT-015 was one of them until the sync endpoint landed: the
  UNIQUE indexes were always the load-bearing half, but the HTTP contract they
  support — a replay answering 200 with the original result — had nothing
  exercising it. It does now, so UT-015 is Implemented.
- **Staff authentication is in place as of 2026-09-14** (ADR-0004): Sanctum in
  SPA cookie mode, which adds no table and needed no manuscript amendment.
  Logins, logouts, failed attempts and throttle lockouts are all audited.
  A failed attempt records `actor_id` as **null** — whoever typed the wrong
  password did not prove they are the account holder, and an audit trail that
  can put an action in an innocent person's history is worth less than none.
- **UT-012 and UT-013 are half-tests by nature.** Both describe a *device*
  doing something: regaining connectivity and uploading, checking for updates
  and caching locally. Phase 3 built the server side each one talks to, and
  that side is fully tested, but the handset that initiates them is Phase 5/6.
  They stay Partially implemented until `apps/pwa` exists — the server passing
  its own tests is not the same as the test case Table 31 wrote down.
- **UT-018 depends on UT-020's rule and stays pending regardless.** Its
  suppression dependency is ready; what is missing is the CSV/PDF export
  itself, the date-range handling, and the read path that calls
  `SuppressionRule` on the way out. Phase 7.
- ⚠️ **One UT-020 assertion is pinned to an undecided question.**
  `it('suppresses a true zero as well')` follows CLAUDE.md literally — any
  bucket under 5 renders `<5`, and 0 is under 5. It is arguable either way: a
  bare 0 discloses the absence of cases just as a 1 discloses their presence,
  but a dashboard of `<5` where the real answer is "none" is also misleading to
  a health worker. **Philipo's call, still open** (see `docs/STATUS.md`). If it
  goes the other way, that test and `SuppressionRule::render()` change
  together — the matrix row does not.
