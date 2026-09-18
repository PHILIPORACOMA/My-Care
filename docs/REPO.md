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
Content Validity Appraisal Form* (6 home / 8 rhu / 9 emergency). It has not
been through clinician sign-off via that form yet — see the file's header
comment for what that means for its content.

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
  uninstallable. See `docs/adr/0002-phase-3-schema-decisions.md`. **Complete
  for Phases 3, 4, 6 (server side) and 7.**
- `apps/console` — super-admin (dev team), rule/lexicon authoring
  (Figures 36–41). **Written, not yet verified** (see `docs/BUILD-LOG.md`).
- `apps/portal` — sub-admin (RHU/LGU), read-only (Figures 30–35). Not started.
- `apps/pwa` — patient-facing, anonymous, offline-first (Figures 17–29). Not
  started; its NLP layer already exists as `packages/lexicon-matcher`.

Dependency direction is unchanged: `apps/*` → `packages/*`, never the reverse.

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
