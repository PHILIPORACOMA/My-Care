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

---

### 8a - Design import: tokens and the staff apps (2026-09-18)

Imported the team's design canvas ("UI regeneration from storyboards",
Figures 17-41) through the Claude Design MCP and applied it to the built
apps. Typecheck clean; ui 9/9, portal 5/5, console 4/4; both apps build.

**Tokens now come from the design**, not from my approximations:

| | Value |
|---|---|
| Type | Poppins 400/500/600/700, IBM Plex Mono for figures and ids |
| Ground / surface | `#FBFAF7` / white, inputs `#FAF8F4` |
| Ink | `#16201E`, muted `#8A9491` |
| Accent | teal `#0D7C6C`, hover `#0A6A5B`, soft `#EAF4F1` |
| Tiers | home `#1F7A3C`, RHU `#EF7D12`, emergency `#D72B21` |
| Shape | 13px cards, 12px inputs, 99px pills |

**The console is not a dark theme.** The design gives it a dark *sidebar*
(`#221F1C`) beside a light content area, and a white login card on a dark
ground. Mine was dark throughout, so `AppShell` gained `sidebar="dark"` and the
console's `data-theme="dark"` is gone.

Design affordances added:

- **"Show" password toggle** on both logins (`PasswordField`), which neither
  screen had.
- **Segmented range switch** and the **"as of last sync" pill** on the
  dashboard.
- **Stat cards with a change line** ("▲ 12% vs previous period"). The API has
  no deltas, so the dashboard fetches the previous period too and computes it
  client-side — and only states a change **when both periods are displayable**,
  since a percentage against a suppressed figure would let a reader solve for
  the hidden count. A test covers that.
- **Ranked bars** for top symptom codes, with no bar for a suppressed count.
- The shared `CareMark` logo and the login brand block.

Fonts load from Google Fonts for the staff apps, which are online-only. **The
patient PWA will self-host a subset instead** — it must work offline inside a
100 MB budget.

Deliberately not copied from the design: Figure 37's "Report worker · queue 12"
panel. There is no queue worker in this deployment (reports generate in the
request), so the service panel keeps showing the aggregation job and engine
replay, which do exist.

Not yet done: nobody has looked at either app in a browser since the restyle.
Rendering gets verified with Playwright in Milestone 9.

---

### 8b - The patient PWA and the device half of sync (2026-09-18)

`apps/pwa`, Figures 17-29. This is the app the manuscript is actually about:
everything above it exists so that a patient in a barangay with no signal can
open a phone and get a tier. **Typecheck clean; 24/24 tests; production build
59 kB gzipped of JavaScript, 225 KiB precached.**

**What it does not have, on purpose:** no account, no login, no name, no age,
no GPS, no analytics, no microphone. The only thing the patient chooses about
themselves is a barangay and a language.

#### The screens

| Figure | Screen | Notes |
|---|---|---|
| 17 | Splash | One button. `CareMark` logo, tagline, no sign-in |
| 18 | Language | First, so every screen after it is in the chosen language |
| 19 | Adult confirmation | 18+ only (manuscript scope). Declining does not advance; it explains why in a banner rather than erroring |
| 20 | Barangay | A cached list, never GPS |
| 21 | Home | Greets the barangay, not a person. Check symptoms, health tips, settings |
| 22 | Symptom input | Free text **and** chips, both producing the same structured codes |
| 23 | Clarification | Only for codes whose symptom is flagged `needsClarification` |
| 24 | Processing | A deliberate 1.1 s pause; the engine answers in microseconds, but the "On-device analysis" badge is the screen's real job |
| 25/26/27 | Results | home (green), rhu (amber), emergency (red) |
| 28 | Health tips | Filtered by the tier just given, in the patient's language |
| 29 | Settings | Language, offline and queue state, about, "start over" (which clears prefs and queue). Barangay is set once during onboarding and only changes via "start over" |

#### The four decisions worth recording

**1. The tier is computed on the device, from a cached bundle.** `runTriage()`
calls `matchSymptoms()` from `packages/lexicon-matcher`, then `evaluate()` from
`packages/triage-engine`, with no network in between. The server is only ever
asked for the ruleset and told the result. This is what makes offline work, and
it is also the privacy argument: the words never need to leave.

