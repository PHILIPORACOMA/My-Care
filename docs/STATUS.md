# Development status checkpoint

Last updated: **2026-09-17, end of session.** Phases 4–9 are being built on
branch `feat/UT-011-phases-4-to-9`. **All backend work for Phases 4, 6 (server
side) and 7 is done and verified**, the shared frontend packages are done, and
the **super-admin console is written but not yet run or tested** — that is where
work stops. `docs/BUILD-LOG.md` is the long-form record of everything below.

Update this file at the end of any session that changes phase status, adds a
major decision, or closes/opens a known gap — don't let it drift.

## Resume prompt

Paste this into a new chat session to pick up where this one left off:

> Read `CLAUDE.md`, `docs/STATUS.md` and `docs/BUILD-LOG.md` first, then ADRs
> 0005–0007 in `docs/adr/`. Skim `docs/REPO.md` and `docs/ut-matrix.md`.
>
> We are finishing Phases 4–9 on branch `feat/UT-011-phases-4-to-9` with **no
> manuscript amendments**. Backend Milestones 0–4 and the shared packages
> (Milestone 5) are committed and verified: Pest 174/708, engine 12/12,
> lexicon-matcher 11/11, engine-replay 5/5, api-client 5/5, ui 9/9.
>
> **Milestone 6 (super-admin console, `apps/console`) is written but
> uncommitted and has never been run** — no typecheck, no tests, no build, no
> browser. Start there: `npm install`, `npm run typecheck -w @mycare/console`,
> `npm test -w @mycare/console`, fix what breaks, then run it against
> `php artisan serve` and click through Figures 36–41 before committing.
>
> Then continue the plan in `docs/BUILD-LOG.md`: portal (7), patient PWA and
> offline sync (8), E2E + CI (9), deployment (10), final docs pass.
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
| 4 | Super-admin console | 🔨 **API ✅** (rules lifecycle, accounts, devices, audit, health). **UI written, unverified, uncommitted** |
| 5 | Patient PWA | 🔨 lexicon matcher (NLP) ✅; app ⬜ |
| 6 | Offline sync layer | 🔨 server side ✅ (self-registration, idempotent sync, pending-queue reporting); device side ⬜ |
| 7 | Sub-admin dashboard | 🔨 **API ✅** (dashboard, trends, sync status, map, CSV/PDF reports); UI ⬜ |
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
  native + clinical review (not started yet — Milestone 8).
- **No microphone button** (Figure 22): no offline Tagalog/Cebuano speech
  recogniser fits the device limits. Reasoning in BUILD-LOG.

## What's built and verified

Backend (`apps/api`) — **Pest 174 passed, 708 assertions** against MySQL 8:

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

Written, **not yet verified**: `apps/console` (Figures 36–41) — login, system
dashboard, user management, rules & lexicon editor with a test/explain panel,
symptom codes, sync & health with device revocation, audit log with export.

## Git state

- **`feat/UT-011-phases-4-to-9`** (local only, **not pushed**): 5 commits,
  `18acb14` → `65fd93b`, stacked on the PR #1 branch, plus the docs commit
  that carries this file. Uncommitted: `apps/console/`.
- **`feat/UT-020-laravel-api-schema`** (PR #1): `5aa26c7` and `7cd72ae` are
  committed locally but **not pushed**. Everything before them is on origin.
- `CLAUDE.md` and the two session transcripts are untracked on purpose.

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
  must come from the team. Until lexicon terms exist, free text matches nothing
  and patients rely on symptom chips.
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

1. **Verify Milestone 6 (console):** install, typecheck, test, build, run it
   against the API, click through Figures 36–41, fix, commit.
2. **Milestone 7 — portal** (`apps/portal`, Figures 30–35).
3. **Milestone 8 — patient PWA + offline sync** (`apps/pwa`, Figures 17–29):
   onboarding, symptom input with chips, clarification, result screens, health
   tips, settings; IndexedDB queue, device registration, bundle updates,
   idempotent batch upload; Tagalog/Cebuano drafts flagged for review.
4. **Milestone 9 — E2E + CI:** Playwright offline triage-and-sync test, CI for
   the packages and apps, Node in the `api` job.
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

cd apps/api
php artisan migrate:fresh --seed --force
./vendor/bin/pest                        # 174 passed, 708 assertions
```

## Repo pointers

- Remote: `origin` → `PHILIPORACOMA/My-Care.git`. PR #1:
  https://github.com/PHILIPORACOMA/My-Care/pull/1
- `main` is still at `9358811`.
- `CLAUDE.md` is intentionally **not committed**.
