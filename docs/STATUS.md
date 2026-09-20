# Development status checkpoint

Last updated: **2026-09-18.** Phases 4–9 are being built on branch
`feat/UT-020-laravel-api-schema`. All backend work for Phases 4, 6 (server side) and
7 is done and verified, and **all three front ends are built** — the super-admin
console, the sub-admin portal, and now the patient PWA with the device half of
the sync layer. The team's design canvas has been applied throughout. What
remains is Milestone 9 (browser + offline E2E, CI) and Milestone 10
(deployment). `docs/BUILD-LOG.md` is the long-form record.

Update this file at the end of any session that changes phase status, adds a
major decision, or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `CLAUDE.md`, `docs/STATUS.md` and `docs/BUILD-LOG.md` first, then ADRs
> 0005–0007 in `docs/adr/`. Skim `docs/REPO.md` and `docs/ut-matrix.md`.
>
> We are finishing Phases 4–9 on branch `feat/UT-020-laravel-api-schema` with **no
> manuscript amendments**. Backend Milestones 0–4 and the shared packages
> (Milestone 5) are committed and verified: Pest 176/716, engine 12/12,
> lexicon-matcher 11/11, engine-replay 5/5, api-client 5/5, ui 9/9,
> console 4/4, portal 5/5, pwa 24/24.
>
> Milestones 6 (console), 7 (portal) and 8 (patient PWA + offline sync) are
> committed, along with the design import. Everything is covered by tests, but
> **no UI has been opened in a real browser yet**, and the PWA has never run
> against a live API — that is the first job of Milestone 9.
>
> Both branch names now point at the same commit (`6047f04`) and **PR #1
> contains all 36 commits**. `main` is NOT merged in: kizaru3214's PR #2 put a
> second patient app at `apps/pwa` there, and Philipo is settling with the team
> which one survives. Do not merge `main` or re-merge that work unless he says
> so.
>
> Continue the plan in `docs/BUILD-LOG.md`: E2E + CI (9), deployment (10),
> final docs pass. The honest first task is Playwright, because it is what
> finally opens all three apps in a real browser.
>
> Two things need me, not you: **MySQL80 is stopped** (needs an elevated
> `net start MySQL80` before anything touches the API), and the Tagalog and
> Cebuano copy in `apps/pwa/src/i18n.ts` is an unreviewed draft.
>
> Tell me what you understand the current state to be, and wait for direction —
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

- **`feat/UT-020-laravel-api-schema`** — `1b51e0a`, 37 commits ahead of `main`,
  pushed. The branch name is a misnomer now: it carries Phases 3 through 8.
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

- **v1 ruleset is not clinician-reviewed**, and no lexicon terms, clarification
  questions or health tips exist yet. The console can hold them; the content
  must come from the team.
- **The `mycare` database has no usable ruleset.** `demo-v1` is published, but
  its two rules have **zero conditions** (`rule_conditions` is empty), so no
  rule can match: the app offers no chips and every triage falls to the `rhu`
  fail-safe. Found by running the PWA against the live API on 2026-09-20. The
  fix is to author or import a real ruleset and publish it — which asserts
  clinical review, so it is Philipo's to do. That database also holds only
  Valladolid, not the seeded 15 barangays.
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

1. ~~Milestone 6 (console)~~ and ~~Milestone 7 (portal)~~ **done 2026-09-18.**
   Still worth clicking through Figures 30–41 in a browser once.
2. ~~**Milestone 8 — patient PWA + offline sync**~~ **done 2026-09-18.**
3. **Milestone 9 — E2E + CI:** Playwright offline triage-and-sync test (which
   also finally opens all three apps in a real browser), CI for the packages and
   apps, Node in the `api` job.
5. **Milestone 10 — deployment:** nginx, PHP-FPM, scheduler cron, Node, HTTPS,
   env checklist, `docs/DEPLOYMENT.md`.
6. **Final docs pass:** REPO.md, ut-matrix (UT-001, 002, 006, 012, 013 device
   side), CLAUDE.md phase table, README.
7. Push both branches when Philipo says so.

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
npm test -w @mycare/pwa                  # 24/24

cd apps/api
php artisan migrate:fresh --seed --force
./vendor/bin/pest                        # 176 passed, 716 assertions

# Run it locally (the flags matter on Windows — see Environment notes):
php -d variables_order=EGPCS artisan serve --no-reload
npm run dev -w @mycare/console           # http://localhost:5175
npm run dev -w @mycare/portal            # http://localhost:5174/portal/
npm run dev -w @mycare/pwa               # http://localhost:5173
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`. PR #1:
  https://github.com/PHILIPORACOMA/My-Care/pull/1
- `main` is still at `9358811`.
- `CLAUDE.md` is intentionally **not committed**.