**2. The answer that is sent is the canonical one, not the label tapped.** A
clarification question exists once per language in the bundle, and `evaluate()`
resolves it by `question_key` alone, taking the first variant in bundle order.
So if a patient answers "grabe" in Cebuano and the engine is comparing against
the English variant's `red_flag_answer` of "severe", a real emergency reads as
routine. `canonicalAnswer(bundle, key, index)` maps the position the patient
tapped onto the first variant's answer at that position. There is a test named
for exactly this, because the failure mode is silent and clinical.

**3. A retry reuses its batch uuid.** A phone cannot tell "my upload was lost"
from "my acknowledgement was lost". If the uuid changed on retry, the server
would store the same sessions twice and the surveillance counts would drift up
with every patch of bad signal. The uuid is generated when the batch is first
attempted and kept until the server accepts it (UT-015, and the server half is
the UNIQUE index on `client_batch_uuid`).

**4. A 422 is quarantined, not retried.** A batch the server rejects as invalid
will be rejected forever; retrying it every reconnect would block the queue
behind it. It stays stored (nothing is thrown away) but stops being attempted.

#### What syncs

Only this, per session: barangay id, ruleset version label, matched rule code,
language, started/completed timestamps, the symptom codes with a `negated` flag
and the **published lexicon term** that matched, and the clarification answers
with their red-flag flag. Two tests assert the patient's own sentence is absent
from the payload — one in `triage.test.ts` on the built record, one in
`app.test.tsx` on the actual outgoing HTTP body after a full journey.

#### Language

English copy is the design's, verbatim. **Tagalog and Cebuano are my drafts and
are not reviewed** — `src/i18n.ts` opens with a review banner saying so, and
`docs/ut-matrix.md` repeats it under UT-006. They need a native speaker and a
clinician before any field use, especially the emergency screen. A test asserts
all three dictionaries have identical keys, so no screen can half-fall-back to
English mid-sentence.

The symptom vocabulary itself is **not** in the app. Lexicon terms, clarification
questions and health tips all come from the published bundle, authored in the
console (CLAUDE.md: never invent lexicon terms). Until the team enters them,
free text matches nothing and the chips are the usable path — the chips are
built from the symptom codes that live rules actually test, so they are never
empty once a ruleset is published.

#### Offline mechanics

- **IndexedDB** (`src/storage.ts`), two stores: `prefs` (language, barangay,
  device token, cached bundle) and `queue` (finished sessions). No
  `localStorage` — it is synchronous, small, and not available to a worker.
- **Service worker** via `vite-plugin-pwa`/Workbox, `registerSW({immediate:
  true})`. Precaches the shell, the engine, the matcher and the font: a second
  visit needs no network at all. Updates apply immediately rather than on next
  launch, so a handset that just reconnected is not running last month's build
  against this month's rules.
- **Poppins is self-hosted**, four weights, 31 kB total, subset to Latin. The
  staff apps use Google Fonts; the PWA cannot.
- **Device registration** happens once, in the background, on first connection.
  It is anonymous and auto-approved (ADR-0005); the token lives in IndexedDB.
- `X-Pending-Sessions` on every sync tells the server how many records are still
  waiting, which is what Figures 33 and 40 display.

#### Build budget

Table 27 allows a 2 GB / Snapdragon 400 / Chrome 80 handset with 100 MB free.
Vite targets `chrome80, safari13`; React 18 and the two workspace packages are
the whole dependency tree at runtime. 225 KiB precached against a 100 MB budget
leaves the storage for the queue and the bundle, which is where it should go.

#### Verified

```
npm run typecheck -w @mycare/pwa     # clean
npm test -w @mycare/pwa              # 24 passed (triage 13, sync 8, journey 3)
npm run build -w @mycare/pwa         # 225 KiB precache, 59 kB gzip JS
```

The three journey tests drive the real UI with `userEvent`, real IndexedDB
(`fake-indexeddb`), the real matcher and the real engine, stubbing only
`fetch`: a full Cebuano walk-through from splash to a queued record, a red-flag
answer escalating to emergency with the 911 fallback, and a triage completed
with `fetch` throwing on every call, ending with the record waiting in the
queue.

