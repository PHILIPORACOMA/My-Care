# Repo map

This expands on the project's package layout with what each package
actually owns and where its source content comes from. If something here
disagrees with the code, the code wins — update this file in the same
change.

## `packages/ruleset`

The bundle schema — the contract between the Laravel API (author/publish
side) and the on-device triage engine (consume side). No behavior lives
here, only types (`src/schema.ts`) and versioned bundle content
(`src/bundle/`).

Field names mirror the manuscript's Data Dictionary one-to-one so a bundle
can be reconstructed from, or persisted back to, those tables:

| Type | Data Dictionary table |
|---|---|
| `SymptomCode` | Table 6, `SYMPTOM_CODE` |
| `RulesetBundle.versionLabel` | Table 7, `RULESET_VERSION` |
| `LexiconTerm` | Table 8, `LEXICON_TERM` |
| `TriageRule` | Table 9, `TRIAGE_RULE` |
| `RuleCondition` | Table 10, `RULE_CONDITION` |
| `SeverityThreshold` | Table 11, `SEVERITY_THRESHOLD` |
| `ClarificationQuestion` | Table 15, `CLARIFICATION_QUESTION` |

`src/bundle/v1.ts` is the first real bundle: a literal encoding of the 23
example symptom presentations in Part C of the *Clinical Plausibility and
Content Validity Appraisal Form* (6 home / 8 rhu / 9 emergency). It has been
appraised on that form (BUILD-LOG 8h, 8i); the reviewer's paperwork is still
owed. **It publishes no lexicon terms** until the reviewed ones are entered.

`src/testing/` is a second entry point, `@mycare/ruleset/testing`, for tests
only: v1 plus an **invented** test lexicon (kizaru3214's PR #2 draft,
unchanged), so free text can be exercised end to end (BUILD-LOG 9e). The main
entry never exports it, and `testing.test.ts` fails if v1 gains terms.
`npm run export:test-lexicon` writes it as JSON for a development database,
never a server patients use.

## `packages/triage-engine`

The pure deterministic engine. `evaluate(input, bundle)` takes a
`TriageInput` (already-resolved symptom codes, optional attributes, optional
clarification answers) and a `RulesetBundle`, and returns a `TriageResult`
(tier, reason, and whichever rule/threshold/question produced it).

Zero runtime dependencies — see `docs/adr/0001-triage-resolution.md` for
why this matters. `@mycare/ruleset` appears only
as a `devDependency`, imported with `import type`, so it erases entirely at
compile time and contributes nothing at runtime.

What it deliberately does **not** do:

- Turn free text into symptom codes. That is `packages/lexicon-matcher`.
  `evaluate()` only ever sees codes that have already been resolved.
- Anything asynchronous, time-dependent, or random. `evaluate()` is called
  synchronously and returns the same result for the same input and bundle,
  every time, forever — that reproducibility is what makes a past triage
  result reconstructible from the ruleset version in force at the time
  (audit log, Figure 41), and it is what lets the server replay stored
  sessions to recover their tier (`packages/engine-replay`, ADR-0007).

## `packages/lexicon-matcher`

The on-device NLP layer (Table 30 module 3, UT-003, UT-004). `matchSymptoms(text,
lexicon)` proposes symptom codes from free text: normalisation, a length-scaled
typo allowance, split and run-together words, and negation driven by lexicon
terms flagged `isNegation`.

Pure and zero-dependency like the engine, and held to the same purity check
(`scripts/check-purity.mjs`, shared by both). **It contains no Cebuano or
Tagalog vocabulary of its own** — every word comes from the published lexicon —
and it never assigns a tier.

## `packages/engine-replay`

A small Node CLI around the engine, bundled with esbuild. The Laravel API pipes
stored sessions to it during aggregation to recover each session's tier, since
`TRIAGE_SESSION` has no `outcome_tier` column (ADR-0007). Build it with
`npm run build -w @mycare/engine-replay`; the API needs `dist/replay.mjs` on the
server.

## `packages/api-client` and `packages/ui`

`api-client` is the typed staff/console client (Sanctum cookie mode: no token
ever lives in JavaScript). `ui` holds the tokens and primitives those two SPAs
share — including `<Count>`, which renders a suppressed cell as `<5`. **Neither
is used by `apps/pwa`**: the patient app has a different visual language and a
hard bundle budget.

## `apps/*`

- `apps/api` — Laravel 13 + MySQL 8. The manuscript pins no Laravel version
  (Table 25 says only "Laravel"), so this needed no amendment; Laravel 11 is
  uninstallable. See `docs/adr/0002-phase-3-schema-decisions.md` and the
  domain layout below.
