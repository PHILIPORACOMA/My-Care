# Build log — Phases 4 to 9

This is the running record of the build that finishes My Care after Phase 3.
It is written for Philipo: what was built, in what order, what was decided, and
what still needs a human. Each milestone below is appended when it lands, with
its verification result and commit.

`docs/STATUS.md` stays the short checkpoint. This file is the long form.

---

## Ground rules for this build

- **No manuscript amendments.** Where the Data Dictionary or a figure cannot
  support something, the workaround is done in code and written down here and
  in an ADR. Nothing below adds, renames or removes a column or table.
- **No invented clinical content.** No lexicon terms, triage rules,
  clarification questions or health tips are written by the build. The tools to
  author them are built; the content comes from the team and the clinical
  appraisal. Tests use only fixtures or the manuscript's own examples
  (`sipon` / `sip-on`, `walay hilanat` from Table 31).
- **Verification is by execution.** Every milestone records the test result it
  was committed with.

## Decisions taken before the build (2026-09-17)

| Question | Decision | Why |
|---|---|---|
| How does a patient phone get a `DEVICE` row and token? | **Self-registers anonymously, auto-approved**, rate-limited, revocable by a super-admin | Patient phones actually sync; revocation handles abuse |
| How is the tier of an override-threshold session recovered without `outcome_tier`? | **Replay the real triage engine (Node) on the server** during aggregation | One engine implementation, exact result — the Figure 41 reconstruction claim made literal |
| Who writes the Tagalog / Cebuano UI text? | **Drafted in the build, every string flagged for native + clinical review** | App usable in all three languages now; nothing ships unreviewed by accident |
| Figure 22's microphone | **Left out, documented** | No offline Tagalog/Cebuano recognizer fits the device limits (details below) |

### Why there is no microphone button

Checked 2026-09-17:

- Chrome's on-device speech recognition (`processLocally`) supports no Filipino
  or Cebuano, and needs Chrome 139+ against the manuscript's Chrome 80 minimum.
  Chrome's default speech recognition sends audio to Google, which breaks
  offline use and non-negotiable #8 (raw symptom input never leaves the device).
- Vosk (open source, runs offline in the browser) has a Tagalog model of
  320 MB — over Table 27's 100 MB storage — and no Cebuano model.
- Transformer models (Whisper-class) are excluded by the 2 GB RAM constraint.

The one design that fits is **symptom-only keyword spotting**: a small
non-transformer model that recognises only lexicon terms and feeds the same
matcher as typed text. It needs recorded voice samples per term from Tagalog and
Cebuano speakers (personal data, needs consent) and retraining per lexicon
version. Recorded as future work. The symptom chips, which Figure 22 itself says
lower the literacy barrier, are built.

## Plan

| # | Milestone | Phase |
|---|---|---|
| 0 | Last staff-auth 500 (no `Accept: application/json`) | 3 |
| 1 | Device self-registration, hashed device tokens, public barangay list, facilities | 4/6 |
| 2 | Ruleset lifecycle: authoring, versioning, review, publish, rollback, v1 importer | 4 |
| 3 | Sub-admin account management | 4 |
| 4 | Engine replay, aggregation, dashboard/trends/sync/map/report/audit endpoints | 7 |
| 5 | Shared packages: lexicon matcher (NLP), API client, UI kit | 4/5/7 |
| 6 | Super-admin console (Figures 36–41) | 4 |
| 7 | Sub-admin portal (Figures 30–35) | 7 |
| 8 | Patient PWA (Figures 17–29) and its offline sync layer | 5/6 |
| 9 | Integration and offline end-to-end tests, CI | 8 |
| 10 | Deployment configuration and guide | 9 |

---

## Milestones

### 0 — Last staff-auth 500