**Not verified:** the app has not been opened in a real browser, and it has not
run against a live API yet — MySQL was stopped when the dev server came up, so
`/api/v1/barangays` returned a 500 from the proxy. Both belong to Milestone 9.

---

### 8c - One branch again (2026-09-20)

Phases 4-9 were built on `feat/UT-011-phases-4-to-9`, stacked on the PR #1
branch so that PR #1 could stay a reviewable Phase 3 on its own. That was my
call at the start of the phase work and I should have asked first, since it is
a decision about how Philipo's PRs get reviewed, not a technical one. Nobody
ever reviewed PR #1 separately, so the split bought nothing.

`feat/UT-020-laravel-api-schema` was fast-forwarded to the same commit on
2026-09-19, and the duplicate branch was deleted on 2026-09-20 - the remote
copy had already been deleted by someone else on GitHub by then. **One branch
now: `feat/UT-020-laravel-api-schema`, `1b51e0a`, 37 commits ahead of `main`.**
Every commit survives on it. The name no longer describes the contents; the
branch carries Phases 3 through 8.

**PR #1 cannot run CI while it conflicts with `main`.** GitHub builds a trial
merge for `pull_request` workflows; a conflicting PR has none, so no run is
queued and Phases 4-8 have never been through CI. The conflict is PR #2's
`apps/pwa` against ours - 8 files - and resolving it unblocks the merge and CI
together. Philipo is settling which patient app survives with the team first.

When it does merge, use **"Create a merge commit"**. Squashing would collapse
37 commits into one and lose the per-commit UT ids that
`docs/ut-matrix.md` traceability depends on; rebasing would rewrite every hash,
and STATUS.md and this log cite commits by hash.

---

### 8d - The PWA against a live API (2026-09-20)

MySQL was up, so the patient app finally ran against a real server instead of a
stubbed `fetch`. **Not a browser** - the Chrome extension is not connected here
- but everything below the rendering layer was real: `api.ts`, `sync.ts`,
`triage.ts` and `storage.ts` as shipped, the real lexicon matcher, the real
engine, a running Laravel server and MySQL. The substitutions were
`fake-indexeddb` for the browser's IndexedDB and a wrapper turning the app's
relative `/api/v1/...` paths absolute, which is what the Vite proxy does in the
browser.

What happened, in order:

| Step | Result |
|---|---|
| `GET /barangays` | 1 barangay (Valladolid) - the seeded 15 are not in this database |
| `POST /devices` | device #3 registered anonymously, token `apv6a9w8gdhr.<secret>` |
| `GET /ruleset/current` | `demo-v1`, published 2026-09-14: 2 codes, 3 lexicon terms, 2 rules, 1 question |
| Free text "naa koy hilanat" | matched `hilanat` → `fever_mild` on the device |
| Triage | **tier `rhu`, no matched rule, reason `fail_safe_default`** |
| `POST /sync/batches` | accepted; queue emptied; the row is in `triage_sessions` |
| Replay of the same session uuid | **no second row** - UT-015 holds against the live server |

The payload that went over the wire carried the symptom code and the published
lexicon term, and not one word the patient typed.

#### The one finding: `rule_conditions` is empty

`demo-v1`'s two rules have `conditions: []`. They were hand-made on
2026-09-14 during manual API testing, before the console existed, and no
`rule_conditions` rows were ever written - the table has **0 rows**.

Everything downstream follows from that, and all of it is correct behaviour:

- **No symptom chips.** `chipsFor()` offers only codes that a live rule
  actually tests. No conditions, no codes tested, no chips.
- **No rule matched**, so the engine fell to `rhu`, never `home` - ADR-0001's
  fail-safe, doing exactly its job on incomplete data.

So this is a **data** gap, not a code one. The app read a real bundle, matched
real text, and refused to guess. Fixing it needs a ruleset with conditions:
either author one in the console (draft → clinical-review attestation →
publish, ADR-0006), or `mycare:ruleset:import` the v1 export of the 23
appraisal-form presentations and publish that. **Publishing asserts clinical
review, so it is Philipo's to do, not mine.**

