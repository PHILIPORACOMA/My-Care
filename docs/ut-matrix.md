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
| UT-007 | Triage Rule & Lexicon Configuration | Rule Authoring | Super-admin creates a new rule | Rule is saved as a new draft version and is not yet live | Pending — Phase 3/4 (Laravel API + super-admin console) | — |
| UT-008 | Triage Rule & Lexicon Configuration | Lexicon Editing | Super-admin adds a synonym to an existing symptom term | Change is saved under a pending lexicon version | Pending — Phase 3/4 | — |
| UT-009 | Triage Rule & Lexicon Configuration | Threshold Configuration | Super-admin sets a red-flag override condition | Override forces an emergency-tier result whenever triggered, regardless of other rules | **Implemented** (engine behavior only — the authoring UI is Phase 4) | `packages/triage-engine/src/evaluate.test.ts` ("a red-flag severity threshold escalates ahead of normal rule matching", "red-flag clarification answer short-circuits...") |
| UT-010 | Triage Rule & Lexicon Configuration | Content Versioning | Draft rule set is edited multiple times before publishing | Each save creates a new version; prior versions remain retrievable | Pending — Phase 3/4 | — |
| UT-011 | Triage Rule & Lexicon Configuration | Publish / Rollback | Super-admin publishes a rule version | Devices receive the updated rule set on next sync; rollback restores the prior version | Pending — Phase 3/4/6 | — |
| UT-012 | Sync & Data Aggregation | Aggregate Sync | Device regains connectivity after being offline | De-identified aggregate data is uploaded; raw symptom text is never transmitted | Pending — Phase 6 (offline sync layer) | — |
| UT-013 | Sync & Data Aggregation | Version Sync | Device checks for rule/lexicon updates | Latest published version is downloaded and cached locally | Pending — Phase 6 | — |
| UT-014 | Sync & Data Aggregation | Sync Status Monitoring | Sub-admin opens the Sync Status screen | Last sync timestamp and device/session counts display correctly | Pending — Phase 7 (sub-admin dashboard) | — |
| UT-015 | Sync & Data Aggregation | Deduplication | Same triage session is submitted twice due to a retry | Duplicate is detected and not double-counted in aggregates | **Partially implemented** — the database-level guarantee is built and verified: UNIQUE on `sync_batches.client_batch_uuid` and on `triage_sessions.client_session_uuid`, each asserted by a real duplicate insert throwing. The **endpoint** behaviour (a duplicate POST returns `200` with the original result, never `409`) is not built — remaining Phase 3 work | `apps/api/tests/Feature/SchemaTest.php` ("enforces sync batch idempotency at the database level", "enforces session idempotency at the database level") |
| UT-016 | Sync & Data Aggregation | Barangay-Scoped Isolation | Sub-admin account is scoped to Barangay X | Only Barangay X aggregates are visible to that account | Pending — Phase 3/7 | — |
| UT-017 | Dashboard, Reporting & Account Management | Trends Dashboard | Sub-admin opens the Trends & Surveillance dashboard | Correct tier counts and top-symptom trends are displayed | Pending — Phase 7 | — |
| UT-018 | Dashboard, Reporting & Account Management | Report Export | Sub-admin generates a CSV/PDF report | File downloads with correct date range and de-identified content | Pending — Phase 3/7 (`Domain/Aggregation/SuppressionRule`) | — |
| UT-019 | Dashboard, Reporting & Account Management | Account Management | Super-admin creates a new sub-admin account | Account is created and correctly scoped to its assigned barangay | Pending — Phase 3/4 | — |
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
  the behaviour under test.** UT-015 and UT-020 both have real, passing tests
  as of Phase 3, but they sit at different distances from their test case, and
  the Status column says which. UT-020's rule *is* the unit Table 31 names, so
  it is implemented and only its callers are missing. UT-015's test case is
  about a retried **submission**, and the endpoint that would do the retrying
  does not exist yet — the UNIQUE indexes make double-counting impossible at
  the database, which is the load-bearing half, but calling UT-015 done would
  claim an HTTP contract nothing has exercised.
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
