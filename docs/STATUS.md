# Development status checkpoint

Last updated: **2026-09-25.** Phases 4–9 are being built on branch
`feat/UT-020-laravel-api-schema`. All backend work for Phases 4, 6 (server side) and
7 is done and verified, and **all three front ends are built** — the super-admin
console, the sub-admin portal, and now the patient PWA with the device half of
the sync layer. The team's design canvas has been applied throughout. What
remains is Milestone 9 (browser + offline E2E, CI) and Milestone 10
(deployment). `docs/BUILD-LOG.md` is the long-form record.

**`v1` is published and the whole chain is verified** (BUILD-LOG 8h): a
device pulls 23 appraised rules, triages on-device to the right tier, syncs,
and the aggregates carry tiers recovered by engine replay. 41 sessions of
local synthetic data make the dashboards show numbers on both sides of the
`<5` suppression rule. **What remains unverified is every UI in a browser**,
and four appraisal items are still owed by the reviewer (BUILD-LOG 8i).

Update this file at the end of any session that changes phase status, adds a
major decision, or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `CLAUDE.md`, `docs/STATUS.md` and `docs/BUILD-LOG.md` first (the log's
> most recent entries are 8a-8g), then ADRs 0005-0007 in `docs/adr/`. Skim
> `docs/REPO.md` and `docs/ut-matrix.md`.
>
> One branch: **`feat/UT-020-laravel-api-schema`**, pushed, and PR #1 carries
> all of it (Phases 3-8). Standing rule: **no manuscript amendments**.
>
> Built and tested: the Laravel API (Pest 176/716 against MySQL 8), the
> super-admin console, the sub-admin portal, and the patient PWA with both
> halves of the offline sync layer. `npm test` is 48 across the workspaces.
>
> **Three things are true that the test suite cannot tell you:**
>
> 1. **No UI has ever been opened in a browser.** A styling pass on 2026-09-23
>    found two classes used but never defined in the patient app - visible
>    duplicate text, and a row with no layout - and 47 passing tests missed
>    both. Playwright (Milestone 9) is the fix and is the next real task.
> 2. **Nothing is published**, so `GET /api/v1/ruleset/current` returns 503 and
>    the patient app cannot triage at all. `v1` sits in the database as a
>    draft.
> 3. **There are no staff accounts** - the 2026-09-20 reset left `users: 0`.
>
> **Do not do these for Philipo:** create the super-admin (the command prompts
> for a password, which is his to type), or publish a ruleset (publishing
> attests that clinical review happened and audits who said so). Ask him.
>
> `main` is NOT merged in: kizaru3214's PR #2 put a second patient app at
> `apps/pwa` there, PR #1 conflicts with it, and GitHub will not run CI on a
> conflicting PR - so Phases 4-8 have never been through CI. Philipo is
> settling with the team which patient app survives. Do not merge `main` or
> re-merge that work unless he says so.
>
> Continue the plan in `docs/BUILD-LOG.md`: E2E + CI (9), deployment (10),
> final docs pass.
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
| 0 | Monorepo, CI, conventions | ✅ — CI workflows not yet updated for the new packages (Milestone 9) |
| 1 | Triage engine + ruleset schema | ✅ 12/12 |
| 2 | Ruleset v1 from the Clinical Appraisal Form | ✅ encoded; ⚠️ **not clinician-reviewed** |
| 3 | Laravel API + 20 migrations | ✅ no open defects |
| 4 | Super-admin console | ✅ API + UI built and verified (not yet clicked through in a browser) |
| 5 | Patient PWA | ✅ Figures 17–29 built; 24/24 (no browser run yet) |
| 6 | Offline sync layer | ✅ both halves — server (self-registration, idempotent sync, queue reporting) and device (IndexedDB queue, stable batch uuid, bundle caching) |
| 7 | Sub-admin dashboard | ✅ API + UI built and verified (not yet clicked through in a browser) |
| 8 | Integration + offline E2E | ⬜ |
| 9 | Deployment | ⬜ |

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