#### Still not done

Nobody has seen the app render. The Chrome extension is not connected to this
session; when it is, the browser walk-through takes minutes. Milestone 9's
Playwright suite covers it permanently.

---

### 8e - The appraisal form, and a clean database (2026-09-20)

Philipo sent `My_Care_Clinical_Appraisal_Form (1).docx` and reported that the
**physical copy is complete: every appropriateness item scored 4, and no
under-triage risk flagged on any of the 23 rules.**

**The digital file is the blank template.** Part A's name, affiliation,
signature and date lines are empty and every checkbox in Parts B and C is
unticked. The filled copy exists only on paper, so **the manuscript appendix
needs it scanned** - a blank template in the appendix would be a weak point at
defence.

#### The cross-check that matters

The form's rule table was compared row by row against the encoded ruleset in
`packages/ruleset/dist/v1.json`:

**23 of 23 rows match** - same presentation wording, same tier, same order.
6 home, 8 RHU, 9 emergency. **Zero mismatches.** What the reviewer appraised on
paper and what `evaluate()` actually runs are the same rule table.

#### The database was reset

The `mycare` database still held September's hand-made demo data, and it was
getting in the way: `demo-v1` had two symptom codes defined differently from
v1, so `mycare:ruleset:import` refused to redefine them (correctly - existing
codes are never overwritten by an import, and five synced sessions referenced
them). Its rules had no conditions at all, which is why the patient app showed
no chips and every triage fell to the `rhu` fail-safe.

With Philipo's go-ahead: `migrate:fresh --seed --force`, then import.

| Before | After |
|---|---|
| 1 barangay (Valladolid) | **15** — the seeded Carcar list |
| `demo-v1` published, 2 rules, **0 conditions** | **`v1` draft**, 23 rules, **23 conditions** |
| 5 fabricated sessions, 5 devices, 35 audit rows | 0, 0, 0 |
| 2 staff accounts | **0 — must be recreated** |

Two things were deliberately left for Philipo:

1. **The super-admin account.** `mycare:staff:create-super-admin` prompts for the
   password rather than taking an argument, so it never lands in shell history.
   Choosing or typing his password is not mine to do.
2. **Publishing v1.** Publishing writes the clinical-review attestation (ADR-0006)
   - who reviewed, and when. "All 4s, no risks" relayed secondhand is not an
   attestation; the reviewer's name and the form's date are.

**Until v1 is published, `GET /api/v1/ruleset/current` returns 503 and the patient
app cannot triage.** That was the accepted trade for a clean database. Once it is
published the symptom screen will offer chips for all 23 presentations. Free text
still matches nothing: `v1` carries **zero lexicon terms**, and those are the
reviewed ones Philipo will enter himself.

---

### 8f - One scale across all three apps (2026-09-23)

Philipo: "there's quite an inconsistency in the ui, try smoothing everything
out." The Chrome extension is not connected to this session, so this was an
audit of the stylesheets rather than of pixels - which turned out to be lucky,
because two of the findings were defects rather than drift.

#### Two actual bugs, found on the way

**`.mc-visually-hidden` and `.mc-row` are packages/ui class names, and the
patient app does not import packages/ui.** So in `apps/pwa`:

- the screen-reader-only labels on the symptom screen and the result screen had
  no styles at all, and were **rendering as visible duplicate text** - the
  symptom screen showed its own heading twice;
- Home's language pill and settings button had **no row layout**, because the
  class carrying `display: flex` did not exist. The inline `gap: 8` did nothing
  without it.

Both now use PWA-native classes (`.sr-only`, `.row-inline`) defined in the
app's own sheet. This is exactly the failure the CLAUDE.md layout rule predicts
when the two vocabularies blur: the patient app is excluded from the kit on
purpose, so borrowing a class name from it silently produces unstyled markup.

#### The drift

