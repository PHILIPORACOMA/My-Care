# Contributing

## Before your first commit

Read [`docs/REPO.md`](docs/REPO.md). It covers the layout, the dependency rules,
and the Laravel domain structure.

## Branches

```
main      tagged releases only, protected
develop   integration branch (default)
feat/UT-007-rule-authoring
fix/UT-015-dedupe-race
docs/chapter-4-results
```

Name feature branches after the manuscript test case they implement. It keeps
the test matrix traceable and makes the commit history readable at defense.

## Commits

Conventional commits: `feat:` `fix:` `test:` `docs:` `chore:` `ci:`

```
feat(engine): scoped negation detection for Cebuano

Implements a 3-token negation window that resets at clause
boundaries, so "walay hilanat" excludes fever while
"walay sipon pero hilanat" does not.

Closes #12. UT-004.
```

## Pull requests

1. Branch from `develop`, never from `main`.
2. Fill in the manuscript reference fields in the PR template. Not optional —
   it is how Chapter 4 gets written.
3. CI must be green.
4. One approval required. CODEOWNERS routes the request automatically.
5. Squash merge, then delete the branch.

## Non-negotiables

**The triage engine stays pure.** `packages/triage-engine` must have zero runtime
dependencies and must never call `fetch`, touch `localStorage` or `indexedDB`,
read `Date.now()`, or use `Math.random()`. A CI job fails the build if it does.
This is what makes the determinism claim testable rather than merely asserted.

**Suppression has one implementation.** Every aggregate read path goes through
`Domain/Aggregation/SuppressionRule`. Never reimplement the `<5` rule inline.

**Audit writes go through the Recorder.** Never insert into `audit_logs` from a
controller.

**Schema changes update the manuscript.** If you rename a column, amend the Data
Dictionary in the same PR.

**Never commit** `.env`, `node_modules/`, `vendor/`, real barangay data, or any
respondent-identifying information from the field study.

## Testing

```bash
npm test                              # all workspaces
npm test -w @mycare/triage-engine     # engine only, no database needed
cd apps/api && ./vendor/bin/pest      # backend
```

New tests that correspond to a manuscript test case must be registered in
[`docs/ut-matrix.md`](docs/ut-matrix.md).