## What's built and verified

Backend (`apps/api`) — **Pest 176 passed, 716 assertions** against MySQL 8:

- Device API: self-registration, hashed tokens, public barangay list,
  facilities for "Call for help", `X-Pending-Sessions` queue reporting.
- Console API: ruleset versions (draft → review → publish, rollback, import),
  symptom codes, sub-admin accounts (create, deactivate, reactivate, reassign),
  devices (revoke/reinstate), audit log (read-only), system health.
- Staff API: dashboard, trends with cluster detection, sync status, map,
  CSV/PDF reports, de-identified audit export.
- `mycare:aggregate` (scheduled every 10 min), `mycare:ruleset:import`,
  `mycare:facilities:import`, `mycare:staff:create-super-admin`.
- `BarangaySeeder` (15 Carcar barangays, PhilAtlas) now in `migrate --seed`.

Packages — all typecheck clean:

- `triage-engine` 12/12 + purity ✅ · `lexicon-matcher` 11/11 + purity ✅ ·
  `engine-replay` 5/5 · `api-client` 5/5 · `ui` 9/9.
- `npm audit`: 0 vulnerabilities; `composer audit`: clean.

`apps/console` (Figures 36–41) — login, system dashboard, user management,
rules & lexicon editor with a test/explain panel, symptom codes, sync & health
with device revocation, audit log with export. **Verified 2026-09-18:**
typecheck clean, 4/4 tests, production build (242 kB, 76 kB gzipped), and a live
sign-in through the Vite proxy with every console and staff endpoint
returning 200.

`apps/portal` (Figures 30–35) — login, dashboard, trends with the cluster
banner and watch list, sync & status, data & reports, aggregate map. **Verified
2026-09-18:** typecheck clean, 4/4 tests, production build (207 kB, 68 kB
gzipped), and a live sign-in as the sub-admin: every staff endpoint 200, the
barangay list correctly showing only Valladolid, the console refusing them with
403, and a CSV report generated and downloaded with every count suppressed.

`apps/pwa` (Figures 17–29) — splash, the three onboarding steps (language,
18+, barangay), home, symptom input by free text or chips, clarification,
processing, the three result screens, health tips, settings. **The tier is
computed on the device** by the real matcher and the real engine against a
cached bundle; finished sessions queue in IndexedDB and upload with a stable
batch uuid. **Verified 2026-09-18:** typecheck clean, 24/24 tests (triage 13,
sync 8, and three full journeys driving the real UI — a Cebuano walk-through, a
red-flag escalation, and a triage completed with `fetch` throwing on every
call), production build 59 kB gzipped, 225 KiB precached, Poppins self-hosted
at 31 kB. **Run against the live API 2026-09-20** (BUILD-LOG 8d): registration,
ruleset pull, on-device matching and triage, sync, and a replayed batch that
did not double-count. **Still never opened in a browser.**

## Git state

**There is now one branch: `feat/UT-020-laravel-api-schema`.** Phases 4–9 were
built on a second branch, `feat/UT-011-phases-4-to-9`, stacked on this one so
that PR #1 could stay a reviewable Phase 3 on its own. Nobody ever reviewed it
separately, so on 2026-09-19 this branch was fast-forwarded to match and on
2026-09-20 the duplicate was **deleted**, locally and on GitHub. Every commit
survives here; nothing was lost. Do not recreate it.

- **`feat/UT-020-laravel-api-schema`** — `99d0e44`, 42 commits ahead of `main`,
  pushed and in sync. The branch name is a misnomer now: it carries Phases 3
  through 8.
- **PR #1 now contains all of it** — Phases 3 through 8, 278 files. Its title
  still says "Phase 3", which no longer describes it.