| | Before | After |
|---|---|---|
| Type sizes, patient app | 11 (11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16 …) | 9 named steps, no fractions |
| Type sizes, staff kit | 12 (10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 15.5, 16, 17 …) | 9 named steps |
| Radii, patient app | 7 literals (11, 13, 14, 16, 18, 26, 99) | 4 tokens |
| Gaps, staff kit | 4, 5, 7, 8, 9, 10, 12, 14, 16, 18px | one 4px scale |
| Inline `style={{…}}` | **70** | **9**, all of them data |
| Side gutter, patient screens | 22px / 24px / 26px depending on screen | one `--gutter` |
| Hairline colour, patient app | 4 alphas (.07, .08, .09, .12) | `--line`, plus one deliberate `--line-strong` |

The most visible of these: `.title` carried a different margin on every screen
it appeared on - `18px 0 14px`, `22px 0 4px`, `18px 0 16px`, `18px 0 8px` -
so headings sat at a different height depending on where the patient was. It
is now one rule in the stylesheet.

#### Colours reconciled

Three tokens disagreed between the kit and the patient app for no reason:
ground (`#fbfaf7` vs `#f6f3ed`), hairline (8% vs 10% black) and the RHU tint
(`#fdf2e4` vs `#fdf0e1`). The patient app now uses the design canvas's values,
so a tier looks the same to a patient and to the health worker reading the
dashboard. **The two sheets stay separate** - same values, different token
names, no import - because CLAUDE.md excludes the kit from the PWA and that
rule is what the bundle budget rests on.

#### What deliberately stayed inline

Nine declarations, all of them data rather than styling: a ranked bar's width
(`${percent}%`), two legend swatch colours, and the six `grid-template-columns`
that give each ruleset editor its own column layout.

#### Verified

`npm test` 47 passed (console 4, portal 5, pwa 24, api-client 5, ui 9, plus the
engine, matcher and replay suites). Typecheck clean across ten workspaces. All
three apps build; the patient bundle is unchanged at 58.9 kB gzipped, 227 KiB
precached. Every size, radius, gap, padding and margin in all four stylesheets
now resolves to a token - the check for a stray literal comes back empty.

**Still unverified: how any of it looks.** Nothing here was seen rendered. The
two undefined-class bugs are the argument for Milestone 9's Playwright pass
sooner rather than later: both would have been obvious in a browser, and
neither was visible to 47 passing tests.

---

### 8g - Splitting "no signal" from "no rules" (2026-09-23)

Philipo, testing the patient app: *"when i choose a barangay, it needs internet
to continue."* Two separate things were happening.

**The real one, which is by design.** Confirming a barangay is the device's
first contact with the server: it registers anonymously and downloads the
ruleset. Without rules there is nothing to triage with, so a first run needs
connectivity once. Table 27's "None required for triage" is a claim about
triage, not about provisioning, and the app's own copy says so - *"needs an
internet connection the first time... After that it works offline."* The
honest phrasing for the defence: **one connection to provision, none to
triage.**

**The bug.** Every failure to fetch a ruleset was reported as "no internet",
including a `503` - a server that answered perfectly well and has nothing
published. So a patient with working signal was told to go and find signal,
and the fix (publish a ruleset) belongs to someone who is not in the room.
It also made testing confusing: perfect wifi, app still asking to connect.

`refreshBundle` now says why it has nothing:

| reason | what the patient reads | who can fix it |
|---|---|---|
| `offline` | "Connect once to get started" | the patient |
| `unpublished` | "Not ready yet" - connection is fine, nothing published yet | the health office |
| `server` | "Cannot reach the health office" | nobody on site |

A device that already holds a bundle is untouched: a failed refresh stays
silent and it keeps triaging offline, which is the entire point. Only a device
with nothing cached raises `BundleUnavailable`.

Verified against the live API, which returns exactly that 503 today:
`refreshBundle` reasons `unpublished`. 25/25 tests, including one that walks
onboarding against a 503 and asserts the connection message is **not** shown.
The Tagalog and Cebuano wording is draft, like the rest of `i18n.ts`.

#### Testing offline needs the production build

The dev server never registers a service worker, so going offline against
`:5173` proves nothing - the page simply dies. `vite.config.ts` gained a
`preview` proxy so the built app can still reach the API for that one
provisioning call:

```bash
npm run build -w @mycare/pwa
npm run preview -w @mycare/pwa     # :4173, /api proxied
# onboard online, then DevTools > Network > Offline, hard reload
```
