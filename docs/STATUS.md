# Development status checkpoint

Last updated: **2026-09-26.** Phase 8 is merged (PR #3). **Phase 9
(deployment) is built and green on PR #4, `feat/UT-011-deployment`**, waiting
for review and merge. `deploy/` and `docs/DEPLOYMENT.md` take a fresh Ubuntu
24.04 server to a running system, and a CI job proves it by deploying with
them. What remains is a real server, which is a human's job.
`docs/BUILD-LOG.md` is the long-form record (9a, 9b).

**All three apps have now been opened in a real browser** (BUILD-LOG 9a). The
Playwright suite runs the patient journey against the real API, MySQL 8 and
the patient app's production build: triage offline across all three tiers,
upload on reconnect, and a dropped response retried without double-counting.
Portal and console are smoke-tested screen by screen. The same suite passes
**through nginx and PHP-FPM on a freshly deployed server** (`deploy-smoke`).
That run found that **every phone upload would have been rejected (419)** on
the one-host layout. It is fixed and pinned by a test (BUILD-LOG 9b,
ADR-0004 amendment). **All five CI checks pass**: `api`, `frontend`,
`engine-purity`, `e2e`, `deploy-smoke`.

Update this file at the end of any session that changes phase status, adds a
major decision, or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `CLAUDE.md`, `docs/STATUS.md` and `docs/BUILD-LOG.md` first (entries
> 9a and 9b cover the recent work), then `docs/DEPLOYMENT.md` and ADRs
> 0004-0007 in `docs/adr/` (0004 was amended 2026-09-26).
> Skim `docs/REPO.md` and `docs/ut-matrix.md` (its end-to-end section is new).
>
> `main` was force-pushed on 2026-09-26 to what was
> `feat/UT-020-laravel-api-schema`. PR #1 closed as merged. The old `main`
> (PR #2's patient app) is kept locally as
> `backup/main-before-force-2026-09-26`. Phase 8 is merged (PR #3). Phase 9
> is on **PR #4, `feat/UT-011-deployment`**, with all five CI checks green.
> Standing rule: **no manuscript amendments**.
>
> **Phase 9:** one host, split by path (`/`, `/portal/`, `/console/`, `/api`).
> `deploy/` holds the nginx, PHP-FPM, cron, backup, env and `deploy.sh`
> files; `docs/DEPLOYMENT.md` is the guide; the `deploy-smoke` workflow
> deploys a fresh Ubuntu 24.04 runner with them and runs the E2E suite
> through nginx. No real server exists yet.
>
> **Phase 8:** Playwright (`e2e/`) drives all
> three apps against the real API, MySQL 8 (`mycare_e2e`, rebuilt every run)
> and the patient app's production build. Run it with
> `npm run e2e -w @mycare/e2e`. It needs MySQL80 up, and it uses its own
> ports and schema, so it never touches the dev database. Screenshots named
> for the manuscript figures land in `e2e/screenshots/`.
>
> **All nine phases are built.** What is left is human: a server and domain,
> DEPLOYMENT.md section 8's first-run steps, the lexicon terms, the appraisal
> paperwork, and the open decisions below.
>
> **Things to ask Philipo about rather than do:** anything that types a
> password or gives a clinical-review attestation; writing lexicon terms,
> which are his to enter; the zero-suppression decision; and anything touching
> kizaru3214's `feat/pwa-ui-polish`, which is built on the replaced `main`.
>
> **Owed by humans, not code:** the reviewer's initials on the revised
> appraisal form (v1.1), one written confirmation from her for the appendix,
> clarification of 8 under-triage flags, a scan of the completed form, the
> reviewed lexicon terms, and the two manuscript `.docx` edits (Table 19
> `created_at`, the Data Dictionary intro sentence).
>
> To run it: MySQL80 must be up, then
> `cd apps/api && php -d variables_order=EGPCS artisan serve --no-reload`, and
> `npm run dev -w @mycare/pwa|portal|console` (5173 / 5174 / 5175). Offline
> testing by hand needs the production build: `npm run build -w @mycare/pwa`
> then `npm run preview -w @mycare/pwa` on 4173.
>
> Tell me what you understand the current state to be, and wait for direction -
> don't start new work yet.

## What this is

Offline-first PWA performing deterministic health triage on-device, in Cebuano
and Filipino, for geographically isolated barangays in Carcar City, Cebu.
BS Information Technology capstone; the manuscript is the specification.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo, CI, conventions | ✅ four CI workflows: `api`, `frontend`, `engine-purity`, `e2e` |
| 1 | Triage engine + ruleset schema | ✅ 12/12 |
| 2 | Ruleset v1 from the Clinical Appraisal Form | ✅ appraised and published (BUILD-LOG 8h, 8i); reviewer paperwork still owed |
| 3 | Laravel API + 20 migrations | ✅ no open defects |
| 4 | Super-admin console | ✅ built, and smoke-tested in a browser |
| 5 | Patient PWA | ✅ Figures 17–29, driven in a browser, offline included |
| 6 | Offline sync layer | ✅ both halves; retry without double-counting proven end to end |
| 7 | Sub-admin dashboard | ✅ built, and smoke-tested in a browser |
| 8 | Integration + offline E2E | ✅ merged (PR #3) |
| 9 | Deployment | ✅ on PR #4, proven by `deploy-smoke`, awaiting merge. No real server yet |

## Decisions taken 2026-09-17 (details in BUILD-LOG and ADRs)

- **No manuscript amendments** for any of Phases 4–9 (Philipo's instruction).
- Staff routes use `auth:web`; remember-me dropped (matches Figures 30/36);
  no guest redirect — all three staff-auth 500s fixed (ADR-0004).
- **Devices self-register anonymously, auto-approved**, rate-limited,
  revocable. Device tokens stored as prefix + SHA-256 digest (ADR-0005).
- **Tier recovery by replaying the real engine under Node** on the server —
  closes the `outcome_tier` tripwire without an amendment (ADR-0007).
- Every ruleset save writes a new version; publish needs a clinical-review
  attestation; rollback publishes a copy (ADR-0006).
- Patient UI text in Tagalog/Cebuano: Claude drafts, every string flagged for
  native + clinical review. **Done — `apps/pwa/src/i18n.ts` carries the review
  banner. English is the design's own copy, verbatim.**
- **No microphone button** (Figure 22): no offline Tagalog/Cebuano speech
  recogniser fits the device limits. Reasoning in BUILD-LOG.

## Decisions taken 2026-09-26

- **`main` replaced by our branch** (force-push, Philipo's instruction). The old
  `main` is kept locally as `backup/main-before-force-2026-09-26`.
- **E2E runs in its own schema, `mycare_e2e`**, on its own ports. `E2eSeeder`
  publishes v1 there as test fixture, not as an attestation, and refuses any
  other schema.
- **Symptoms in browser tests are entered by chip only** until reviewed
  lexicon terms exist. No test vocabulary is invented.
- **Deployment: one host split by path**, a guide with no server yet
  (Philipo's choice). The console moved to `/console/`.
- **Sanctum's session middleware is scoped to the staff and console routes**,
  not all of `/api`, so devices never get a session (ADR-0004 amendment).
- **The barangay list ships in the patient app, names only** (BUILD-LOG 9c).
  The server's id is resolved by name at first contact; the first run still
  needs signal once, for the published rules. Shipping v1 as an offline
  fallback was left for Philipo and his adviser.

## What's built and verified

- **Backend** (`apps/api`): Pest **181 passed, 731 assertions** against MySQL 8,
  locally and in CI.
- **Packages:** `triage-engine` 12/12 plus purity, `lexicon-matcher` 11/11
  plus purity, `engine-replay` 5/5, `api-client` 5/5, `ui` 9/9.
  `npm audit`: 0 vulnerabilities.
- **Apps:** `pwa` 33/33, `portal` 5/5, `console` 4/4. All three build for
  production in CI.
- **End to end** (`e2e/`): **7/7**, locally, in CI, **and through nginx on a
  freshly deployed server** (`deploy-smoke`). What each spec proves is in
  BUILD-LOG 9a and the end-to-end section of `docs/ut-matrix.md`.
- **Deployment** (`deploy/`, `docs/DEPLOYMENT.md`): proven by `deploy-smoke`
  on every PR. It builds a fresh Ubuntu 24.04 machine with the guide's
  commands, runs `deploy.sh`, checks the layout, headers, `/.env` refused and
  no stack traces, then runs the suite.

**What the browser run cannot prove:** Chrome 80 compatibility (Playwright
ships a current Chromium, so that rests on the `chrome80` build target and a
real handset), and free-text matching (no lexicon terms are published, and
test vocabulary may not be invented).

## Git state

- **`main` = `49b2d9a`**, force-pushed 2026-09-26 from
  `feat/UT-020-laravel-api-schema`. PR #1 shows as merged. `main` has no
  branch protection.
- **The old `main` (`55abd3b`, PR #2) is kept locally only**, as
  `backup/main-before-force-2026-09-26`. To restore it:
  `git push --force origin backup/main-before-force-2026-09-26:main`.
- **PR #3** (Phase 8) is merged (`a1d0e40`). Its branch is kept.
- **PR #4, `feat/UT-011-deployment`**: Phase 9, all five checks green.
- **`origin/feat/pwa-ui-polish`** (kizaru3214, 2026-09-26) is built on the
  replaced `main`'s patient app. It cannot merge cleanly; it needs a
  conversation with the team, not a merge.
- `origin/Gil` points at the very old `9358811`. Untouched.
- `feat/UT-020-laravel-api-schema` and `feat/UT-012-offline-e2e` are fully
  merged. Philipo asked to keep them: do not delete.
- **Someone else is working in this repo.** Fetch before assuming remote state.
- `CLAUDE.md` and the session transcripts are untracked on purpose.

## Environment notes (needed to run this on a fresh machine)

- **`pdo_mysql` must be enabled in `D:\php-8.4.13\php.ini`** (done; backup at
  `php.ini.bak-20260909`). That PHP install is shared with another project.
- MySQL 8 service `MySQL80`, user `root`, schemas `mycare`, `mycare_test` and
  `mycare_e2e` (the last is created by the E2E run itself).
  **The service was stopped once** and had to be started from an elevated
  prompt (`net start MySQL80`) — Claude's session cannot start it.
- Credentials only in gitignored `apps/api/.env` and `.env.testing`.
- **Node 20.20 is needed by the API too**: dashboards refresh by replaying
  sessions through `packages/engine-replay`. Build it with
  `npm run build -w @mycare/engine-replay` before running Pest or aggregation.
- The v1 import test reads `packages/ruleset/dist/v1.json`; create it with
  `npm run export:v1 -w @mycare/ruleset` (the test skips without it).
- **Run the API locally with**
  `php -d variables_order=EGPCS artisan serve --no-reload`. Plain
  `php artisan serve` drops `TMP`/`TEMP` from the server process, so PHP cannot
  run Node: the System Health screen then reports engine replay as down. The
  `mycare:aggregate` command from a normal terminal is unaffected, and so is
  Linux deployment under php-fpm.
- Playwright's Chromium is installed once with `npx playwright install chromium`.
- Windows gotchas: `pest --filter 'a|b'` fails in PowerShell (cmd reads `|` as
  a pipe — use Bash), and Windows Python cannot read Git Bash's `/tmp`.

## Known gaps / open items

### Closed, without amendments

- ~~`auth:sanctum` bearer 500; remember-me 500; no-`Accept` 500~~ (ADR-0004).
- ~~Phase 4 tripwire: override-threshold tier unrecoverable~~ — engine replay
  (ADR-0007). `SessionTierResolver` is deleted.
- ~~`RULE_CONDITION` has no sequence column~~ — immutable versions make the
  primary key the sequence (ADR-0006).
- ~~Nothing publishes v1 into the database~~ — `mycare:ruleset:import` and the
  console's import (both land as a draft).
- ~~`DEVICE.api_token` stored in plaintext~~ — prefix + digest (ADR-0005).
- ~~`FACILITY` orphaned~~ — it powers "Call for help" (ADR-0005).
- ~~v1 not published~~ — published by Philipo 2026-09-25 (BUILD-LOG 8h).
- ~~CI red on `main` (25 Pest failures)~~ — the `api` job builds engine
  replay; a `frontend` job exists (BUILD-LOG 9a).
- ~~No UI ever opened in a browser~~ — the Playwright suite (BUILD-LOG 9a).
- ~~Result screen showed raw symptom codes; Settings spacing; devices
  over-reporting their queue after an upload~~ — fixed on PR #3
  (BUILD-LOG 9a).
- ~~Phone uploads rejected with 419 on the one-host layout~~ — Sanctum's
  session middleware scoped to staff and console (PR #4, ADR-0004).
- ~~`composer.json`'s dead `database.sqlite` line~~ — removed (PR #4).
- ~~`APP_DEBUG=false` in production~~ — in `deploy/env.production.example`,
  and `deploy-smoke` checks that no stack trace leaks.

### Still open

- **No lexicon terms, clarification questions or health tips exist.** Free
  text matches nothing, and chips show v1's clinician wording in English
  whatever the language. Philipo has the reviewed terms and will enter them.
- **Zero suppression** — `SuppressionRule` renders a true 0 as `<5`. It is now
  visible on real screens ("Sessions waiting on devices" when nothing is
  waiting). Philipo's call, still not made.
- **The PWA's Tagalog and Cebuano interface copy is an unreviewed draft.** It
  needs a native speaker and a clinician, especially the three verdicts, the
  advice under each, the disclaimer and the emergency instruction.
- **Figure 38's "Sub-admin · RHU/LGU" label** cannot be stored (one role, no
  column); the console shows "Sub-admin".
- **Figure 37's "report worker"** does not exist (no queue); the service panel
  shows the aggregation job and engine replay instead.
- **Self-registration** means anyone can register a device and upload
  plausible-looking sessions; surveillance figures are indicative. Revocation
  exists, and every session names its device.
- **Complementary suppression is per partition only**; combining several
  breakdowns could still narrow a masked range (ADR-0007).
- **Cluster-detection thresholds** (`config/mycare.php`) need review by the
  City Health Office before anyone acts on a banner.
- **Barangay list** (from PhilAtlas) and the **facility CSV** need confirming
  or supplying by the City Health Office. With no facilities, "Call for help"
  falls back to 911.
- **No real server yet.** DEPLOYMENT.md is proven on a CI machine, not on the
  host a defence panel would see. It needs a server, a domain and certbot.

**Manuscript edits still owed by Philipo** — both approved long ago, neither is
a new amendment: the `created_at` row in Table 19, and the Data Dictionary
intro sentence that claims only aggregates sync.

## Next steps, in order

1. **Review and merge PR #4** (Philipo).
2. **Get a server and a domain**, then follow `docs/DEPLOYMENT.md`. The
   first-run steps in section 8 are yours: super-admin password, the v1
   publish attestation, facilities CSV, sub-admin accounts.
3. **Talk to the team about `feat/pwa-ui-polish`.** It is built on the patient
   app `main` no longer has.
4. **Enter the reviewed lexicon terms** (Philipo), then add a free-text
   browser test that uses them.
5. **Final docs pass:** REPO.md (add `deploy/`, `e2e/`), README.

## Commands to re-verify state

```bash
npm install
npm run build -w @mycare/engine-replay
npm run export:v1 -w @mycare/ruleset
npm test -w @mycare/triage-engine        # 12/12
npm test -w @mycare/lexicon-matcher      # 11/11
npm test -w @mycare/engine-replay        # 5/5
npm test -w @mycare/api-client           # 5/5
npm test -w @mycare/ui                   # 9/9
npm run purity -w @mycare/triage-engine
npm run purity -w @mycare/lexicon-matcher

npm test -w @mycare/console              # 4/4
npm test -w @mycare/portal               # 5/5
npm test -w @mycare/pwa                  # 33/33

cd apps/api
php artisan migrate:fresh --seed --force
./vendor/bin/pest                        # 181 passed, 731 assertions
cd ../..

# End to end. MySQL80 must be up. Own ports (8100/4273/5274/5275) and own
# schema (mycare_e2e), so the dev servers and dev database are untouched.
npx playwright install chromium          # once
npm run e2e -w @mycare/e2e               # 7/7
npm run e2e:report -w @mycare/e2e        # open the HTML report

# Run it locally (the flags matter on Windows — see Environment notes):
php -d variables_order=EGPCS artisan serve --no-reload
npm run dev -w @mycare/console           # http://localhost:5175/console/
npm run dev -w @mycare/portal            # http://localhost:5174/portal/
npm run dev -w @mycare/pwa               # http://localhost:5173
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`.
- PR #4 (Phase 9): https://github.com/PHILIPORACOMA/My-Care/pull/4
- PR #3 (Phase 8, merged): https://github.com/PHILIPORACOMA/My-Care/pull/3
- Deployment guide: `docs/DEPLOYMENT.md`
- PR #1 (Phases 3–8, merged by the force-push):
  https://github.com/PHILIPORACOMA/My-Care/pull/1
- `CLAUDE.md` is intentionally **not committed**.
