# Development status checkpoint

Last updated: **2026-09-26.** Phase 8 (integration and offline E2E) is built
and green on **PR #3, `feat/UT-012-offline-e2e`**, waiting for review and merge.
`main` is now the former `feat/UT-020-laravel-api-schema` (force-pushed
2026-09-26 at Philipo's instruction). What remains is Phase 9, deployment.
`docs/BUILD-LOG.md` is the long-form record.

**All three apps have now been opened in a real browser** (BUILD-LOG 9a). The
Playwright suite runs the patient journey against the real API, MySQL 8 and
the patient app's production build: triage offline across all three tiers,
upload on reconnect, and a dropped response retried without double-counting.
Portal and console are smoke-tested screen by screen. **All four CI checks
pass on GitHub**: `api`, `frontend`, `engine-purity`, `e2e`.

Update this file at the end of any session that changes phase status, adds a
major decision, or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `CLAUDE.md`, `docs/STATUS.md` and `docs/BUILD-LOG.md` first (entries
> 8h, 8i and 9a cover the recent work), then ADRs 0005-0007 in `docs/adr/`.
> Skim `docs/REPO.md` and `docs/ut-matrix.md` (its end-to-end section is new).
>
> `main` was force-pushed on 2026-09-26 to what was
> `feat/UT-020-laravel-api-schema`. PR #1 closed as merged. The old `main`
> (PR #2's patient app) is kept locally as
> `backup/main-before-force-2026-09-26`. Phase 8 is on **PR #3,
> `feat/UT-012-offline-e2e`**, with all four CI checks green. Standing rule:
> **no manuscript amendments**.
>
> **Phase 8 is done once PR #3 is merged:** Playwright (`e2e/`) drives all
> three apps against the real API, MySQL 8 (`mycare_e2e`, rebuilt every run)
> and the patient app's production build. Run it with
> `npm run e2e -w @mycare/e2e`. It needs MySQL80 up, and it uses its own
> ports and schema, so it never touches the dev database. Screenshots named
> for the manuscript figures land in `e2e/screenshots/`.
>
> **Next is Phase 9, deployment:** nginx, PHP-FPM, scheduler cron, Node 20
> plus an `engine-replay` build on the server, HTTPS, env checklist
> (`APP_DEBUG=false`), and `docs/DEPLOYMENT.md`.
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
| 8 | Integration + offline E2E | ✅ on PR #3, all checks green, awaiting merge |
| 9 | Deployment | ⬜ next |

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

## What's built and verified

- **Backend** (`apps/api`): Pest **176 passed, 716 assertions** against MySQL 8,
  locally and in CI.
- **Packages:** `triage-engine` 12/12 plus purity, `lexicon-matcher` 11/11
  plus purity, `engine-replay` 5/5, `api-client` 5/5, `ui` 9/9.
  `npm audit`: 0 vulnerabilities.
- **Apps:** `pwa` 26/26, `portal` 5/5, `console` 4/4. All three build for
  production in CI.
- **End to end** (`e2e/`): **6/6**, locally and in CI, in about a minute and a
  half. What each spec proves is in BUILD-LOG 9a and the end-to-end section of
  `docs/ut-matrix.md`.

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
- **PR #3, `feat/UT-012-offline-e2e`**: Phase 8, all four checks green.
- **`origin/feat/pwa-ui-polish`** (kizaru3214, 2026-09-26) is built on the
  replaced `main`'s patient app. It cannot merge cleanly; it needs a
  conversation with the team, not a merge.
- `origin/Gil` points at the very old `9358811`. Untouched.
- `feat/UT-020-laravel-api-schema` is now identical to `main` and can be
  deleted.
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
- `apps/api/composer.json` still has the dead `post-create-project-cmd` line
  touching `database/database.sqlite`.
- `APP_DEBUG=false` in production (deployment checklist).

**Manuscript edits still owed by Philipo** — both approved long ago, neither is
a new amendment: the `created_at` row in Table 19, and the Data Dictionary
intro sentence that claims only aggregates sync.

## Next steps, in order

1. **Review and merge PR #3** (Philipo).
2. **Talk to the team about `feat/pwa-ui-polish`.** It is built on the patient
   app `main` no longer has.
3. **Phase 9, deployment:** nginx, PHP-FPM, scheduler cron for
   `mycare:aggregate`, Node 20 plus the `engine-replay` build on the server,
   HTTPS, env checklist, `docs/DEPLOYMENT.md`.
4. **Enter the reviewed lexicon terms** (Philipo), then add a free-text
   browser test that uses them.
5. **Final docs pass:** REPO.md, README, CLAUDE.md phase table.

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
npm test -w @mycare/pwa                  # 26/26

cd apps/api
php artisan migrate:fresh --seed --force
./vendor/bin/pest                        # 176 passed, 716 assertions
cd ../..

# End to end. MySQL80 must be up. Own ports (8100/4273/5274/5275) and own
# schema (mycare_e2e), so the dev servers and dev database are untouched.
npx playwright install chromium          # once
npm run e2e -w @mycare/e2e               # 6/6
npm run e2e:report -w @mycare/e2e        # open the HTML report

# Run it locally (the flags matter on Windows — see Environment notes):
php -d variables_order=EGPCS artisan serve --no-reload
npm run dev -w @mycare/console           # http://localhost:5175
npm run dev -w @mycare/portal            # http://localhost:5174/portal/
npm run dev -w @mycare/pwa               # http://localhost:5173
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`.
- PR #3 (Phase 8): https://github.com/PHILIPORACOMA/My-Care/pull/3
- PR #1 (Phases 3–8, merged by the force-push):
  https://github.com/PHILIPORACOMA/My-Care/pull/1
- `CLAUDE.md` is intentionally **not committed**.