**Done.** `bootstrap/app.php` calls `redirectGuestsTo(null)`; an unauthenticated
staff request answers a JSON 401 whatever it accepts. Tests for no header,
`*/*` and `text/html` were red (500) first. Pest 98 passed / 335 assertions.
Commits `5aa26c7`, `7cd72ae` on `feat/UT-020-laravel-api-schema` (PR #1).

### 1 — Devices, tokens, barangays, facilities

**Done.** Pest 115 passed / 397 assertions. Full reasoning in
`docs/adr/0005-device-enrolment-and-facilities.md`.

What exists now:

- `POST /api/v1/devices` — a phone registers itself with only a barangay and a
  device type, is approved immediately, and receives its token once.
  Rate-limited to 10 an hour per IP.
- Device tokens are stored as a lookup prefix plus a SHA-256 digest inside the
  same `VARCHAR(80)` column. The old plaintext comparison is gone.
- `GET /api/v1/barangays` — public list for onboarding. `BarangaySeeder` (now in
  `migrate --seed`) adds Carcar City's 15 barangays from PhilAtlas.
- `GET /api/v1/facilities` — for the emergency "Call for help" button. Facility
  data comes from a CSV: `php artisan mycare:facilities:import facilities.csv`.
  This wires the previously orphaned `FACILITY` table.
- Devices report how many sessions they still hold offline in an
  `X-Pending-Sessions` header, for the sync screens.

**Needs a human:**

- The facility CSV (names, emergency numbers, hours) from the City Health
  Office.
- Confirm the 15 barangay names against the City Health Office's own list.
- Accept, for the defence, that self-registration means surveillance figures
  are indicative: anyone can register a device. Revocation exists.

### 2 — Ruleset lifecycle (Figure 39, UT-007–UT-011)

**Done.** Pest 136 passed / 512 assertions. Full reasoning in
`docs/adr/0006-ruleset-lifecycle.md`.

What exists now (all under `/api/v1/console/`, super-admin only):

- Draft → review → publish, with rollback. Every save writes a **new version**
  (UT-010); nothing is edited in place or deleted. Exactly one version is
  published at a time.
- Publishing requires ticking "clinical review took place". The software cannot
  verify a clinician; it records who attested.
- Rule expressions (`IF a AND NOT b THEN rhu`) are generated from the
  conditions, so the explanation can never disagree with the logic.
- Content validation catches the mistakes that would give a *wrong tier*
  silently: unknown codes, half-built conditions, non-numeric thresholds,
  red-flag answers that are not allowed answers, and language variants of a
  question that disagree on where the red-flag answer is.
- Symptom codes lock once a reviewed or published version uses them.
- **v1 import:** `npm run export:v1 -w @mycare/ruleset`, then
  `php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1.json`.
  Verified with the real file: 23 rules, 9 emergency. It lands as a **draft**.

Schema gap closed without an amendment: **condition order.** Because conditions
are only ever inserted in the author's order into a version that never changes,
the primary key is the sequence.

**Needs a human:**

- Clinical review of v1 before anyone publishes it.
- Lexicon terms, clarification questions and health tips — the console can hold
  them; the content has to come from the team.

### 3 — Account and device management (Figure 38, UT-019)

**Done.** Pest 148 passed / 559 assertions.

What exists now (`/api/v1/console/`, super-admin only):

- Create a sub-admin with an email, a password (12+ characters, letters and
  numbers) and one barangay. Signing in as that account returns the barangay
  scope — asserted end to end.
- Deactivate, reactivate (by setting a new password), reset a password, move a
  sub-admin to another barangay. A super-admin cannot deactivate themselves.
- List devices, revoke and reinstate them (audited).
- `php artisan mycare:staff:create-super-admin <email>` creates the first
  development-team account on a fresh server. The password is prompted, never
  typed on the command line.

How Figure 38's columns work **without** new columns:

- **Status** — `USER` has no status column. Deactivating replaces the password
  digest with a locked, bcrypt-shaped value no password can match (the old Unix
  account-locking trick). Sanctum's session check sees the digest change and
  ends the person's existing sessions on their next request. A test proves the
  session really ends, and was checked by removing the deactivation and watching
  it fail.
- **Creation date** — read from the audit log's `created` entry for the account.
- **"Sub-admin · RHU" vs "Sub-admin · LGU"** — **not implemented.** `ROLE` has a
  single `sub_admin` role (Figure 38's own caption says RHU and LGU share it) and
  `USER` has nowhere to store which one a person belongs to. The console shows
  "Sub-admin". This is the one Figure 38 detail the schema cannot express.

### 4 — Engine replay, aggregation, surveillance endpoints (UT-014, 016, 017, 018, 020)

**Done.** Pest 174 passed / 708 assertions; `@mycare/engine-replay` 5/5. Full
reasoning in `docs/adr/0007-replay-aggregation-and-surveillance.md`.

**The Phase 4 tripwire is closed without an amendment.** `TRIAGE_SESSION` has no
tier column, and the old `SessionTierResolver` read a session escalated by an
override threshold as `rhu`. Now the server replays each stored session through
the *same* triage engine the phone ran, against the exact ruleset version it
used. Because the engine is deterministic and published versions never change,
the replayed tier is the tier the patient saw. A test covers exactly the case the
old resolver got wrong. The old resolver is deleted.

What exists now:

- `php artisan mycare:aggregate` — scheduled every 10 minutes; rebuilds the last
  60 days of `AGGREGATE_STAT`. Idempotent. Days are Manila days.
- Portal endpoints (`/api/v1/staff/…`, sub-admin and super-admin): `dashboard`,
  `trends` (14-day chart, cluster banner, watch list), `sync-status`, `map`,
  `barangays`, `reports` (CSV/PDF generate, list, download).
- Console endpoints: `system-health` (Figures 37/40), `audit-logs` (Figure 41,
  read-only, filter by category), audit export as a de-identified report.
- **Privacy on every read path:** counts under 5 come out as
  `{display: "<5", value: null}` — the raw number is never in the response.
  When one part of a shown total is masked, a second part is masked too so
  nobody can subtract. Sub-admins only ever see their own barangay.

**Needs a human:**

- **Server needs Node 20** and `npm run build -w @mycare/engine-replay` for
  dashboards to refresh (deployment guide covers it).
- Review the cluster-detection thresholds (`config/mycare.php`) with the City
  Health Office's surveillance officer.

**Deviations from the figures (no column exists):** Figure 37's "report worker"
is replaced by the aggregation job and engine replay in the service panel
(there is no queue worker); audit categories are derived, not stored.

### 5 — Shared frontend packages (UT-002, UT-003, UT-004)

**Done.** lexicon-matcher 11/11, api-client 5/5, ui 9/9; typecheck and purity
clean; engine still 12/12.

- **`packages/lexicon-matcher`** — the on-device NLP layer. Pure and
  dependency-free like the engine, and checked by the same purity script (now
  shared at `scripts/check-purity.mjs`). It normalises text (case, accents,
  hyphens: `sip-on` → `sipon`), tolerates typos on words of five letters or
  more (never on short words, so `ubo` can never become `ulo`), handles split
  and run-together words, and treats **negation as lexicon content** — a term
  flagged `isNegation` like the manuscript's `walay hilanat`. It contains **no
  Cebuano or Tagalog vocabulary of its own**; every word comes from the
  published lexicon. If a symptom is mentioned both negated and plainly it is
  reported present, erring toward escalation. It proposes symptom codes only —
  it never assigns a tier. UT-003 and UT-004 are tested with the manuscript's
  own examples mapped to fixture codes.
- **`packages/api-client`** — typed client for the staff and console API.
  Cookie-based Sanctum: no token ever lives in JavaScript. Handles the CSRF
  cookie, retries once on an expired token (419), surfaces field errors.
- **`packages/ui`** — tokens and components for the portal (light, teal) and
  console (dark), following the storyboards. A `<Count>` component renders a
  suppressed cell as `<5` with an explanation; the chart draws a masked day as a
  fixed hatched block, never a bar sized to a hidden count.

**Dependencies:** the first set of frontend tools came back from `npm audit`
with a critical and a high advisory (old Vitest and Vite). They were replaced
with the current patched releases that still run on Node 20 — Vite 8,
Vitest 4, React Router 7, React 18.3.1 (the manuscript's pinned version).
`npm audit`: **0 vulnerabilities.**

### 6 — Super-admin console (Figures 36–41) — IN PROGRESS, stopped here

**Written, not verified, not committed.** Session ended 2026-09-17 at Philipo's
request before anything in `apps/console` was run. Expect type errors and
failing tests on the first run; fix them before committing.

What is written (`apps/console`, React 18 + Vite, dark theme, port 5175,
`/api` and `/sanctum` proxied to `php artisan serve` so the session cookie is
same-origin):

- `LoginPage` (Figure 36) — sign in; a signed-in sub-admin sees an explanation
  instead of the console.
- `SystemDashboardPage` (Figure 37) — barangays live, sync health, active
  sub-admins, published version, service health, activity.
- `UsersPage` (Figure 38) — list, add sub-admin, reset password / reactivate,
  change barangay, deactivate.
- `rules/RulesetListPage`, `rules/RulesetVersionPage` (Figure 39) — versions
  with status; tabbed editor for rules (with condition reordering and a live
  expression preview), thresholds and red-flag overrides, clarification
  questions, lexicon, health tips; save-as-new-version, submit for review,
  return to draft, publish (with the clinical-review attestation dialog), new
  draft from any version, rollback; bundle JSON import.
- `rules/TestPanel` — "Test & explain": runs the real `matchSymptoms()` and
  `evaluate()` on unsaved content in the browser and says which rule fired and
  why.
- `rules/SymptomCodesPage` — add/edit codes; locked codes cannot be edited.
- `SyncHealthPage` (Figure 40) — service status, per-barangay last report,
  device list with revoke/reinstate.
- `AuditLogPage` (Figure 41) — filter by category, pagination, de-identified
  CSV/PDF export.
- `rules/rules.test.tsx` — expression preview matches the server's formatter,
  reordering updates the expression, read-only mode, TestPanel runs the engine.

To resume:

```bash
npm install
npm run typecheck -w @mycare/console
npm test -w @mycare/console
cd apps/api && php artisan serve      # in one terminal
npm run dev -w @mycare/console        # in another, then open http://localhost:5175
```

`SANCTUM_STATEFUL_DOMAINS` in `apps/api/.env` must include `localhost:5175`
(the example file lists 5173 only) — add it before signing in.

---

## Where the build stopped (2026-09-17)

| # | Milestone | State |
|---|---|---|
| 0 | Staff-auth 500s | ✅ committed (PR #1 branch, not pushed) |
| 1 | Devices, tokens, barangays, facilities | ✅ `18acb14` |
| 2 | Ruleset lifecycle | ✅ `a644d52` |
| 3 | Accounts and devices | ✅ `14ecd28` |
| 4 | Replay, aggregation, surveillance API | ✅ `2739b64` |
| 5 | Lexicon matcher, API client, UI kit | ✅ `65fd93b` |
| 6 | Super-admin console | 🔨 written, unverified, uncommitted |
| 7 | Portal | ⬜ |
| 8 | Patient PWA + offline sync | ⬜ |
| 9 | E2E + CI | ⬜ |
| 10 | Deployment | ⬜ |

Nothing on `feat/UT-011-phases-4-to-9` has been pushed.

---

## Milestone 6 verified (2026-09-18)

`apps/console` typechecks clean, passes 4/4 tests, builds for production
(242 kB, 76 kB gzipped), and was signed into over HTTP through the Vite proxy as
`super@mycare.test`. Every console and staff endpoint answered 200: system
health, ruleset versions, symptom codes, users, devices, audit log, dashboard,
trends, sync status, map, reports.

**One real bug, found only by running it.** `GET /console/system-health`
returned **500**. Checking whether Node is available goes through Symfony's
Process, which buffers output through temporary files; under `php artisan serve`
on Windows the child server process inherits no writable TMP, so the check died
and took the whole health screen with it. A health screen that dies tells an
operator nothing.

Fixed: `EngineReplayer::availability()` never throws. It returns a status and a
plain-language reason ("The PHP process has no writable temporary directory..."),
which the screen shows as *down* with that detail. The replay path itself still
fails loudly during aggregation, because counting sessions it could not replay
would be worse than a stale dashboard. Two regression tests cover a missing
script and a missing Node binary. Suite: **Pest 176 / 716**.

**Local run command.** Use
`php -d variables_order=EGPCS artisan serve --no-reload` for the API. Plain
`artisan serve` forwards only an allow-list of environment variables, and PHP's
default `variables_order` leaves `$_ENV` empty, so TMP and TEMP never reach the
server process and engine replay cannot start. With those flags System Health
reports "Node v20.20.2". Linux deployment under php-fpm is unaffected.

Still worth doing once by hand: click through Figures 36-41 in a browser.

---

### 7 — Sub-admin portal (Figures 30-35)

**Done and verified 2026-09-18.** Typecheck clean, 4/4 tests, production build
(207 kB, 68 kB gzipped), and a live sign-in as the sub-admin through the
portal's own proxy.

What exists (`apps/portal`, React 18 + Vite, light theme, port 5174, served
under `/portal/` as Figure 30 shows):

- **Login** (Figure 30) - "Health worker portal", with the figure's own line:
  accounts are created by the system administrator.
- **Dashboard** (Figure 31) - three tier cards and the total for a date range,
  plus the most common symptoms as a ranked list. Symptoms under five sessions
  are left out of the ranking entirely: ordering them would reveal their
  relative sizes.
- **Trends & surveillance** (Figure 32, UT-017) - the cluster banner in plain
  words ("a 38% week-over-week rise in rhu referrals this week"), the 14-day
  volume chart with this week shaded when a cluster is flagged, and the watch
  list with rising / stable / low.
- **Sync & status** (Figure 33, UT-014) - a banner saying whether the data is
  current, device coverage per barangay, the queue still sitting on devices,
  and sessions received. The screen's job is to make a stale figure read as "a
  barangay is out of signal", not "the system is broken".
- **Data & reports** (Figure 34, UT-018) - pick a report, range and format,
  generate and download; recent reports listed for re-download.
- **Aggregate map** (Figure 35) - barangay tiles shaded by relative volume.
  Deliberately tiles, not a drawn map: the manuscript has no barangay
  boundaries and inventing coordinates would put made-up geography into a
  health system. Area level only, never GPS - the figure's own guarantee.

Every screen carries a plain-language privacy note explaining what "<5" means
and why a percentage or a ranking is sometimes missing.

**Live verification** (sub-admin `sub@mycare.test` through the portal proxy):
every staff endpoint 200; the barangay list returned **only Valladolid**; the
console refused the same session with **403**; and a CSV report generated and
downloaded came back scoped to Valladolid with every count suppressed:

```
Barangay,"Home management","RHU referral","Emergency referral","Total sessions"
Valladolid,<5,<5,<5,<5
```

That is UT-016 and UT-018 demonstrated end to end, not just unit-tested.

One shared-package change: `Banner` in `@mycare/ui` accepts a `className`, for
the cluster banner's accent border.

**Run it:**

```bash
npm run dev -w @mycare/portal     # http://localhost:5174/portal/
```

Sign in as `sub@mycare.test` / `password` to see the barangay-scoped view, or
as the super-admin to see every barangay with a barangay chooser.