- **PR #1 is `CONFLICTING`, so GitHub will not run CI on it.** Pull-request
  workflows build a trial merge into `main`; with conflicts there is nothing to
  build, and no run exists for `1b51e0a`. **Phases 4–8 have never been through
  CI.** Resolving the `apps/pwa` conflict unblocks both the merge and CI.
- **Someone else is working in this repo.** The duplicate branch had already
  been deleted from GitHub by the time we went to delete it (2026-09-20), and
  `origin/Gil` exists. Fetch before assuming remote state.
- **`main` has moved and we have not merged it.** kizaru3214's PR #2 (patient
  PWA + a 124-term invented lexicon draft) landed on `main` 2026-09-18 03:36Z
  and occupies `apps/pwa`, the same path as ours. Merging it here was tried and
  **reverted at Philipo's instruction** — he is taking the overlap to the team.
  A dry-run merge gives 8 add/add conflicts; the two patient apps cannot be
  reconciled line by line, so one of them has to win.
- `CLAUDE.md` and the three session transcripts are untracked on purpose.

## Environment notes (needed to run this on a fresh machine)

- **`pdo_mysql` must be enabled in `D:\php-8.4.13\php.ini`** (done; backup at
  `php.ini.bak-20260909`). That PHP install is shared with another project.
- MySQL 8 service `MySQL80`, user `root`, schemas `mycare` and `mycare_test`.
  **The service was stopped once this session** and had to be started from an
  elevated prompt (`net start MySQL80`) — this session cannot start it.
- Credentials only in gitignored `apps/api/.env` and `.env.testing`.
- **Node 20.20 is now needed by the API too**: dashboards refresh by replaying
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
- Windows gotchas hit this session: `pest --filter 'a|b'` fails in PowerShell
  (cmd reads `|` as a pipe — use Bash), and Windows Python cannot read Git
  Bash's `/tmp`.

## Known gaps / open items

### Closed this session, without amendments

- ~~`auth:sanctum` bearer 500; remember-me 500; no-`Accept` 500~~ (ADR-0004).
- ~~Phase 4 tripwire: override-threshold tier unrecoverable~~ — engine replay
  (ADR-0007). `SessionTierResolver` is deleted.
- ~~`RULE_CONDITION` has no sequence column~~ — immutable versions make the
  primary key the sequence (ADR-0006).
- ~~Nothing publishes v1 into the database~~ — `mycare:ruleset:import` and the
  console's import (both land as a draft).
- ~~`DEVICE.api_token` stored in plaintext~~ — prefix + digest (ADR-0005).
- ~~`FACILITY` orphaned~~ — it powers "Call for help" (ADR-0005).

### Still open

- **v1 is appraised, but not yet published.** The clinical appraisal form came
  back 2026-09-20: all appropriateness items 4, no under-triage risk (physical
  copy; the .docx is the blank template and **the filled one still needs
  scanning for the appendix**). The encoded ruleset was verified row by row
  against the form - 23 of 23 match. It sits in the database as a **draft**;
  publishing it records the attestation and is Philipo's to do.
- **No lexicon terms, clarification questions or health tips exist.** Free text
  therefore matches nothing and patients rely on chips. Philipo has the
  reviewed terms and will enter them himself.
- **The dev database was reset 2026-09-20** (BUILD-LOG 8e): 15 barangays, `v1`
  imported as a draft with 23 rules and 23 conditions, and no test junk. Two
  consequences until Philipo acts: **there are no staff accounts** (recreate
  with `php artisan mycare:staff:create-super-admin <email>`, which prompts for
  the password), and **nothing is published, so `/api/v1/ruleset/current`
  returns 503 and the patient app cannot triage.**
- **No UI has been seen rendered, and that has already cost something.** The
  2026-09-23 styling pass (BUILD-LOG 8f) found two classes used but never
  defined in the patient app: screen-reader-only labels were rendering as
  visible duplicate text, and Home's pill row had no layout. 47 passing tests
  did not catch either. Playwright is the fix.
