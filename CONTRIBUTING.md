# Contributing

## Before your first commit

Read [`docs/REPO.md`](docs/REPO.md). It covers the layout, the dependency rules,
and the Laravel domain structure.

## Branches

```
main                                   the integration branch; every PR targets it
feat/UT-014-device-barangay-move       one branch per change, named for its test case
feat/UT-003-test-lexicon
```

Branch from `main`. Name the branch after the manuscript test case it
implements: it keeps the test matrix traceable and the history readable at
defense. **Merged branches are kept, not deleted**, so the capstone record
shows every one.

Small documentation follow-ups (`docs/STATUS.md`, `docs/BUILD-LOG.md`) may go
straight to `main`. Code always goes through a pull request.

## Commits

Conventional commits: `feat:` `fix:` `test:` `docs:` `chore:` `ci:`, with
the test case id in the body. A real one from the history:

```
fix: move the device's barangay when the patient changes barangay

PR #8 let a patient change barangay in Settings without starting over.
Sessions carry their own barangay_id, so counts were right, but
DEVICE.barangay_id stayed put, and Sync & status (Figure 33) groups
devices by it.

UT-014
```

## Pull requests

1. Branch from `main`.
2. Say which test case and which manuscript figure or table the change
   implements, and what was verified (tests, browser, screenshots). It is how
   Chapter 4 gets written.
3. CI must be green: `api`, `frontend`, `engine-purity`, `e2e`,
   `deploy-smoke`.
4. The project lead merges, with a **merge commit** (not squash), and the
   branch stays.
5. Record what was built and decided in `docs/BUILD-LOG.md`, and keep
   `docs/STATUS.md` current.

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
cd apps/api && ./vendor/bin/pest      # backend, MySQL 8 (never SQLite)
npm run e2e -w @mycare/e2e            # Playwright, all three apps
```

New tests that correspond to a manuscript test case must be registered in
[`docs/ut-matrix.md`](docs/ut-matrix.md).
