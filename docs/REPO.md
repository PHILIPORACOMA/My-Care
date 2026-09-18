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

`src/bundle/v1-lexicon-draft.ts` supplies v1's `lexiconTerms` (English/
Filipino/Cebuano free-text phrases for each of the 23 presentations, plus a
handful of negation phrases). Unlike the rest of v1, this is **not** sourced
from the appraisal form — that form doesn't specify lexicon wording, so this
is an unvalidated developer guess written to unblock `apps/pwa`'s free-text
NLP testing. Do not extend it as if it were reviewed content; replace it
wholesale once a clinician-reviewed source exists.

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

- Turn free text into symptom codes. That's the NLP/lexicon layer
  (`apps/pwa`, not yet built — Phase 5). `evaluate()` only ever sees codes
  that have already been resolved.
- Anything asynchronous, time-dependent, or random. `evaluate()` is called
  synchronously and returns the same result for the same input and bundle,
  every time, forever — that reproducibility is what makes a past triage
  result reconstructible from the ruleset version in force at the time
  (audit log, Figure 41).

## `apps/*`

Not yet built (Phase 3 onward). Reserved layout:

- `apps/pwa` — patient-facing, anonymous, offline-first (Figures 17–29)
- `apps/portal` — sub-admin (RHU/LGU), read-only (Figures 30–35)
- `apps/console` — super-admin (dev team), rule/lexicon authoring (Figures 36–41)
- `apps/api` — Laravel 11 + MySQL 8

## Where the source content comes from

- Full Data Dictionary (Tables 5–24), hardware/software specs (Tables
  25–29), module list (Table 30), and the UT-001–UT-020 unit test registry
  (Table 31) live in the capstone manuscript, not in this repo. Anything
  under `docs/` that restates them should stay traceable back to a table
  number, as this file and `docs/ut-matrix.md` do.
- The 23 v1 symptom presentations come from the *Clinical Plausibility and
  Content Validity Appraisal Form*, a separate document from the
  manuscript. Do not add or reword a symptom presentation without that
  source, and do not invent lexicon terms or triage rules that aren't in
  it — ask instead of guessing.