- `apps/console` — super-admin (dev team), rule/lexicon authoring
  (Figures 36–41). **Built and verified**; served under `/console/`.
- `apps/portal` — sub-admin (RHU/LGU), read-only (Figures 30–35). **Built and
  verified**; served under `/portal/` as Figure 30 shows.
- `apps/pwa` — patient-facing, anonymous, offline-first (Figures 17–29).
  **Built and verified** in Chrome and Playwright, offline included. Triage
  runs on the device: `packages/lexicon-matcher` resolves the text,
  `packages/triage-engine` assigns the tier, and only a de-identified record
  syncs. Screens live in `src/screens/` (line icons in `Icon.tsx`, the
  language pill in `parts.tsx`); the offline queue, registration and rule
  refresh in `src/sync.ts`; IndexedDB in `src/storage.ts`. The 15 barangay
  names ship in `src/barangays.ts`, names only (BUILD-LOG 9c). Self-hosts its
  font and **deliberately imports nothing from `packages/ui`** — different
  visual language, hard bundle budget.

Dependency direction is unchanged: `apps/*` → `packages/*`, never the reverse.

## `apps/api`: the Laravel domain layout

Controllers stay thin; the rules live in `app/Domain/`, one folder per
concern:

| Folder | Owns |
|---|---|
| `Aggregation/` | `Aggregator` (the scheduled `mycare:aggregate`), `AggregateReader`, `ClusterDetector`, `DateRange`, and **`SuppressionRule`, the only implementation of `<5`** (UT-018, UT-020) |
| `Audit/` | `Recorder`, the only writer to `audit_logs`, called from `app/Observers/AuditableObserver` (never a controller) |
| `Auth/` | `BarangayScope`: a sub-admin sees one barangay (UT-016) |
| `Accounts/` | `AccountManager`: staff accounts (UT-019) |
| `Device/` | `DeviceToken` (prefix + digest, never the secret) and `PendingQueueReport` (ADR-0005) |
| `Ruleset/` | the lifecycle draft → review → published (`RulesetLifecycle`, ADR-0006), import, validation, bundle assembly for devices |
| `Sync/` | `BatchIngestor`: idempotent on `client_batch_uuid` (UT-015, ADR-0003) |
| `Triage/` | `EngineReplayer`: stored sessions through `packages/engine-replay` for their tier (ADR-0007) |
| `Reports/` | CSV and PDF exports (UT-018) |

Routes are split by who calls them (`routes/api.php`): public (barangay list,
device registration), **device** (bearer token: rules, facilities, sync,
moving its own barangay), **staff** (Sanctum cookie: the portal) and
**console** (super-admin). The two credential types never share a group.
Artisan commands are in `app/Console/Commands` (`mycare:ruleset:import`,
`mycare:facilities:import`, `mycare:staff:create-super-admin`,
`mycare:aggregate`).

## `e2e/`

Playwright, all three apps against the real API, MySQL 8 and the patient
app's production build. It rebuilds its own `mycare_e2e` schema and runs its
own servers on their own ports every time, so it never touches development.
Three projects in order: `patient`, `staff`, then `lexicon` (the only one
using the invented test lexicon). The README has the full table of specs;
`docs/ut-matrix.md` maps them to test cases.

## `deploy/` and CI

`deploy/` holds the production nginx, PHP-FPM, cron and backup files and
`deploy.sh`; `docs/DEPLOYMENT.md` is the guide (one host split by path: `/`,
`/portal/`, `/console/`, `/api`). Five workflows in `.github/workflows/`:
`api` (Pest on MySQL 8), `frontend` (package and app tests, production
builds), `engine-purity` (`scripts/check-purity.mjs` on the engine and the
matcher), `e2e` (Playwright) and `deploy-smoke` (builds a fresh Ubuntu 24.04
machine with the guide, deploys, and runs the Playwright suite through nginx).

## Where the source content comes from

- The full Data Dictionary (Tables 5–24) is now transcribed verbatim into
  `docs/data-dictionary.md` — read that instead of opening the manuscript.
  It is a copy, not an authority: the manuscript still wins on any conflict.
- Hardware/software specs (Tables 25–29), the module list (Table 30), and the
  UT-001–UT-020 unit test registry (Table 31) live in the capstone
  manuscript, not in this repo. Anything
  under `docs/` that restates them should stay traceable back to a table
  number, as this file and `docs/ut-matrix.md` do.
- The 23 v1 symptom presentations come from the *Clinical Plausibility and
  Content Validity Appraisal Form*, a separate document from the
  manuscript. Do not add or reword a symptom presentation without that
  source, and do not invent lexicon terms or triage rules that aren't in
  it — ask instead of guessing.