- **The PWA's Tagalog and Cebuano interface copy is an unreviewed draft.** It
  needs a native speaker and a clinician, especially the three verdicts, the
  advice under each, the disclaimer and the emergency instruction.
- **Zero suppression** — `SuppressionRule` still renders a true 0 as `<5`.
  Philipo's call, still not made.
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
  or supplying by the City Health Office.
- **CI is not updated**: the `api` job needs Node and an `engine-replay` build
  (replay tests fail otherwise), and the new packages and apps need a frontend
  job. `actions/checkout@v4` / `cache@v4` → `@v5` still pending.
- `apps/api/composer.json` still has the dead `post-create-project-cmd` line
  touching `database/database.sqlite`.
- `APP_DEBUG=false` in production (deployment checklist).

**Manuscript edits still owed by Philipo** — both approved long ago, neither is
a new amendment: the `created_at` row in Table 19, and the Data Dictionary
intro sentence that claims only aggregates sync.

## Next steps, in order

**Philipo first — nothing below him can be tested until these are done.**

1. **Create the super-admin.** The command prompts for the password rather
   than taking it as an argument, so it never lands in shell history; typing
   it is his, not Claude's:
   ```bash
   cd apps/api && php artisan mycare:staff:create-super-admin super@mycare.test
   ```
   At least 12 characters, letters and numbers.
2. **Publish `v1`.** Sign in at the console (`:5175`), Rules & Lexicon →
   **Submit for review** → **Publish**, ticking the clinical-review
   confirmation. `v1` is a draft, and publish only accepts a version that is
   in review. This is an attestation: `RulesetLifecycle::publish()` refuses
   without it and audits who gave it, so **Claude must not click it** — the
   record would name Philipo for a sign-off he did not give. The paper
   appraisal (all items 4, no under-triage risk) is the basis for giving it.
3. **Enter the reviewed lexicon terms** he holds. Until they exist, free text
   matches nothing and patients rely on chips.
4. **Scan the completed appraisal form** for the manuscript appendix — the
   .docx in hand is the blank template.

**Then, in order:**

5. **Verify the patient app end to end** against the published ruleset: chips
   for all 23 presentations, a real tier, and the session reaching the
   portal's sync screen. Then the offline run from the production build
   (`:4173`, DevTools → Offline).
6. **Milestone 9 — E2E + CI:** Playwright offline triage-and-sync test (which
   also finally opens all three apps in a real browser), CI for the packages
   and apps, Node and an `engine-replay` build in the `api` job.
7. **Milestone 10 — deployment:** nginx, PHP-FPM, scheduler cron, Node, HTTPS,
   env checklist, `docs/DEPLOYMENT.md`.
8. **Final docs pass:** REPO.md, ut-matrix, CLAUDE.md phase table, README.
9. **The two patient apps.** Settle with the team which survives, then resolve
   PR #1's conflict with `main` — that unblocks both the merge and CI.

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
npm test -w @mycare/pwa                  # 25/25

cd apps/api
php artisan migrate:fresh --seed --force
./vendor/bin/pest                        # 176 passed, 716 assertions

# Run it locally (the flags matter on Windows — see Environment notes):
php -d variables_order=EGPCS artisan serve --no-reload
npm run dev -w @mycare/console           # http://localhost:5175
npm run dev -w @mycare/portal            # http://localhost:5174/portal/
npm run dev -w @mycare/pwa               # http://localhost:5173

# Testing offline needs the PRODUCTION build: the dev server does not register
# a service worker, so going offline against :5173 proves nothing.
npm run build -w @mycare/pwa
npm run preview -w @mycare/pwa           # http://localhost:4173, /api proxied
# then: onboard while online, DevTools > Network > Offline, hard reload.
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`. PR #1:
  https://github.com/PHILIPORACOMA/My-Care/pull/1
- `main` is still at `9358811`.
- `CLAUDE.md` is intentionally **not committed**.
